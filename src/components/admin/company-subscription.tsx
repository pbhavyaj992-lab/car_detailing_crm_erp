import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BILLING_CYCLES,
  COMPANY_STATUSES,
  PLAN_TIERS,
  addCycle,
  deleteCompanyPayment,
  listCompanyPayments,
  renewSubscription,
  updateCompany,
  type Company,
} from "@/lib/api/companies";

export function SubscriptionDialog({
  company,
  onClose,
}: {
  company: Company | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("upi");
  const [reference, setReference] = useState("");

  const payments = useQuery({
    queryKey: ["company-payments", company?.id],
    queryFn: () => listCompanyPayments(company!.id),
    enabled: !!company,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["company-payments", company?.id] });
    qc.invalidateQueries({ queryKey: ["my-subscription"] });
  };

  const patch = useMutation({
    mutationFn: (p: Partial<Company>) => updateCompany(company!.id, p as never),
    onSuccess: () => {
      toast.success("Subscription updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renew = useMutation({
    mutationFn: async () => {
      const value = Number(amount || company!.plan_price || 0);
      const end = await renewSubscription(company!, { amount: value, method, reference });
      return end;
    },
    onSuccess: (end) => {
      toast.success(`Renewed until ${end.toLocaleDateString()}`);
      setAmount("");
      setReference("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePayment = useMutation({
    mutationFn: (id: string) => deleteCompanyPayment(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  if (!company) return null;
  const nextEnd = addCycle(
    company.subscription_ends_at && new Date(company.subscription_ends_at) > new Date()
      ? new Date(company.subscription_ends_at)
      : new Date(),
    company.billing_cycle,
  );

  return (
    <Dialog open={!!company} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Subscription — {company.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Plan</Label>
            <Select value={company.plan_tier} onValueChange={(v) => patch.mutate({ plan_tier: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAN_TIERS.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Billing cycle</Label>
            <Select value={company.billing_cycle} onValueChange={(v) => patch.mutate({ billing_cycle: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_CYCLES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={company.status} onValueChange={(v) => patch.mutate({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COMPANY_STATUSES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Price per cycle</Label>
            <Input
              type="number"
              defaultValue={company.plan_price}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== company.plan_price) patch.mutate({ plan_price: v });
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Expires on</Label>
            <Input
              type="date"
              value={company.subscription_ends_at ? company.subscription_ends_at.slice(0, 10) : ""}
              onChange={(e) =>
                patch.mutate({
                  subscription_ends_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Grace days</Label>
            <Input
              type="number"
              min={0}
              defaultValue={company.grace_days}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v !== company.grace_days) patch.mutate({ grace_days: v });
              }}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <div className="mb-2 text-sm font-semibold">
            Record payment &amp; renew → extends to {nextEnd.toLocaleDateString()}
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Input
              type="number"
              placeholder={`Amount (${company.plan_price})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["upi", "bank_transfer", "card", "cash", "other"].map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            <Button onClick={() => renew.mutate()} disabled={renew.isPending}>
              {renew.isPending ? "Saving…" : "Renew"}
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold">Payment history</div>
          {payments.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (payments.data ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">No payments recorded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Paid on</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {(payments.data ?? []).map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-3 py-2">{new Date(p.paid_on).toLocaleDateString()}</td>
                      <td className="px-3 py-2 tabular-nums">
                        ₹{Number(p.amount).toLocaleString("en-IN")}
                      </td>
                      <td className="px-3 py-2 capitalize">{p.method?.replace("_", " ") || "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.period_start && p.period_end
                          ? `${new Date(p.period_start).toLocaleDateString()} → ${new Date(p.period_end).toLocaleDateString()}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete payment"
                          onClick={() => removePayment.mutate(p.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
