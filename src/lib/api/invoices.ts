import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";
import { computeMoneyTotals, computeInvoiceBalance } from "@/lib/billing/calculations";

export type InvoiceItemInput = {
  name: string;
  qty: number;
  unit_price: number;
};

export async function createInvoiceFromJob(jobId: string): Promise<string> {
  const { data: job, error: je } = await supabase
    .from("jobs")
    .select("*, quote:quotes(*, items:quote_items(*))")
    .eq("id", jobId)
    .single();
  if (je) throw je;
  if (!job.quote) throw new Error("Job has no linked quote");
  const q = job.quote as {
    subtotal: number; discount: number; tax_rate: number; tax_amount: number; total: number;
    items: { name: string; qty: number; unit_price: number; amount: number }[];
  };
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      job_id: job.id,
      customer_id: job.customer_id,
      vehicle_id: job.vehicle_id,
      subtotal: q.subtotal,
      discount: q.discount,
      tax_rate: q.tax_rate,
      tax_amount: q.tax_amount,
      total: q.total,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  if (q.items?.length) {
    await supabase.from("invoice_items").insert(
      q.items.map((i, idx) => ({
        invoice_id: inv.id,
        name: i.name,
        qty: i.qty,
        unit_price: i.unit_price,
        amount: i.amount,
        sort_order: idx,
      })) as never,
    );
  }
  return inv.id;
}

export async function getInvoice(id: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "*, customer:customers(*), vehicle:vehicles(*), job:jobs(id,number), items:invoice_items(*), payments(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listInvoices(opts: { status?: string; limit?: number } = {}) {
  const companyId = await getCompanyId();

  let q = supabase
    .from("invoices")
    .select("*, customer:customers(id,name,phone), vehicle:vehicles(id,number)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.status) q = q.eq("status", opts.status as any);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function recordPayment(input: {
  invoice_id: string;
  amount: number;
  method: "cash" | "upi" | "card" | "bank_transfer" | "other";
  reference?: string;
}) {
  const { error } = await supabase.from("payments").insert(input);
  if (error) throw error;
  // The DB trigger keeps invoices.paid_amount/status in sync. This is a safe,
  // idempotent reconciliation so a backend without that trigger still stays correct.
  await syncInvoicePaidState(input.invoice_id);
}

/** Recompute invoices.paid_amount/status from the actual payment rows. */
export async function syncInvoicePaidState(invoiceId: string) {
  const { data: inv, error } = await supabase
    .from("invoices")
    .select("id, total, paid_amount, adjustment_amount, status, payments(amount)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error || !inv) return;

  const paid = +(((inv as any).payments ?? []).reduce(
    (s: number, p: any) => s + (Number(p.amount) || 0),
    0,
  )).toFixed(2);
  const total = Number(inv.total) || 0;
  const adjustment = Number((inv as any).adjustment_amount ?? 0) || 0;

  const status =
    inv.status === "cancelled"
      ? inv.status
      : paid + adjustment >= total && total > 0
        ? "paid"
        : paid > 0
          ? "partial"
          : "unpaid";

  if (Number(inv.paid_amount ?? 0) === paid && inv.status === status) return;
  await supabase
    .from("invoices")
    .update({ paid_amount: paid, status } as never)
    .eq("id", invoiceId);
}


/**
 * Record a payment and optionally write off the small shortfall
 * (e.g. customer pays 520 on a 522 bill) so the invoice closes as fully paid.
 * The written-off amount is stored on the invoice and mirrored into expenses.
 */
export async function settlePayment(input: {
  invoice_id: string;
  amount: number;
  method: "cash" | "upi" | "card" | "bank_transfer" | "other";
  reference?: string;
  adjustShortfall?: boolean;
  adjustment_note?: string | null;
}): Promise<{ adjusted: number; expenseFailed?: boolean }> {
  const { data: inv, error: ie } = await supabase
    .from("invoices")
    .select("id, number, total, paid_amount, adjustment_amount, payments(amount)")
    .eq("id", input.invoice_id)
    .single();
  if (ie) throw ie;

  await recordPayment({
    invoice_id: input.invoice_id,
    amount: input.amount,
    method: input.method,
    reference: input.reference,
  });

  if (!input.adjustShortfall) return { adjusted: 0 };

  // Payments are the source of truth; paid_amount can lag behind.
  const paidBefore = Math.max(
    Number(inv.paid_amount ?? 0) || 0,
    ((inv as any).payments ?? []).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0),
  );
  const paidAfter = paidBefore + Number(input.amount);
  const shortfall = computeInvoiceBalance(inv.total, paidAfter, (inv as any).adjustment_amount);
  if (shortfall <= 0) return { adjusted: 0 };


  const note = input.adjustment_note?.trim() || "Short payment adjusted at settlement";
  const { error: ue } = await supabase
    .from("invoices")
    .update({
      adjustment_amount: Number((inv as any).adjustment_amount ?? 0) + shortfall,
      adjustment_note: note,
    } as never)
    .eq("id", input.invoice_id);
  if (ue) throw ue;
  await syncInvoicePaidState(input.invoice_id);



  let expenseFailed = false;
  const { error: ee } = await supabase.from("expenses").insert({
    spent_on: new Date().toISOString().slice(0, 10),
    category: PAYMENT_ADJUSTMENT_CATEGORY,
    vendor: `Invoice ${inv.number}`,
    amount: shortfall,
    tax_amount: 0,
    payment_method: input.method,
    notes: `${note} · Invoice ${inv.number}`,
  } as never);
  if (ee) expenseFailed = true;

  return { adjusted: shortfall, expenseFailed };
}

