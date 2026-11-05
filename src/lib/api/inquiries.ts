import { supabase } from "@/integrations/supabase/client";
import { getCompanyId, tryGetCompanyId } from "@/lib/api/company-context";
import { normalizePhone } from "@/lib/format";

export type Inquiry = {
  id: string;
  name: string;
  phone: string;
  vehicle: string | null;
  service: string | null;
  message: string | null;
  source: string;
  status: "new" | "contacted" | "quote_sent" | "follow_up" | "won" | "lost";
  assigned_to: string | null;
  customer_id: string | null;
  contacted_at: string | null;
  follow_up_at: string | null;
  notes: string | null;
  follow_up_count: number;
  last_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function submitInquiry(input: {
  name: string;
  phone: string;
  vehicle?: string;
  service?: string;
  message?: string;
  source?: string;
}): Promise<void> {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new Error("Please enter a valid 10-digit phone number.");
  if (!input.name.trim()) throw new Error("Please enter your name.");
  // Signed-in staff: stamp the tenant explicitly (the DB trigger enforces it too).
  const companyId = await tryGetCompanyId();

  const { data, error } = await supabase
    .from("inquiries" as never)
    .insert({
      ...(companyId ? { company_id: companyId } : {}),
      name: input.name.trim().slice(0, 120),
      phone,
      vehicle: input.vehicle?.trim().slice(0, 80) || null,
      service: input.service?.trim().slice(0, 80) || null,
      message: input.message?.trim().slice(0, 1000) || null,
      source: input.source || "website",
    } as never)
    .select("id");
  if (error) throw error;
  if (companyId && !(data ?? []).length) {
    throw new Error("The lead could not be saved. Please refresh and try again.");
  }
}

export async function listInquiries(status?: Inquiry["status"] | "all"): Promise<Inquiry[]> {
  const companyId = await getCompanyId();
  if (!companyId) return [];


  let q = supabase
    .from("inquiries" as never)
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Inquiry[];
}

export async function updateInquiry(id: string, patch: Partial<Pick<Inquiry, "status" | "notes" | "follow_up_at" | "contacted_at" | "assigned_to">>) {
  const { error } = await supabase.from("inquiries" as never).update(patch as never).eq("id", id);
  if (error) throw error;
}

/** Log one more follow-up attempt against a lead. */
export async function logFollowUp(id: string, nextFollowUpAt?: string | null) {
  const { data: row, error: re } = await supabase
    .from("inquiries" as never)
    .select("follow_up_count, contacted_at")
    .eq("id", id)
    .single();
  if (re) throw re;
  const now = new Date().toISOString();
  const current = Number((row as unknown as { follow_up_count: number | null }).follow_up_count ?? 0);
  const { error } = await supabase
    .from("inquiries" as never)
    .update({
      follow_up_count: current + 1,
      last_follow_up_at: now,
      contacted_at: (row as unknown as { contacted_at: string | null }).contacted_at ?? now,
      ...(nextFollowUpAt !== undefined ? { follow_up_at: nextFollowUpAt } : {}),
    } as never)
    .eq("id", id);
  if (error) throw error;
  return current + 1;
}

export async function getInquiryCounts() {
  const { data, error } = await supabase.from("inquiries" as never).select("status");
  if (error) throw error;
  const out = { new: 0, contacted: 0, quote_sent: 0, follow_up: 0, won: 0, lost: 0, total: 0 } as Record<string, number>;
  for (const r of (data ?? []) as unknown as { status: string }[]) {
    out[r.status] = (out[r.status] ?? 0) + 1;
    out.total += 1;
  }
  return out;
}
