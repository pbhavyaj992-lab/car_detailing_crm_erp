import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";
import type { JobStatus } from "@/lib/format";

export async function listJobs(opts: { status?: JobStatus | JobStatus[]; limit?: number } = {}) {
  const companyId = await getCompanyId();

  let q = supabase
    .from("jobs")
    .select("*, customer:customers(id,name,phone), vehicle:vehicles(id,number,brand,model), quote:quotes(id,number,total,subtotal,discount,tax_amount,items:quote_items(*))")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.status) {
    if (Array.isArray(opts.status)) q = q.in("status", opts.status);
    else q = q.eq("status", opts.status);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function getJob(id: string) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "*, customer:customers(*), vehicle:vehicles(*), quote:quotes(*, items:quote_items(*)), events:job_status_events(*)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateJobStatus(id: string, status: JobStatus) {
  const { error } = await supabase.from("jobs").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function assignJobStaff(id: string, userIds: string[]) {
  const { error } = await supabase.from("jobs").update({ assigned_to: userIds }).eq("id", id);
  if (error) throw error;
}

export async function setExpectedDelivery(id: string, iso: string | null) {
  const { error } = await supabase.from("jobs").update({ expected_delivery: iso }).eq("id", id);
  if (error) throw error;
}

export async function setDeliveryNotes(id: string, notes: string) {
  const { error } = await supabase.from("jobs").update({ delivery_notes: notes } as never).eq("id", id);
  if (error) throw error;
}

export async function addJobNote(id: string, note: string) {
  const { error } = await supabase.from("job_status_events").insert({ job_id: id, note } as never);
  if (error) throw error;
}

export async function garageBoard() {
  return listJobs({ status: ["received", "inspection", "work_started", "quality_check", "ready"] });
}

