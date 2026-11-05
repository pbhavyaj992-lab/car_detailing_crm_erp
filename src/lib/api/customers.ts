import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";
import { normalizePhone } from "@/lib/format";

export type Customer = {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
};

export async function lookupCustomerByPhone(phone: string): Promise<Customer | null> {
  const p = normalizePhone(phone);
  if (!p) return null;
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("normalized_phone", p)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data as Customer | null;
}

/**
 * Race-safe, DB-enforced find-or-create.
 * If a customer with the same normalized phone exists, returns it.
 * Otherwise inserts a new row. Never creates a duplicate.
 * The second return value indicates whether the record already existed.
 */
export async function upsertCustomer(input: {
  phone: string;
  name: string;
  email?: string | null;
  address?: string | null;
  source?: string | null;
}): Promise<{ customer: Customer; existed: boolean }> {
  const norm = normalizePhone(input.phone);
  if (!norm) throw new Error("Enter a valid 10-digit phone number");

  const existing = await lookupCustomerByPhone(norm);
  
  // Harden RPC calls with explicit company_id from session metadata
  const companyId = await getCompanyId();

  const { data, error } = await supabase.rpc("find_or_create_customer" as any, {
    _company_id: companyId,
    _phone: input.phone,
    _name: input.name.trim(),
    _email: input.email?.trim() || null,
    _address: input.address?.trim() || null,
    _source: input.source ?? null,
  });
  if (error) throw error;
  return { customer: data as unknown as Customer, existed: !!existing };
}

export type CustomerWithStats = Customer & {
  job_count: number;
  lifetime_spent: number;
  last_visit: string | null;
};

export async function listCustomers(search?: string, limit = 50): Promise<CustomerWithStats[]> {
  const companyId = await getCompanyId();

  let q = supabase
    .from("customers")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (search && search.trim()) {
    const s = search.trim();
    const asPhone = normalizePhone(s);
    if (asPhone) {
      q = q.eq("normalized_phone", asPhone);
    } else {
      q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%`);
    }
  }
  const { data, error } = await q;
  if (error) throw error;
  const customers = (data ?? []) as Customer[];
  if (customers.length === 0) return [];
  const ids = customers.map((c) => c.id);

  const [jobsRes, invRes] = await Promise.all([
    supabase.from("jobs").select("customer_id, created_at").in("customer_id", ids).is("deleted_at", null),
    supabase.from("invoices").select("customer_id, paid_amount").in("customer_id", ids).is("deleted_at", null),
  ]);
  if (jobsRes.error) throw jobsRes.error;
  if (invRes.error) throw invRes.error;

  const jobStats = new Map<string, { count: number; last: string | null }>();
  for (const j of jobsRes.data ?? []) {
    const s = jobStats.get(j.customer_id) ?? { count: 0, last: null };
    s.count += 1;
    if (!s.last || (j.created_at && j.created_at > s.last)) s.last = j.created_at;
    jobStats.set(j.customer_id, s);
  }
  const spent = new Map<string, number>();
  for (const i of invRes.data ?? []) {
    spent.set(i.customer_id, (spent.get(i.customer_id) ?? 0) + Number(i.paid_amount ?? 0));
  }

  return customers.map((c) => ({
    ...c,
    job_count: jobStats.get(c.id)?.count ?? 0,
    last_visit: jobStats.get(c.id)?.last ?? null,
    lifetime_spent: spent.get(c.id) ?? 0,
  }));
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Customer | null;
}

/** Admin: list customer groups that collide on normalized_phone (potential merges). */
export async function listDuplicateCustomerGroups(): Promise<
  { normalized_phone: string; customers: Customer[] }[]
> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .is("deleted_at", null)
    .not("normalized_phone", "is", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const groups = new Map<string, Customer[]>();
  for (const c of (data ?? []) as Customer[]) {
    const key = (c as any).normalized_phone as string;
    if (!key || key.includes("_")) continue; // skip already-renamed dupes/merged
    const arr = groups.get(key) ?? [];
    arr.push(c);
    groups.set(key, arr);
  }
  return [...groups.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([normalized_phone, customers]) => ({ normalized_phone, customers }));
}

/**
 * Rename a customer (the name shown on quotations, invoices and jobs).
 * The `trg_customers_activity` trigger records the before/after value,
 * the actor and the timestamp in the activity log automatically.
 */
export async function renameCustomer(id: string, name: string, reason?: string | null) {
  const next = name.trim();
  if (!next) throw new Error("Enter a customer name");

  const { data: current, error: readErr } = await supabase
    .from("customers")
    .select("id, name, notes")
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!current) throw new Error("Customer not found");
  if ((current.name ?? "").trim() === next) return;

  const patch: { name: string; notes?: string } = { name: next };
  if (reason && reason.trim()) {
    const stamp = new Date().toISOString().slice(0, 10);
    const note = `[Name changed ${stamp}] ${current.name} → ${next}: ${reason.trim()}`;
    patch.notes = `${current.notes ? `${current.notes}\n` : ""}${note}`;
  }

  const { error } = await supabase.from("customers").update(patch as never).eq("id", id);
  if (error) throw error;
}
