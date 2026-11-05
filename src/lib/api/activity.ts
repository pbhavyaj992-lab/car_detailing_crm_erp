import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";

export type ActivityEntry = {
  id: string;
  entity: string;
  entity_id: string | null;
  parent_entity: string | null;
  parent_id: string | null;
  action: "create" | "update" | "delete" | string;
  summary: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
};

async function fetchActivity(builder: any): Promise<ActivityEntry[]> {
  const { data, error } = await builder.order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as ActivityEntry[];
}

/** Log entries for a single record AND its children (e.g. quote + its items). */
export async function listActivityFor(entity: string, entityId: string) {
  const { data, error } = await supabase
    .from("activity_log" as any)
    .select("*")
    .or(
      `and(entity.eq.${entity},entity_id.eq.${entityId}),and(parent_entity.eq.${entity},parent_id.eq.${entityId})`,
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as ActivityEntry[];
}

/** Recent activity across everything (for a global feed). */
export async function listRecentActivity(limit = 100) {
  const companyId = await getCompanyId();

  return fetchActivity(
    supabase
      .from("activity_log" as any)
      .select("*")
      .eq("company_id", companyId)
      .limit(limit)
  );
}

export type ActivityFilters = {
  /** Super admin only — restrict to one business. Omit for platform-wide. */
  companyId?: string | null;
  actor?: string | null;
  action?: string | null;
  entity?: string | null;
  from?: string | null;
  to?: string | null;
  limit?: number;
};

/**
 * Filtered activity feed.
 * Super admins may query platform-wide or a single business; everyone else is
 * scoped to their own business (RLS enforces this server-side regardless).
 */
export async function listActivity(
  filters: ActivityFilters = {},
  opts: { isSuperAdmin?: boolean } = {},
): Promise<ActivityEntry[]> {
  let q = supabase
    .from("activity_log" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 200);

  if (opts.isSuperAdmin) {
    if (filters.companyId) q = q.eq("company_id", filters.companyId);
  } else {
    q = q.eq("company_id", await getCompanyId());
  }

  if (filters.action) q = q.eq("action", filters.action);
  if (filters.entity) q = q.eq("entity", filters.entity);
  if (filters.actor) q = q.ilike("actor_name", `%${filters.actor}%`);
  if (filters.from) q = q.gte("created_at", new Date(filters.from).toISOString());
  if (filters.to) {
    const end = new Date(filters.to);
    end.setHours(23, 59, 59, 999);
    q = q.lte("created_at", end.toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ActivityEntry[];
}


