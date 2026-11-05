import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, Plus, Download, Trash2, Paperclip, IndianRupee, Receipt, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AccessDenied } from "@/components/access-denied";
import { useRoles } from "@/hooks/use-session";
import { formatINR, formatDate } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  createExpense,
  currentFinancialYear,
  deleteExpense,
  exportExpensesCsv,
  financialYearRange,
  getBillSignedUrl,
  listExpenses,
  type Expense,
} from "@/lib/api/expenses";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { canFinance, isReady } = useRoles();
  const qc = useQueryClient();
  const [fy, setFy] = useState<number>(currentFinancialYear());
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["expenses", fy],
    queryFn: () => listExpenses(fy),
    enabled: canFinance,
  });

  const del = useMutation({
    mutationFn: (e: Expense) => deleteExpense(e.id, e.bill_path),
    onSuccess: () => {
      toast.success("Expense removed");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
  });

  const totals = useMemo(() => {
    const rows = q.data ?? [];
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const tax = rows.reduce((s, r) => s + Number(r.tax_amount), 0);
    const byCat: Record<string, number> = {};
    rows.forEach((r) => (byCat[r.category] = (byCat[r.category] ?? 0) + Number(r.amount)));
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, tax, count: rows.length, top };
  }, [q.data]);

  if (!isReady) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!canFinance) return <AccessDenied message="Expenses are limited to owners, managers and reception." />;

  const fyRange = financialYearRange(fy);
  const years = Array.from({ length: 5 }, (_, i) => currentFinancialYear() - i);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expenses"
        subtitle="Track business expenses and export for ITR filing."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={String(fy)} onValueChange={(v) => setFy(Number(v))}>
              <SelectTrigger className="h-10 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {financialYearRange(y).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => exportExpensesCsv(q.data ?? [], fyRange.label)}
              disabled={!q.data?.length}
            >
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="h-10">
                  <Plus className="mr-2 h-4 w-4" /> New expense
                </Button>
              </DialogTrigger>
              <NewExpenseDialog onDone={() => setOpen(false)} />
            </Dialog>
          </div>
        }
      />

      <div className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={fyRange.label} value={formatINR(totals.total)} icon={IndianRupee} tone="emerald" />
        <StatCard label="Tax component" value={formatINR(totals.tax)} icon={TrendingUp} tone="violet" />
        <StatCard label="Entries" value={totals.count} icon={Receipt} tone="blue" />
        <StatCard
          label="Avg / entry"
          value={formatINR(totals.count ? totals.total / totals.count : 0)}
          icon={Wallet}
          tone="amber"
        />
      </div>

      {totals.top.length > 0 && (
        <Card className="p-4 md:p-6">
          <h2 className="mb-3 text-base font-semibold tracking-tight">Top categories</h2>
          <div className="space-y-2">
            {totals.top.map(([cat, amt]) => {
              const pct = totals.total ? (amt / totals.total) * 100 : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{cat}</span>
                    <span className="text-muted-foreground">{formatINR(amt)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {q.isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading…</div>
        ) : !q.data?.length ? (
          <EmptyState icon={Wallet} title="No expenses yet" description={`Add your first expense for ${fyRange.label}.`} />
        ) : (
          <div className="divide-y">
            {q.data.map((e) => (
              <ExpenseRow key={e.id} expense={e} onDelete={() => del.mutate(e)} deleting={del.isPending} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function ExpenseRow({ expense, onDelete, deleting }: { expense: Expense; onDelete: () => void; deleting: boolean }) {
  async function openBill() {
    if (!expense.bill_path) return;
    const url = await getBillSignedUrl(expense.bill_path);
    if (url) window.open(url, "_blank");
    else toast.error("Could not open bill");
  }
  return (
    <div className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">{expense.category}</span>
          <span className="text-sm font-medium">{expense.vendor ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{formatDate(expense.spent_on)}</span>
        </div>
        {expense.notes && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{expense.notes}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-semibold">{formatINR(expense.amount)}</div>
          {Number(expense.tax_amount) > 0 && (
            <div className="text-[11px] text-muted-foreground">+{formatINR(expense.tax_amount)} tax</div>
          )}
        </div>
        {expense.bill_path && (
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={openBill} aria-label="View bill">
            <Paperclip className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NewExpenseDialog({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const [spent_on, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("");
  const [payment, setPayment] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [bill, setBill] = useState<File | null>(null);

  const create = useMutation({
    mutationFn: () =>
      createExpense({
        spent_on,
        category,
        vendor: vendor || undefined,
        amount: Number(amount) || 0,
        tax_amount: Number(tax) || 0,
        payment_method: payment,
        notes: notes || undefined,
        bill,
      }),
    onSuccess: () => {
      toast.success("Expense recorded");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      onDone();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>New expense</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={spent_on} onChange={(e) => setSpentOn(e.target.value)} />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Vendor (optional)</Label>
          <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Vendor name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Amount</Label>
            <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>Tax (optional)</Label>
            <Input type="number" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div>
          <Label>Payment method</Label>
          <Select value={payment} onValueChange={setPayment}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="bank_transfer">Bank transfer</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Attach bill (optional)</Label>
          <Input type="file" accept="image/*,application/pdf" onChange={(e) => setBill(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={create.isPending}>Cancel</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending || !amount}>
          {create.isPending ? "Saving…" : "Save expense"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
