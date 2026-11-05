import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";
import { normalizeVehicleNumber } from "@/lib/format";

export type Vehicle = {
  id: string;
  customer_id: string;
  number: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  fuel_type: string | null;
  notes: string | null;
  created_at: string;
};

export async function listVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
  const companyId = await getCompanyId();

  const { data, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("company_id", companyId)
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Vehicle[];
}

/**
 * DB-enforced find-or-create. Never creates a duplicate for a given company
 * + normalized registration.
 */
export async function createVehicle(input: {
  customer_id: string;
  number: string;
  brand?: string;
  model?: string;
  color?: string;
  fuel_type?: string;
  notes?: string;
}): Promise<Vehicle> {
  const norm = normalizeVehicleNumber(input.number);
  if (!norm || norm.length < 4) throw new Error("Enter a valid vehicle registration");
  const companyId = await getCompanyId();

  const { data, error } = await supabase.rpc("find_or_create_vehicle" as any, {
    _company_id: companyId,
    _customer_id: input.customer_id,
    _number: input.number,
    _brand: input.brand?.trim() || null,
    _model: input.model?.trim() || null,
    _color: input.color?.trim() || null,
    _fuel_type: input.fuel_type?.trim() || null,
  });
  if (error) throw error;
  return data as unknown as Vehicle;
}

export async function getVehicle(id: string) {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, customer:customers(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findVehicleByNumber(num: string) {
  const n = normalizeVehicleNumber(num);
  if (!n) return null;
  const { data, error } = await supabase
    .from("vehicles")
    .select("*, customer:customers(*)")
    .eq("normalized_registration", n)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}
