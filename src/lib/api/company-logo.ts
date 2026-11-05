import { supabase } from "@/integrations/supabase/client";

export const LOGO_BUCKET = "company-logos";
const PREFIX = "storage:";

/** Upload a logo image/pdf and return a stored reference ("storage:<path>"). */
export async function uploadCompanyLogo(file: File, companySlug = "company"): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${companySlug}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return `${PREFIX}${path}`;
}

/** Resolve a stored logo reference to a displayable URL (signed for private storage). */
export async function resolveLogoUrl(value?: string | null): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;
  const path = value.slice(PREFIX.length);
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function isStoredLogo(value?: string | null) {
  return !!value && value.startsWith(PREFIX);
}
