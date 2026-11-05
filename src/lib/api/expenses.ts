import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";

export type Expense = {
  id: string;
  spent_on: string;
  category: string;
  vendor: string | null;
  amount: number;
  tax_amount: number;
  payment_method: string | null;
  notes: string | null;
  bill_path: string | null;
  created_at: string;
};

export const EXPENSE_CATEGORIES = [
  "Supplies",
  "Rent",
  "Utilities",
  "Salaries",
  "Marketing",
  "Equipment",
  "Maintenance",
  "Travel",
  "Software",
  "Payment Adjustment",
  "Other",
] as const;

export function financialYearRange(fy: number): { from: string; to: string; label: string } {
  // Indian FY: Apr fy -> Mar fy+1
  const from = `${fy}-04-01`;
  const to = `${fy + 1}-03-31`;
  return { from, to, label: `FY ${fy}-${String(fy + 1).slice(-2)}` };
}

export function currentFinancialYear(): number {
  const d = new Date();
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

export async function listExpenses(fy: number): Promise<Expense[]> {
  const companyId = await getCompanyId();

  const { from, to } = financialYearRange(fy);
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("company_id", companyId)
    .gte("spent_on", from)
    .lte("spent_on", to)
    .order("spent_on", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function createExpense(input: {
  spent_on: string;
  category: string;
  vendor?: string;
  amount: number;
  tax_amount?: number;
  payment_method?: string;
  notes?: string;
  bill?: File | null;
}): Promise<Expense> {
  let bill_path: string | null = null;
  if (input.bill) {
    const ext = input.bill.name.split(".").pop() ?? "bin";
    const companyId = await getCompanyId();
    const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
    const up = await supabase.storage.from("expense-bills").upload(path, input.bill, {
      contentType: input.bill.type || undefined,
    });
    if (up.error) throw up.error;
    bill_path = up.data.path;
  }
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      spent_on: input.spent_on,
      category: input.category,
      vendor: input.vendor ?? null,
      amount: input.amount,
      tax_amount: input.tax_amount ?? 0,
      payment_method: input.payment_method ?? null,
      notes: input.notes ?? null,
      bill_path,
      created_by: user.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string, bill_path?: string | null): Promise<void> {
  if (bill_path) {
    await supabase.storage.from("expense-bills").remove([bill_path]);
  }
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function getBillSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("expense-bills").createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

export function exportExpensesCsv(rows: Expense[], label: string) {
  const header = ["Date", "Category", "Vendor", "Amount", "Tax", "Payment", "Notes"];
  const lines = rows.map((r) =>
    [
      r.spent_on,
      r.category,
      r.vendor ?? "",
      r.amount,
      r.tax_amount,
      r.payment_method ?? "",
      (r.notes ?? "").replace(/[\r\n,]+/g, " "),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${label.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
