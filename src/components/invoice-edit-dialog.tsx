import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { updateInvoice, voidInvoice, type InvoiceEditItem } from "@/lib/api/invoices";
import { formatINR } from "@/lib/format";

export function InvoiceEditDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: any;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<InvoiceEditItem[]>(() =>
    (invoice.items ?? []).map((i: any) => ({
      id: i.id,
      name: i.name,
      qty: Number(i.qty),
      unit_price: Number(i.unit_price),
    })),
  );
  const [discount, setDiscount] = useState<string>(String(invoice.discount ?? 0));
  const [taxRate, setTaxRate] = useState<string>(String(invoice.tax_rate ?? 0));
  const [notes, setNotes] = useState<string>(invoice.notes ?? "");
  const [reason, setReason] = useState("");

  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0);
  const taxable = Math.max(0, subtotal - (Number(discount) || 0));
  const taxAmt = taxable * ((Number(taxRate) || 0) / 100);
  const total = taxable + taxAmt;

  const save = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Please provide an edit reason (audit log)");
      if (items.length === 0) throw new Error("At least one item required");
      await updateInvoice({
        invoice_id: invoice.id,
        items,
        discount: Number(discount) || 0,
        tax_rate: Number(taxRate) || 0,
        notes,
        edit_reason: reason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Invoice updated. Change history recorded.");
      qc.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["activity", "invoice", invoice.id] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const doVoid = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("Please provide a reason before voiding");
      await voidInvoice(invoice.id, reason.trim());
    },
    onSuccess: () => {
      toast.success("Invoice voided");
      qc.invalidateQueries({ queryKey: ["invoice", invoice.id] });
      qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["activity", "invoice", invoice.id] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Void failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit invoice {invoice.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-warning/40 bg-warning/5 p-2 text-xs">
            Owner-only. Every field change is logged with before/after values in the activity log.
          </div>

          <div className="space-y-2">
            <Label>Line items</Label>
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-6">
                  <Input
                    placeholder="Item name"
                    value={it.name}
                    onChange={(e) => {
                      const cp = [...items]; cp[idx] = { ...it, name: e.target.value }; setItems(cp);
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number" min={0} step={0.01} placeholder="Qty" value={it.qty}
                    onChange={(e) => { const cp = [...items]; cp[idx] = { ...it, qty: Number(e.target.value) }; setItems(cp); }}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number" min={0} step={0.01} placeholder="Rate" value={it.unit_price}
                    onChange={(e) => { const cp = [...items]; cp[idx] = { ...it, unit_price: Number(e.target.value) }; setItems(cp); }}
                  />
                </div>
                <div className="col-span-1">
                  <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setItems([...items, { name: "", qty: 1, unit_price: 0 }])}>
              <Plus className="mr-1 h-3 w-3" />Add item
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Discount (₹)</Label>
              <Input type="number" min={0} step={0.01} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <Label>Tax rate (%)</Label>
              <Input type="number" min={0} step={0.01} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>−{formatINR(Number(discount) || 0)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatINR(taxAmt)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-1"><span>New total</span><span>{formatINR(total)}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Previous total</span><span>{formatINR(invoice.total)}</span></div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div>
            <Label>Reason for edit <span className="text-destructive">*</span></Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. Customer requested a price adjustment" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="destructive"
            disabled={doVoid.isPending || invoice.status === "cancelled"}
            onClick={() => { if (confirm("Void this invoice? It will be marked cancelled.")) doVoid.mutate(); }}
          >
            Void invoice
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Save changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