export const PAYMENT_ADJUSTMENT_CATEGORY = "Payment Adjustment";


export type InvoiceEditItem = {
  id?: string;
  name: string;
  qty: number;
  unit_price: number;
};

export type InvoiceEditInput = {
  invoice_id: string;
  items: InvoiceEditItem[];
  discount: number;
  tax_rate: number;
  notes?: string | null;
  issued_at?: string;
  edit_reason: string;
};

/** Owner/Super-admin edit. Trigger `tg_write_activity` auto-logs field-level diffs. */
export async function updateInvoice(input: InvoiceEditInput) {
  const items = input.items.map((it, idx) => ({
    ...it,
    qty: Number(it.qty) || 0,
    unit_price: Number(it.unit_price) || 0,
    amount: +(Number(it.qty) * Number(it.unit_price)).toFixed(2),
    sort_order: idx,
  }));
  const totals = computeMoneyTotals(input.items, input.discount, input.tax_rate);
  const { subtotal, discount, tax_rate, tax_amount, total } = totals;

  // Replace items (delete + insert). Triggers log each row change.
  const { error: delErr } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", input.invoice_id);
  if (delErr) throw delErr;

  if (items.length) {
    const { error: insErr } = await supabase.from("invoice_items").insert(
      items.map((it) => ({
        invoice_id: input.invoice_id,
        name: it.name,
        qty: it.qty,
        unit_price: it.unit_price,
        amount: it.amount,
        sort_order: it.sort_order,
      })) as never,
    );
    if (insErr) throw insErr;
  }

  const notesWithReason = `${input.notes ?? ""}${input.notes ? "\n" : ""}[Edit ${new Date().toISOString().slice(0,10)}] ${input.edit_reason}`.trim();

  const { error: upErr } = await supabase
    .from("invoices")
    .update({
      subtotal,
      discount,
      tax_rate,
      tax_amount,
      total,
      notes: notesWithReason,
      ...(input.issued_at ? { created_at: input.issued_at } : {}),
    } as never)
    .eq("id", input.invoice_id);
  if (upErr) throw upErr;
}

export async function voidInvoice(invoiceId: string, reason: string) {
  const { error } = await supabase
    .from("invoices")
    .update({
      status: "cancelled",
      notes: `[Voided ${new Date().toISOString().slice(0,10)}] ${reason}`,
    } as never)
    .eq("id", invoiceId);
  if (error) throw error;
}
