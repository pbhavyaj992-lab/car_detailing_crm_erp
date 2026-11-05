import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";
import { computeMoneyTotals } from "@/lib/billing/calculations";

export type QuoteItemInput = {
  service_id?: string | null;
  name: string;
  qty: number;
  unit_price: number;
};

export type QuoteInput = {
  customer_id: string;
  vehicle_id?: string | null;
  context: "at_garage" | "inquiry_only";
  items: QuoteItemInput[];
  discount: number;
  tax_rate: number;
  notes?: string;
};

export async function createQuote(input: QuoteInput) {
  const totals = computeMoneyTotals(input.items, input.discount, input.tax_rate);
  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      customer_id: input.customer_id,
      vehicle_id: input.vehicle_id ?? null,
      context: input.context,
      discount: input.discount,
      tax_rate: input.tax_rate,
      subtotal: totals.subtotal,
      tax_amount: totals.tax_amount,
      total: totals.total,
      notes: input.notes ?? null,
      status: "draft",
    } as never)
    .select("*")
    .single();
  if (error) throw error;

  if (input.items.length) {
    const rows = input.items.map((i, idx) => ({
      quote_id: quote.id,
      service_id: i.service_id ?? null,
      name: i.name,
      qty: i.qty,
      unit_price: i.unit_price,
      amount: +(i.qty * i.unit_price).toFixed(2),
      sort_order: idx,
    }));
    const { error: e2 } = await supabase.from("quote_items").insert(rows as never);
    if (e2) throw e2;
  }
  return quote;
}

export async function listQuotes(opts: { status?: string; customer_id?: string; limit?: number } = {}) {
  const companyId = await getCompanyId();

  let q = supabase
    .from("quotes")
    .select("*, customer:customers(id,name,phone), vehicle:vehicles(id,number)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50);

  if (opts.status) q = q.eq("status", opts.status as any);
  if (opts.customer_id) q = q.eq("customer_id", opts.customer_id);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getQuote(id: string) {
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "*, customer:customers(*), vehicle:vehicles(*), items:quote_items(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function approveQuote(id: string) {
  const { error } = await supabase
    .from("quotes")
    .update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelQuote(id: string) {
  const { error } = await supabase.from("quotes").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

export async function convertQuoteToJob(quoteId: string) {
  const q = await getQuote(quoteId);
  if (!q) throw new Error("Quote not found");
  if (!q.vehicle_id) throw new Error("Quote has no vehicle; cannot create a job");
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      quote_id: q.id,
      customer_id: q.customer_id,
      vehicle_id: q.vehicle_id,
      status: "received",
    } as never)
    .select("*")
    .single();
  if (error) throw error;
  await supabase.from("quotes").update({ status: "converted" }).eq("id", q.id);
  return job;
}
