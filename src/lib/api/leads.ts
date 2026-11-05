import { supabase } from "@/integrations/supabase/client";
import type { CustomerSource, LeadStatus } from "@/lib/format";

export async function updateCustomerLead(id: string, patch: {
  source?: CustomerSource | null;
  lead_status?: LeadStatus;
  follow_up_at?: string | null;
  last_contacted_at?: string | null;
}) {
  const { error } = await supabase.from("customers").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function listFollowUps(): Promise<{ id: string; name: string; phone: string; follow_up_at: string }[]> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, phone, follow_up_at")
    .not("follow_up_at", "is", null)
    .lte("follow_up_at", today.toISOString())
    .order("follow_up_at", { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as never;
}

export async function mergeCustomers(sourceId: string, targetId: string) {
  const { error } = await supabase.rpc("merge_customers" as never, { _source: sourceId, _target: targetId } as never);
  if (error) throw error;
}
