import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { getInvoice, settlePayment } from "@/lib/api/invoices";
import { getSettings } from "@/lib/api/settings";
import { uploadMediaFile, listMediaForVehicle, signedMediaUrls } from "@/lib/api/media";
import { formatINR, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Download, Printer, Camera, MessageCircle, Pencil } from "lucide-react";
import { invoiceMessage, shareDocumentOnWhatsApp } from "@/lib/whatsapp";
import { PrintHeader } from "@/components/print-header";
import { runPdfDownload, printCurrentDocument, useAutoPrintDownload } from "@/lib/print-download";
import { buildInvoicePdf } from "@/lib/pdf-document";
import { ActivityLog } from "@/components/activity-log";
import { CustomerNameEditDialog } from "@/components/customer-name-edit-dialog";
import { InvoiceEditDialog } from "@/components/invoice-edit-dialog";
import { useRoles } from "@/hooks/use-session";
import { Badge } from "@/components/ui/badge";
import { listActivityFor } from "@/lib/api/activity";
import { derivedInvoicePaid, derivedInvoiceDue } from "@/lib/billing/calculations";



export const Route = createFileRoute("/_authenticated/invoices/$id")({
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { isAdmin } = useRoles();
  const [editOpen, setEditOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const q = useQuery({ queryKey: ["invoice", id], queryFn: () => getInvoice(id) });
  const settings = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const activityQ = useQuery({
    queryKey: ["activity", "invoice", id],
    queryFn: () => listActivityFor("invoice", id),
  });
  const editEntries = (activityQ.data ?? []).filter((e) => e.action === "update");
  const wasEdited = editEntries.length > 0;
  const vehicleId = (q.data as any)?.vehicle_id ?? null;
  const mediaQ = useQuery({
    queryKey: ["media", vehicleId],
    enabled: !!vehicleId,
    queryFn: () => listMediaForVehicle(vehicleId!),
  });
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = (mediaQ.data ?? []).map((m) => m.storage_path);
    if (paths.length) signedMediaUrls(paths).then(setUrls);
  }, [mediaQ.data]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<"pre_work" | "post_work">("post_work");
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files || !q.data) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMediaFile({
          file,
          vehicle_id: (q.data as any).vehicle_id,
          customer_id: (q.data as any).customer_id,
          job_id: (q.data as any).job_id ?? null,
          stage,
        });
      }
      toast.success("Uploaded");
      qc.invalidateQueries({ queryKey: ["media", vehicleId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }
  const printActive = useRouterState({
    select: (s) => (s.location.search as any)?.print === 1 || (s.location.search as any)?.print === "1",
  });

  const handleDownload = async () => {
    if (!q.data) return false;
    const d: any = q.data;
    return await runPdfDownload(
      () => buildInvoicePdf(d, { settings: settings.data ?? null }),
      `Invoice-${d.number}`,
    );
  };

  const { blocked, retry } = useAutoPrintDownload(!!q.data, handleDownload, printActive);

  const [sharing, setSharing] = useState(false);
  const handleWhatsApp = async () => {
    const d: any = q.data;
    if (!d?.customer?.phone) return;
    setSharing(true);
    const toastId = toast.loading("Preparing PDF…");
    try {
      const blob = await buildInvoicePdf(d, { settings: settings.data ?? null });
      const result = await shareDocumentOnWhatsApp({
        phone: d.customer.phone,
        message: invoiceMessage({
          customerName: d.customer.name,
          invoiceNumber: d.number,
          vehicle: d.vehicle?.number ?? null,
          total: d.total,
          balance: derivedInvoiceDue(d as any),
        }),
        blob,
        filename: `Invoice-${d.number}`,
      });
      toast.success(
        result === "shared" ? "Sharing invoice PDF" : "PDF downloaded — attach it in the WhatsApp chat",
        { id: toastId },
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Could not prepare the PDF", { id: toastId });
    } finally {
      setSharing(false);
    }
  };
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "upi" | "card" | "bank_transfer" | "other">("cash");
  const [ref, setRef] = useState("");
  const [settleFull, setSettleFull] = useState(false);
  const [adjustNote, setAdjustNote] = useState("");
  const pay = useMutation({
    mutationFn: () =>
      settlePayment({
        invoice_id: id,
        amount: Number(amount),
        method,
        reference: ref || undefined,
        adjustShortfall: settleFull,
        adjustment_note: adjustNote || null,
      }),
    onSuccess: (r) => {
      if (r.adjusted > 0) {
        toast.success(`Payment recorded · ${formatINR(r.adjusted)} adjusted${r.expenseFailed ? " (expense entry not created)" : " to expenses"}`);
      } else {
        toast.success("Payment recorded");
      }
      setAmount(""); setRef(""); setAdjustNote(""); setSettleFull(false);
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      q.refetch();
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["customers"] });

    },
    onError: (e: any) => toast.error(e.message),
  });

  const d = q.data;
  if (!d) return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
      <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
    </div>
  );
  const adjustment = Number((d as any).adjustment_amount ?? 0);
  const paid = derivedInvoicePaid(d as any);
  const due = derivedInvoiceDue(d as any);

  const entered = Number(amount) || 0;
  const shortfall = +(due - entered).toFixed(2) > 0 && entered > 0 ? +(due - entered).toFixed(2) : 0;

  return (
    <div className="space-y-4">
      {blocked && (
        <Card className="p-3 flex items-center justify-between gap-2 no-print border-warning">
          <span className="text-sm">PDF generation failed.</span>
          <Button size="sm" onClick={retry}><Download className="mr-2 h-4 w-4" />Retry PDF</Button>
        </Card>
      )}
      <div className="space-y-4 bg-background p-2">
        <PrintHeader title="Tax Invoice" number={d.number} date={formatDateTime(d.issued_at)} />

        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{d.number}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight">Invoice</h1>
              {wasEdited && (
                <Badge variant="outline" className="border-warning text-warning-foreground bg-warning/10">
                  Edited · {editEntries.length}×
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link to="/customers/$id" params={{ id: d.customer.id }} className="text-sm text-muted-foreground hover:underline">
                {d.customer.name} · {d.customer.phone}
              </Link>
              <button
                type="button"
                className="no-print inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                onClick={() => setNameOpen(true)}
              >
                <Pencil className="h-3 w-3" />Edit name
              </button>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <StatusBadge status={d.status} />
            <div className="text-xs text-muted-foreground">{formatDateTime(d.issued_at)}</div>
            {isAdmin && (
              <Button size="sm" variant="outline" className="no-print mt-1" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1 h-3 w-3" />Edit invoice
              </Button>
            )}
          </div>
        </div>

        <Card className="p-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr className="text-left"><th className="pb-2">Item</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Rate</th><th className="pb-2 text-right">Amount</th></tr></thead>
            <tbody>
              {(d.items ?? []).map((it: any) => (
                <tr key={it.id} className="border-t"><td className="py-2">{it.name}</td><td className="py-2 text-right">{it.qty}</td><td className="py-2 text-right">{formatINR(it.unit_price)}</td><td className="py-2 text-right">{formatINR(it.amount)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(d.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST ({d.tax_rate}%)</span><span>{formatINR(d.tax_amount)}</span></div>
            <div className="flex justify-between text-base font-semibold pt-1"><span>Total</span><span>{formatINR(d.total)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Paid</span><span className="text-success">{formatINR(paid)}</span></div>
            {adjustment > 0 && (
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Adjusted / written off</span><span>{formatINR(adjustment)}</span></div>
            )}
            <div className="flex justify-between text-base font-semibold"><span>Due</span><span>{formatINR(due)}</span></div>
          </div>
        </Card>
      </div>

      {due > 0 && (
        <Card className="p-4 space-y-3 no-print">
          <h2 className="font-semibold">Record payment</h2>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" /></div>
            <div><Label>Method</Label>
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value as any)}>
                <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank</option><option value="other">Other</option>
              </select>
            </div>
          </div>
          <div><Label>Reference (optional)</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1" /></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => setAmount(String(due))}>Full due {formatINR(due)}</Button>
            {[10, 50, 100].map((r) => (
              <Button key={r} type="button" size="sm" variant="outline" className="h-9" onClick={() => setAmount(String(Math.floor(due / r) * r))}>
                Round to {r}
              </Button>
            ))}
          </div>
          {shortfall > 0 && (
            <div className="rounded-md border border-warning/50 bg-warning/5 p-3 space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4"
                  checked={settleFull}
                  onChange={(e) => setSettleFull(e.target.checked)}
                />
                <span>
                  Mark invoice <b>fully paid</b> and write off the shortfall of <b>{formatINR(shortfall)}</b>.
                  <span className="block text-xs text-muted-foreground">It is booked as a "Payment Adjustment" expense and shown on the dashboard.</span>
                </span>
              </label>
              {settleFull && (
                <Input
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Reason (optional) — e.g. rounded off / cash short"
                />
              )}
            </div>
          )}
          <Button className="w-full h-11" onClick={() => pay.mutate()} disabled={pay.isPending || !amount}>
            {settleFull && shortfall > 0 ? `Record ${formatINR(Number(amount))} & close invoice` : "Record payment"}
          </Button>
        </Card>
      )}

      {due <= 0 && (
        <Card className="p-4 no-print flex items-center justify-between">
          <span className="text-sm font-medium text-success">Fully paid</span>
          <span className="text-sm text-muted-foreground">No amount due · {formatINR(paid)} received</span>
        </Card>
      )}


      <Card className="p-4 no-print">
        <h2 className="mb-2 text-sm font-semibold">Payments</h2>
        <div className="space-y-1 text-sm">
          {(d.payments ?? []).map((p: any) => (
            <div key={p.id} className="flex justify-between border-b py-1 last:border-0">
              <span>{p.method.toUpperCase()} {p.reference ? `· ${p.reference}` : ""}</span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">{formatDateTime(p.created_at)}</span>
                <span className="font-medium">{formatINR(p.amount)}</span>
              </div>
            </div>
          ))}
          {(d.payments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
        </div>
      </Card>

      <Card className="p-4 space-y-3 no-print">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Attach photos / videos</h2>
          <span className="text-xs text-muted-foreground">{(mediaQ.data ?? []).length} items</span>
        </div>
        <p className="text-xs text-muted-foreground">Add media before sharing or printing the invoice.</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={stage === "pre_work" ? "default" : "outline"}
            onClick={() => { setStage("pre_work"); inputRef.current?.click(); }}
            disabled={uploading}
          >
            <Camera className="mr-2 h-4 w-4" />Add pre-work
          </Button>
          <Button
            size="sm"
            variant={stage === "post_work" ? "default" : "outline"}
            onClick={() => { setStage("post_work"); inputRef.current?.click(); }}
            disabled={uploading}
          >
            <Camera className="mr-2 h-4 w-4" />Add post-work
          </Button>
          {uploading && <span className="text-xs text-muted-foreground self-center">Uploading…</span>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
        {(mediaQ.data ?? []).length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {(mediaQ.data ?? []).map((m) => {
              const url = urls[m.storage_path];
              return (
                <a
                  key={m.id}
                  href={url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${m.stage === "pre_work" ? "Pre-work" : "Post-work"} media from ${formatDateTime(m.created_at)}`}
                  className="relative aspect-square overflow-hidden rounded-md border bg-muted"
                  title={`${m.stage} · ${formatDateTime(m.created_at)}`}
                >
                  {url ? (
                    m.kind === "video" ? (
                      <video src={url} className="h-full w-full object-cover" />
                    ) : (
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )
                  ) : null}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 py-0.5 text-center text-[9px] uppercase text-white">
                    {m.stage === "pre_work" ? "Pre" : "Post"}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </Card>



      <div className="flex flex-wrap gap-2 no-print">
        <Button variant="secondary" className="flex-1" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
        <Button variant="outline" className="flex-1" onClick={() => printCurrentDocument(`Invoice-${d.number}`)}><Printer className="mr-2 h-4 w-4" />Print</Button>
        {d.customer?.phone && (
          <Button
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            disabled={sharing}
            onClick={handleWhatsApp}
          >
            <MessageCircle className="mr-2 h-4 w-4" />WhatsApp
          </Button>
        )}
      </div>

      {wasEdited && (
        <Card className="p-4 no-print border-warning/40">
          <h2 className="mb-2 text-sm font-semibold flex items-center gap-2">
            <Pencil className="h-3.5 w-3.5" /> Edit history — before → after
          </h2>
          <div className="space-y-3">
            {editEntries.map((e) => {
              const keys = e.changes ? Object.keys(e.changes) : [];
              return (
                <div key={e.id} className="rounded-md border bg-muted/20 p-3 text-xs">
                  <div className="mb-1 text-muted-foreground">
                    {e.actor_name ?? "System"} · {formatDateTime(e.created_at)}
                  </div>
                  <ul className="space-y-1">
                    {keys.map((k) => (
                      <li key={k} className="grid grid-cols-[110px_1fr] gap-2">
                        <span className="font-medium">{k}</span>
                        <span>
                          <span className="line-through text-destructive/80">{String(e.changes?.[k]?.from ?? "—")}</span>
                          {" → "}
                          <span className="text-success font-medium">{String(e.changes?.[k]?.to ?? "—")}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      

      <ActivityLog
        entity="invoice"
        entityId={d.id}
        alsoEntity="customer"
        alsoEntityId={d.customer?.id ?? null}
        title="Change history"
      />

      {editOpen && (
        <InvoiceEditDialog open={editOpen} onOpenChange={setEditOpen} invoice={d} />
      )}
      {d.customer && (
        <CustomerNameEditDialog
          key={`${d.customer.id}-${d.customer.name}`}
          open={nameOpen}
          onOpenChange={setNameOpen}
          customerId={d.customer.id}
          currentName={d.customer.name}
          onSaved={() => { q.refetch(); activityQ.refetch(); }}
        />
      )}
    </div>

  );
}
