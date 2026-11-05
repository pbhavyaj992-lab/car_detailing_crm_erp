import { supabase } from "@/integrations/supabase/client";

export type Company = {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  status: string;
  logo_url: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  notes: string | null;
  seats: number;
  trial_ends_at: string | null;
  billing_cycle: string;
  plan_price: number;
  currency: string;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  grace_days: number;
  
  created_at: string;
  updated_at: string;
};

export type PlatformPlan = {
  id: string;
  name: string;
  price: number;
  seats: number;
  features: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PlatformPlanInput = Partial<Omit<PlatformPlan, "id" | "created_at" | "updated_at">> & {
  name: string;
};

export type CompanyInput = Partial<Omit<Company, "id" | "created_at" | "updated_at">> & {
  name: string;
  slug: string;
};

export type CompanyPayment = {
  id: string;
  company_id: string;
  amount: number;
  currency: string;
  paid_on: string;
  method: string | null;
  reference: string | null;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_at: string;
};


export type PlatformStats = {
  companies_total: number;
  companies_active: number;
  users_total: number;
  customers_total: number;
  jobs_total: number;
  jobs_open: number;
  invoices_total: number;
  revenue_total: number;
  signups_30d: number;
  per_company: {
    id: string;
    name: string;
    users: number;
    customers: number;
    jobs: number;
    revenue: number;
  }[];
};

export const PLAN_TIERS = ["starter", "growth", "pro", "enterprise"] as const;
export const COMPANY_STATUSES = ["active", "trial", "suspended", "cancelled"] as const;

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function listCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .insert(input as any)
    .select("*")
    .single();
  if (error) throw error;
  const company = data as Company;

  // Give the new tenant its own business settings row.
  const { error: settingsError } = await supabase.from("settings").insert({
    company_id: company.id,
    business_name: company.name,
    email: company.contact_email,
    phone: company.contact_phone,
    address: company.address,
  } as never);
  if (settingsError && !String(settingsError.message).toLowerCase().includes("duplicate")) {
    throw settingsError;
  }
  return company;
}

export async function updateCompany(id: string, patch: Partial<CompanyInput>) {
  const { error } = await supabase.from("companies").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteCompany(id: string) {
  const { error } = await supabase.rpc("delete_company_completely", { _company_id: id });
  if (error) throw error;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const { data, error } = await supabase.rpc("platform_stats" as any);
  if (error) throw error;
  return data as unknown as PlatformStats;
}

export const BILLING_CYCLES = ["monthly", "quarterly", "yearly"] as const;

export function cycleMonths(cycle: string) {
  return cycle === "yearly" ? 12 : cycle === "quarterly" ? 3 : 1;
}

/** Add one billing period to a date (defaults to today / current expiry). */
export function addCycle(from: Date, cycle: string) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + cycleMonths(cycle));
  return d;
}

export function subscriptionState(c: Company) {
  if (c.status === "suspended" || c.status === "cancelled") return "inactive" as const;
  const now = Date.now();
  const start = c.subscription_started_at ? new Date(c.subscription_started_at).getTime() : null;
  if (start !== null && Number.isFinite(start) && now < start) return "inactive" as const;

  const effectiveEnd = c.subscription_ends_at ?? (c.status === "trial" ? c.trial_ends_at : null);
  if (!effectiveEnd) return "active" as const;
  const end = new Date(effectiveEnd).getTime();
  if (!Number.isFinite(end)) return "inactive" as const;
  const grace = end + (c.grace_days ?? 0) * 86400000;
  if (now > grace) return "expired" as const;
  if (now > end) return "grace" as const;
  if (end - now < 7 * 86400000) return "due_soon" as const;
  return "active" as const;
}

export function isSubscriptionActive(c: Company) {
  const state = subscriptionState(c);
  return state === "active" || state === "due_soon" || state === "grace";
}

export async function listCompanyPayments(companyId: string): Promise<CompanyPayment[]> {
  const { data, error } = await supabase
    .from("company_payments")
    .select("*")
    .eq("company_id", companyId)
    .order("paid_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CompanyPayment[];
}

export async function addCompanyPayment(input: {
  company_id: string;
  amount: number;
  currency?: string;
  paid_on: string;
  method?: string | null;
  reference?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  notes?: string | null;
}) {
  const { error } = await supabase.from("company_payments").insert(input as any);
  if (error) throw error;
}

export async function deleteCompanyPayment(id: string) {
  const { error } = await supabase.from("company_payments").delete().eq("id", id);
  if (error) throw error;
}

/** Record a payment and extend the subscription by one billing cycle. */
export async function renewSubscription(company: Company, opts: { amount: number; method?: string; reference?: string }) {
  const current = company.subscription_ends_at ? new Date(company.subscription_ends_at) : new Date();
  const start = current.getTime() > Date.now() ? current : new Date();
  const end = addCycle(start, company.billing_cycle);
  await addCompanyPayment({
    company_id: company.id,
    amount: opts.amount,
    currency: company.currency,
    paid_on: new Date().toISOString().slice(0, 10),
    method: opts.method ?? null,
    reference: opts.reference ?? null,
    period_start: start.toISOString().slice(0, 10),
    period_end: end.toISOString().slice(0, 10),
  });
  await updateCompany(company.id, {
    subscription_started_at: company.subscription_started_at ?? new Date().toISOString(),
    subscription_ends_at: end.toISOString(),
    status: company.status === "suspended" || company.status === "cancelled" ? "active" : company.status,
  });
  return end;
}

export async function listPlatformPlans(): Promise<PlatformPlan[]> {
  const { data, error } = await supabase
    .from("platform_plans" as any)
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PlatformPlan[];
}

export async function createPlatformPlan(input: PlatformPlanInput): Promise<PlatformPlan> {
  const { data, error } = await supabase
    .from("platform_plans" as any)
    .insert(input as any)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as PlatformPlan;
}

export async function updatePlatformPlan(id: string, patch: Partial<PlatformPlanInput>) {
  const { error } = await supabase.from("platform_plans" as any).update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deletePlatformPlan(id: string) {
  const { error } = await supabase.from("platform_plans" as any).update({ is_active: false } as any).eq("id", id);
  if (error) throw error;
}
