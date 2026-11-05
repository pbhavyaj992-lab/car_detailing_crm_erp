import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { getQuote, approveQuote, convertQuoteToJob, cancelQuote } from "@/lib/api/quotes";
import { getSettings } from "@/lib/api/settings";
import { formatINR, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Download, Printer, MessageCircle, Pencil } from "lucide-react";
import { useState } from "react";
import { quoteMessage, shareDocumentOnWhatsApp } from "@/lib/whatsapp";
import { PrintHeader } from "@/components/print-header";
import { runPdfDownload, printCurrentDocument, useAutoPrintDownload } from "@/lib/print-download";
import { buildQuotePdf } from "@/lib/pdf-document";
import { ActivityLog } from "@/components/activity-log";
import { CustomerNameEditDialog } from "@/components/customer-name-edit-dialog";


export const Route = createFileRoute("/_authenticated/quotes/$id")({
  component: QuoteDetail,
});

function QuoteDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["quote", id], queryFn: () => getQuote(id) });
  const settings = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const printActive = useRouterState({
    select: (s) => (s.location.search as any)?.print === 1 || (s.location.search as any)?.print === "1",
  });

  const handleDownload = async () => {
    if (!q.data) return false;
    const d: any = q.data;
    return await runPdfDownload(
      () => buildQuotePdf(d, { settings: settings.data ?? null }),
      `Quote-${d.number}`,
    );
  };

  const { blocked, retry } = useAutoPrintDownload(!!q.data, handleDownload, printActive);

  const [sharing, setSharing] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const handleWhatsApp = async () => {
    const d: any = q.data;
    if (!d?.customer?.phone) return;
    setSharing(true);
    const toastId = toast.loading("Preparing PDF…");
    try {
      const blob = await buildQuotePdf(d, { settings: settings.data ?? null });
      const result = await shareDocumentOnWhatsApp({
        phone: d.customer.phone,
        message: quoteMessage({
          customerName: d.customer.name,
          quoteNumber: d.number,
          vehicle: d.vehicle?.number ?? null,
          total: d.total,
        }),
        blob,
        filename: `Quote-${d.number}`,
      });
      toast.success(
        result === "shared" ? "Sharing quote PDF" : "PDF downloaded — attach it in the WhatsApp chat",
        { id: toastId },
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Could not prepare the PDF", { id: toastId });
    } finally {
      setSharing(false);
    }
  };

  const approve = useMutation({ mutationFn: () => approveQuote(id), onSuccess: () => { toast.success("Approved"); q.refetch(); } });
  const cancel = useMutation({ mutationFn: () => cancelQuote(id), onSuccess: () => { toast.success("Cancelled"); q.refetch(); } });
  const toJob = useMutation({
    mutationFn: () => convertQuoteToJob(id),
    onSuccess: (job) => { toast.success(`Job ${job.number} created`); navigate({ to: "/jobs/$id", params: { id: job.id } }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (q.isLoading) return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
      <Skeleton className="h-64 w-full rounded-[var(--radius)]" />
    </div>
  );
  const d = q.data;
  if (!d) return <div>Not found</div>;

  return (
    <div className="space-y-4">
      {blocked && (
        <Card className="p-3 flex items-center justify-between gap-2 no-print border-warning">
          <span className="text-sm">PDF generation failed.</span>
          <Button size="sm" onClick={retry}><Download className="mr-2 h-4 w-4" />Retry PDF</Button>
        </Card>
      )}
      <div className="space-y-4 bg-background p-2">
        <PrintHeader title="Quotation" number={d.number} date={formatDate(d.created_at)} />

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">{d.number}</div>
            <h1 className="text-2xl font-semibold tracking-tight">Quote for {d.vehicle?.number ?? "Inquiry"}</h1>
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
          <div className="text-right">
            <StatusBadge status={d.status} />
            <div className="mt-1 text-xs text-muted-foreground">{formatDate(d.created_at)}</div>
          </div>
        </div>

        <Card className="p-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="text-left"><th className="pb-2">Item</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Rate</th><th className="pb-2 text-right">Amount</th></tr>
            </thead>
            <tbody>
              {(d.items ?? []).map((it: any) => (
                <tr key={it.id} className="border-t"><td className="py-2">{it.name}</td><td className="py-2 text-right">{it.qty}</td><td className="py-2 text-right">{formatINR(it.unit_price)}</td><td className="py-2 text-right">{formatINR(it.amount)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(d.subtotal)}</span></div>
            {Number(d.discount) > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>− {formatINR(d.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">GST ({d.tax_rate}%)</span><span>{formatINR(d.tax_amount)}</span></div>
            <div className="flex justify-between text-base font-semibold pt-1"><span>Total</span><span>{formatINR(d.total)}</span></div>
          </div>
          {d.notes && <p className="mt-3 text-sm text-muted-foreground">{d.notes}</p>}
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        {d.status === "draft" && <Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve</Button>}
        {d.status !== "converted" && d.status !== "cancelled" && d.vehicle_id && (
          <Button onClick={() => toJob.mutate()} disabled={toJob.isPending} variant="default">Convert to Job</Button>
        )}
        {d.status !== "cancelled" && <Button variant="ghost" onClick={() => cancel.mutate()}>Cancel</Button>}
        
        <Button variant="secondary" onClick={handleDownload}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
        <Button variant="outline" onClick={() => printCurrentDocument(`Quote-${d.number}`)}><Printer className="mr-2 h-4 w-4" />Print</Button>
        {d.customer?.phone && (
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={sharing}
            onClick={handleWhatsApp}
          >
            <MessageCircle className="mr-2 h-4 w-4" />WhatsApp
          </Button>
        )}
      </div>

      <ActivityLog
        entity="quote"
        entityId={d.id}
        alsoEntity="customer"
        alsoEntityId={d.customer?.id ?? null}
        title="Change history"
      />

      {d.customer && (
        <CustomerNameEditDialog
          key={`${d.customer.id}-${d.customer.name}`}
          open={nameOpen}
          onOpenChange={setNameOpen}
          customerId={d.customer.id}
          currentName={d.customer.name}
          onSaved={() => q.refetch()}
        />
      )}
    </div>

  );
}

