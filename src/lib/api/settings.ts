import { supabase } from "@/integrations/supabase/client";

export type Settings = {
  business_name: string;
  gstin: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  default_tax_rate: number;
  currency: string;
  quote_prefix: string;
  job_prefix: string;
  invoice_prefix: string;
};

export async function getSettings(): Promise<Settings | null> {
  const { data, error } = await supabase.from("settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return data as Settings | null;
}

export async function updateSettings(patch: Partial<Settings>) {
  const { data: existing } = await supabase.from("settings").select("company_id").limit(1).maybeSingle();
  if (!existing) throw new Error("Settings row missing");
  const { error } = await supabase.from("settings").update(patch as never).eq("company_id", (existing as any).company_id);
  if (error) throw error;
}

export async function listStaff() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .order("full_name");
  if (error) throw error;
  const { data: roles } = await supabase.from("user_roles").select("user_id, role");
  const { data: perms } = await supabase.from("user_permissions").select("user_id, permission_key, granted");
  const rolesByUser: Record<string, string[]> = {};
  (roles ?? []).forEach((r) => {
    rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] ?? []), r.role];
  });
  const permsByUser: Record<string, Record<string, boolean>> = {};
  (perms ?? []).forEach((p) => {
    if (!permsByUser[p.user_id]) permsByUser[p.user_id] = {};
    permsByUser[p.user_id][p.permission_key] = p.granted;
  });
  return (profiles ?? []).map((p) => ({
    ...p,
    roles: rolesByUser[p.id] ?? [],
    permission_overrides: permsByUser[p.id] ?? {},
  }));
}
