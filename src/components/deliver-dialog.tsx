import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createInvoiceFromJob, recordPayment } from "@/lib/api/invoices";
import { updateJobStatus } from "@/lib/api/jobs";
import { formatINR } from "@/lib/format";
import { hardOpenInvoiceForDownload } from "@/lib/print-download";
import { toast } from "sonner";

type PaymentMethod = "cash" | "upi" | "card" | "bank_transfer" | "other";

export function DeliverDialog({
  open,
  onOpenChange,
  jobId,
  vehicleLabel,
  quoteTotal,
  quote,
  customer,
  vehicle,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
  vehicleLabel?: string;
  quoteTotal?: number;
  quote?: any;
  customer?: { id?: string; name?: string | null; phone?: string | null } | null;
  vehicle?: { id?: string; number?: string | null; brand?: string | null; model?: string | null; color?: string | null } | null;
  onDone?: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState<string>("");
  const [ref, setRef] = useState("");
  const [skipPayment, setSkipPayment] = useState(false);

  const total = quote?.total ?? quoteTotal;

  useEffect(() => {
    if (open) {
      setAmount(total ? String(total) : "");
      setMethod("cash");
      setRef("");
      setSkipPayment(false);
    }
  }, [open, total]);

  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: async () => {
      // Find or create the invoice for this job
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("job_id", jobId)
        .maybeSingle();
      const invoiceId = existing?.id ?? (await createInvoiceFromJob(jobId));

      const amt = Number(amount);
      if (!skipPayment && amt > 0) {
        await recordPayment({
          invoice_id: invoiceId,
          amount: amt,
          method,
          reference: ref || undefined,
        });
      }
      await updateJobStatus(jobId, "delivered");
      return invoiceId;
    },
    onSuccess: (invoiceId) => {
      toast.success("Job delivered · invoice generated");
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      if (vehicle?.id) qc.invalidateQueries({ queryKey: ["media", vehicle.id] });
      onOpenChange(false);
      onDone?.();
      hardOpenInvoiceForDownload(invoiceId);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const methods: { key: PaymentMethod; label: string }[] = [
    { key: "cash", label: "Cash" },
    { key: "upi", label: "UPI" },
    { key: "card", label: "Card" },
    { key: "bank_transfer", label: "Bank" },
  ];

  const items = (quote?.items ?? []) as Array<{ id?: string; description?: string | null; name?: string | null; quantity?: number; qty?: number; unit_price?: number; price?: number; total?: number }>;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Complete & deliver{vehicleLabel ? ` · ${vehicleLabel}` : ""}</AlertDialogTitle>
          {(customer?.name || vehicle?.brand || vehicle?.model) && (
            <div className="text-sm text-muted-foreground">
              {customer?.name && <span className="font-medium text-foreground">{customer.name}</span>}
              {customer?.phone && <span> · {customer.phone}</span>}
              {(vehicle?.brand || vehicle?.model || vehicle?.color) && (
                <div className="text-xs">
                  {[vehicle?.brand, vehicle?.model].filter(Boolean).join(" ")}
                  {vehicle?.color ? ` · ${vehicle.color}` : ""}
                </div>
              )}
            </div>
          )}
          <AlertDialogDescription>
            Generates the invoice{typeof total === "number" ? ` (${formatINR(total)})` : ""}, records the payment, and marks the job delivered.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {(items.length > 0 || total != null) && (
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Approved quote{quote?.number ? ` · ${quote.number}` : ""}
              </span>
              {typeof total === "number" && <span className="text-base font-semibold tabular-nums">{formatINR(total)}</span>}
            </div>
            {items.length > 0 && (
              <ul className="divide-y">
                {items.map((it, i) => {
                  const qty = it.quantity ?? it.qty ?? 1;
                  const line = it.total ?? (Number(it.unit_price ?? it.price ?? 0) * Number(qty));
                  return (
                    <li key={it.id ?? i} className="flex items-start justify-between gap-2 py-1.5">
                      <div className="min-w-0">
                        <div className="truncate">{it.description ?? it.name ?? "Item"}</div>
                        <div className="text-xs text-muted-foreground">Qty {qty}</div>
                      </div>
                      <div className="shrink-0 tabular-nums">{formatINR(Number(line))}</div>
                    </li>
                  );
                })}
              </ul>
            )}
            {(quote?.subtotal != null || quote?.discount || quote?.tax_amount) && (
              <div className="mt-2 space-y-0.5 border-t pt-2 text-xs text-muted-foreground">
                {quote?.subtotal != null && <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatINR(Number(quote.subtotal))}</span></div>}
                {Number(quote?.discount) > 0 && <div className="flex justify-between"><span>Discount</span><span className="tabular-nums">−{formatINR(Number(quote.discount))}</span></div>}
                {Number(quote?.tax_amount) > 0 && <div className="flex justify-between"><span>Tax</span><span className="tabular-nums">{formatINR(Number(quote.tax_amount))}</span></div>}
              </div>
            )}
          </div>
        )}


        <div className="space-y-3">
          <div>
            <Label className="text-xs">Payment method</Label>
            <div className="mt-1 grid grid-cols-4 gap-1">
              {methods.map((m) => (
                <Button
                  key={m.key}
                  type="button"
                  size="sm"
                  variant={method === m.key && !skipPayment ? "default" : "secondary"}
                  onClick={() => { setMethod(m.key); setSkipPayment(false); }}
                >
                  {m.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="flex items-baseline justify-between">
                <Label className="text-xs">Amount received</Label>
                {typeof total === "number" && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(total))}
                    className="text-xs font-medium text-muted-foreground/70 hover:text-foreground"
                    title="Use approved quote amount"
                  >
                    Quote: {formatINR(total)}
                  </button>
                )}
              </div>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={skipPayment}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs">Reference (optional)</Label>
              <Input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                disabled={skipPayment || method === "cash"}
                placeholder={method === "upi" ? "UPI ref" : method === "card" ? "Card txn" : ""}
                className="mt-1"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={skipPayment} onChange={(e) => setSkipPayment(e.target.checked)} />
            Skip payment (mark unpaid)
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={run.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={run.isPending || (!skipPayment && !(Number(amount) > 0))}
            onClick={(e) => { e.preventDefault(); run.mutate(); }}
          >
            {run.isPending ? "Saving…" : "Deliver & Invoice"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
