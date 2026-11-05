import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/lib/api/companies";

/** The company the signed-in user belongs to. */
export async function getMyCompany(): Promise<Company | null> {
  const { data: companyId, error: idErr } = await supabase.rpc("current_company_id" as any);
  if (idErr) throw idErr;
  if (!companyId) return null;
  const { data, error } = await supabase.from("companies").select("*").eq("id", companyId as string).maybeSingle();
  if (error) throw error;
  return (data ?? null) as Company | null;
}

export type MyCompanyPatch = Partial<
  Pick<Company, "name" | "logo_url" | "contact_name" | "contact_email" | "contact_phone" | "address">
>;

/** Owners/managers can update their own business profile (not plan or subscription). */
export async function updateMyCompany(id: string, patch: MyCompanyPatch) {
  const { error } = await supabase.from("companies").update(patch as never).eq("id", id);
  if (error) throw error;
}
