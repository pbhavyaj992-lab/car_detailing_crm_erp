import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";

export type Service = {
  id: string;
  name: string;
  price: number;
  active: boolean;
  sort_order: number;
};

export async function listServices(): Promise<Service[]> {
  const companyId = await getCompanyId();

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function listAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function upsertService(input: Partial<Service> & { name: string; price: number }) {
  const { data, error } = await supabase.from("services").upsert(input).select("*").single();
  if (error) throw error;
  return data as Service;
}

export async function deleteService(id: string) {
  const { error } = await supabase.from("services").update({ active: false }).eq("id", id);
  if (error) throw error;
}
