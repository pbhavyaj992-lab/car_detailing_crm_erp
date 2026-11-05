import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";

export type MediaRow = {
  id: string;
  vehicle_id: string;
  job_id: string | null;
  quote_id: string | null;
  stage: "pre_work" | "post_work";
  kind: "photo" | "video";
  storage_path: string;
  mime: string | null;
  created_at: string;
};

export async function uploadMediaFile(opts: {
  file: File;
  vehicle_id: string;
  customer_id?: string | null;
  quote_id?: string | null;
  job_id?: string | null;
  stage: "pre_work" | "post_work";
}): Promise<MediaRow> {
  const ext = opts.file.name.split(".").pop()?.toLowerCase() || "bin";
  const kind: "photo" | "video" = opts.file.type.startsWith("video/") ? "video" : "photo";
  const companyId = await getCompanyId();
  const path = `${companyId}/${opts.vehicle_id}/${opts.stage}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("vehicle-media")
    .upload(path, opts.file, { contentType: opts.file.type || undefined, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("media")
    .insert({
      vehicle_id: opts.vehicle_id,
      customer_id: opts.customer_id ?? null,
      quote_id: opts.quote_id ?? null,
      job_id: opts.job_id ?? null,
      stage: opts.stage,
      kind,
      storage_path: path,
      mime: opts.file.type || null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MediaRow;
}

export async function listMediaForVehicle(vehicleId: string): Promise<MediaRow[]> {
  const companyId = await getCompanyId();

  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("company_id", companyId)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MediaRow[];
}

export async function signedMediaUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from("vehicle-media").createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function signedMediaUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("vehicle-media").createSignedUrls(paths, 3600);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r) => {
    if (r.path && r.signedUrl) map[r.path] = r.signedUrl;
  });
  return map;
}
