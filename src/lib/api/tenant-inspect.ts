import { supabase } from "@/integrations/supabase/client";

/**
 * Read-only, company-scoped views of a tenant's CRM data.
 * Used by the super-admin master panel to inspect any business.
 * Protected by RLS (only super_admin can read all companies).
 */


export async function tenantOverview(companyId: string) {
  const [customers, vehicles, jobs, openJobs, quotes, invoices, expenses, revenue, staff] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null).neq("status", "delivered"),
    supabase.from("quotes").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("deleted_at", null),
    supabase.from("expenses").select("amount").eq("company_id", companyId).is("deleted_at", null),
    supabase.from("invoices").select("total,paid_amount").eq("company_id", companyId).is("deleted_at", null),
    supabase.from("user_roles").select("user_id").eq("company_id", companyId),
  ]);

  const invoiceRows = (revenue.data ?? []) as { total: number; paid_amount: number }[];
  const expenseRows = (expenses.data ?? []) as { amount: number }[];

  return {
    customers: customers.count ?? 0,
    vehicles: vehicles.count ?? 0,
    jobs: jobs.count ?? 0,
    openJobs: openJobs.count ?? 0,
    quotes: quotes.count ?? 0,
    invoices: invoices.count ?? 0,
    staff: staff.data?.length ?? 0,
    billed: invoiceRows.reduce((a, r) => a + Number(r.total ?? 0), 0),
    collected: invoiceRows.reduce((a, r) => a + Number(r.paid_amount ?? 0), 0),
    outstanding: invoiceRows.reduce((a, r) => a + (Number(r.total ?? 0) - Number(r.paid_amount ?? 0)), 0),
    expenses: expenseRows.reduce((a, r) => a + Number(r.amount ?? 0), 0),
  };
}

export async function tenantCustomers(companyId: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,email,lead_status,created_at, vehicles:vehicles(id,number,brand,model)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function tenantJobs(companyId: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select("id,number,status,created_at,expected_delivery, customer:customers(name,phone), vehicle:vehicles(number,brand,model)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function tenantQuotes(companyId: string) {
  const { data, error } = await supabase
    .from("quotes")
    .select("id,number,status,total,created_at, customer:customers(name,phone)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function tenantInvoices(companyId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id,number,status,total,paid_amount,issued_at, customer:customers(name,phone)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("issued_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function tenantExpenses(companyId: string) {
  const { data, error } = await supabase
    .from("expenses")
    .select("id,spent_on,category,vendor,amount,payment_method")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("spent_on", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function tenantActivity(companyId: string) {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id,entity,action,summary,actor_name,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
