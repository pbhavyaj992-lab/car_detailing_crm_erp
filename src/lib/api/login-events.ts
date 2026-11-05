import { supabase } from "@/integrations/supabase/client";
import { tryGetCompanyId } from "@/lib/api/company-context";

export type LoginEvent = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  event_type: string;
  created_at: string;
};

function parseUA(ua: string) {
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";
  let browser = "Unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "Unknown";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod|iOS/.test(ua)) os = "iOS";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { device, browser, os };
}

async function fetchGeo(): Promise<Partial<LoginEvent>> {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!res.ok) return {};
    const j = await res.json();
    return {
      ip_address: j.ip ?? null,
      country: j.country_name ?? null,
      region: j.region ?? null,
      city: j.city ?? null,
      latitude: j.latitude ?? null,
      longitude: j.longitude ?? null,
    };
  } catch {
    return {};
  }
}

export async function recordLoginEvent(eventType: "sign_in" | "sign_up" = "sign_in") {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return;
    const companyId = await tryGetCompanyId();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const { device, browser, os } = parseUA(ua);
    const geo = await fetchGeo();
    let name: string | null = (user.user_metadata?.full_name as string) ?? null;
    if (!name) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      name = prof?.full_name ?? null;
    }
    await supabase.from("login_events" as any).insert({
      company_id: companyId,
      user_id: user.id,
      user_email: user.email ?? null,
      user_name: name,
      user_agent: ua,
      device_type: device,
      browser,
      os,
      event_type: eventType,
      ...geo,
    } as any);
  } catch {
    // best effort
  }
}

export async function listLoginEvents(limit = 200): Promise<LoginEvent[]> {
  const { data, error } = await supabase
    .from("login_events" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as LoginEvent[];
}
