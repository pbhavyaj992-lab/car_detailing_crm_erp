import { supabase } from "@/integrations/supabase/client";

let cachedUserId: string | null = null;
let cachedCompanyId: string | null = null;
let inFlight: Promise<string> | null = null;

export function clearCompanyIdCache() {
  cachedUserId = null;
  cachedCompanyId = null;
  inFlight = null;
}

async function resolve(): Promise<string> {
  const { data: userData, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = userData.user;
  if (!user) throw new Error("You are signed out. Please sign in again.");

  if (cachedUserId !== user.id) clearCompanyIdCache();
  if (cachedCompanyId) return cachedCompanyId;

  // 1) Fast path: JWT / user metadata
  let companyId = (user.user_metadata?.company_id as string | undefined) ?? null;

  // 2) Fallback: role record
  if (!companyId) {
    const { data } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    companyId = (data?.company_id as string | null) ?? null;
  }

  // 3) Fallback: profile record
  if (!companyId) {
    const { data } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .maybeSingle();
    companyId = (data?.company_id as string | null) ?? null;
  }

  if (!companyId) {
    throw new Error(
      "No business is linked to your account yet. Ask an administrator to assign you to a business.",
    );
  }

  cachedUserId = user.id;
  cachedCompanyId = companyId;
  return companyId;
}

/** Resolves the current user's business id, with role/profile fallback. */
export async function getCompanyId(): Promise<string> {
  if (cachedCompanyId) return cachedCompanyId;
  if (!inFlight) {
    inFlight = resolve().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Same as getCompanyId but returns null instead of throwing. */
export async function tryGetCompanyId(): Promise<string | null> {
  try {
    return await getCompanyId();
  } catch {
    return null;
  }
}
