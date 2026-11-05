import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";
import { normalizePhone, normalizeVehicleNumber } from "@/lib/format";

export async function globalSearch(term: string) {
  const s = term.trim();
  if (!s) return { customers: [], vehicles: [], quotes: [], jobs: [], invoices: [] };
  const like = `%${s}%`;
  const asPhone = normalizePhone(s);
  const asReg = normalizeVehicleNumber(s);

  // Harden search with explicit company_id filtering from session metadata
  const companyId = await getCompanyId();

  if (!companyId) {
    return { customers: [], vehicles: [], quotes: [], jobs: [], invoices: [] };
  }

  const customerBase = supabase
    .from("customers")
    .select("id,name,phone")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .limit(10);

  const customerQ = asPhone
    ? customerBase.eq("normalized_phone", asPhone)
    : customerBase.or(`name.ilike.${like},phone.ilike.${like}`);

  const vehicleBase = supabase
    .from("vehicles")
    .select("id,number,customer_id, customer:customers(name)")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .limit(10);

  const vehicleQ = asReg.length >= 4
    ? vehicleBase.eq("normalized_registration", asReg)
    : vehicleBase.ilike("number", like);

  const [customers, vehicles, quotes, jobs, invoices] = await Promise.all([
    customerQ,
    vehicleQ,
    supabase
      .from("quotes")
      .select("id,number,total,status, customer:customers(name)")
      .eq("company_id", companyId)
      .ilike("number", like)
      .is("deleted_at", null)
      .limit(10),
    supabase
      .from("jobs")
      .select("id,number,status, customer:customers(name), vehicle:vehicles(number)")
      .eq("company_id", companyId)
      .ilike("number", like)
      .is("deleted_at", null)
      .limit(10),
    supabase
      .from("invoices")
      .select("id,number,total,status, customer:customers(name)")
      .eq("company_id", companyId)
      .ilike("number", like)
      .is("deleted_at", null)
      .limit(10),
  ]);

  return {
    customers: customers.data ?? [],
    vehicles: vehicles.data ?? [],
    quotes: quotes.data ?? [],
    jobs: jobs.data ?? [],
    invoices: invoices.data ?? [],
  };
}

