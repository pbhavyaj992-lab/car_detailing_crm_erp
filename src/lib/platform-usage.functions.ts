import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  DEFAULT_THRESHOLDS,
  evaluateAll,
  evaluateCompany,
  type CompanyAlert,
  type Severity,
  type Thresholds,
} from "@/lib/platform-usage-alerts";


export type CompanyUsage = {
  company_id: string;
  name: string;
  seats: number;
  seats_used: number;
  customers: number;
  vehicles: number;
  jobs: number;
  quotes: number;
  invoices: number;
  expenses: number;
  payments: number;
  media_files: number;
  activity_events: number;
  total_rows: number;
  last_activity_at: string | null;
  severity: Severity;
  breach_labels: string[];
};


export type UserUsage = {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  company_id: string | null;
  company_name: string | null;
  actions: number;
  creates: number;
  updates: number;
  deletes: number;
  logins: number;
  last_active_at: string | null;
  last_sign_in_at: string | null;
};

export type ResourceUsage = {
  companies: CompanyUsage[];
  users: UserUsage[];
  thresholds: Thresholds;
  alerts: CompanyAlert[];
  totals: {
    companies: number;
    users: number;
    rows: number;
    media_files: number;
    activity_events: number;
    logins: number;
    warnings: number;
    criticals: number;
  };
};


async function assertSuperAdmin(supabaseClient: any, userId: string) {
  const { data } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin");
  if (!data || data.length === 0) throw new Error("Forbidden — super admin only");
}

function tally(rows: { company_id?: string | null }[] | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows ?? []) {
    const k = r.company_id ?? "unknown";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Platform-wide resource utilisation, per business and per user. */
export const getResourceUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number | null }) =>
    z.object({ days: z.number().int().positive().max(3650).nullable().optional() }).parse(d ?? {}),
  )
  .handler(async ({ context, data }): Promise<ResourceUsage> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const days = data?.days ?? null;
    const since = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
    const scoped = (q: any) => (since ? q.gte("created_at", since) : q);

    const sel = (table: string) =>
      scoped((supabaseAdmin as any).from(table).select("company_id, created_at").limit(100000));

    const [
      companies,
      roles,
      profiles,
      customers,
      vehicles,
      jobs,
      quotes,
      invoices,
      expenses,
      payments,
      media,
      activity,
      logins,
      authList,
    ] = await Promise.all([
      supabaseAdmin.from("companies").select("id, name, seats"),
      supabaseAdmin.from("user_roles").select("user_id, role, company_id"),
      supabaseAdmin.from("profiles").select("id, full_name"),
      sel("customers"),
      sel("vehicles"),
      sel("jobs"),
      sel("quotes"),
      sel("invoices"),
      sel("expenses"),
      sel("payments"),
      sel("media"),

      scoped(
        supabaseAdmin
          .from("activity_log")
          .select("company_id, action, actor_id, created_at")
          .limit(100000),
      ),
      scoped(supabaseAdmin.from("login_events" as any).select("user_id, created_at").limit(100000)),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const counts = {
      customers: tally(customers.data as any),
      vehicles: tally(vehicles.data as any),
      jobs: tally(jobs.data as any),
      quotes: tally(quotes.data as any),
      invoices: tally(invoices.data as any),
      expenses: tally(expenses.data as any),
      payments: tally(payments.data as any),
      media: tally(media.data as any),
      activity: tally(activity.data as any),
    };

    const seatsUsed = new Map<string, number>();
    for (const r of (roles.data ?? []) as any[]) {
      if (!r.company_id) continue;
      seatsUsed.set(r.company_id, (seatsUsed.get(r.company_id) ?? 0) + 1);
    }

    const lastActivityByCompany = new Map<string, string>();
    const byActor = new Map<
      string,
      { actions: number; creates: number; updates: number; deletes: number; last: string | null }
    >();
    for (const a of (activity.data ?? []) as any[]) {
      if (a.company_id) {
        const prev = lastActivityByCompany.get(a.company_id);
        if (!prev || a.created_at > prev) lastActivityByCompany.set(a.company_id, a.created_at);
      }
      if (!a.actor_id) continue;
      const e =
        byActor.get(a.actor_id) ?? { actions: 0, creates: 0, updates: 0, deletes: 0, last: null };
      e.actions += 1;
      if (a.action === "create") e.creates += 1;
      else if (a.action === "update") e.updates += 1;
      else if (a.action === "delete") e.deletes += 1;
      if (!e.last || a.created_at > e.last) e.last = a.created_at;
      byActor.set(a.actor_id, e);
    }

    const loginsByUser = new Map<string, number>();
    for (const l of (logins.data ?? []) as any[]) {
      if (!l.user_id) continue;
      loginsByUser.set(l.user_id, (loginsByUser.get(l.user_id) ?? 0) + 1);
    }

    const companyRows = ((companies.data ?? []) as any[]).map((c) => {
      const g = (m: Map<string, number>) => m.get(c.id) ?? 0;
      const row: CompanyUsage = {
        company_id: c.id,
        name: c.name,
        seats: c.seats ?? 0,
        seats_used: seatsUsed.get(c.id) ?? 0,
        customers: g(counts.customers),
        vehicles: g(counts.vehicles),
        jobs: g(counts.jobs),
        quotes: g(counts.quotes),
        invoices: g(counts.invoices),
        expenses: g(counts.expenses),
        payments: g(counts.payments),
        media_files: g(counts.media),
        activity_events: g(counts.activity),
        total_rows: 0,
        last_activity_at: lastActivityByCompany.get(c.id) ?? null,
        severity: "ok",
        breach_labels: [],
      };
      row.total_rows =
        row.customers +
        row.vehicles +
        row.jobs +
        row.quotes +
        row.invoices +
        row.expenses +
        row.payments +
        row.media_files;
      return row;
    });
    companyRows.sort((a, b) => b.total_rows - a.total_rows);

    const { data: thresholdRow } = await (supabaseAdmin as any)
      .from("platform_thresholds")
      .select("*")
      .maybeSingle();
    const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS, ...(thresholdRow ?? {}) };

    for (const row of companyRows) {
      const a = evaluateCompany(row, thresholds);
      row.severity = a.severity;
      row.breach_labels = a.breaches.map((b) => b.label);
    }
    const alerts = evaluateAll(companyRows, thresholds);


    const companyName = new Map(((companies.data ?? []) as any[]).map((c) => [c.id, c.name]));
    const profileById = new Map(((profiles.data ?? []) as any[]).map((p) => [p.id, p]));
    const authById = new Map((authList.data?.users ?? []).map((u: any) => [u.id, u]));

    const userRows: UserUsage[] = ((roles.data ?? []) as any[]).map((r) => {
      const au: any = authById.get(r.user_id);
      const stat = byActor.get(r.user_id);
      return {
        user_id: r.user_id,
        name: profileById.get(r.user_id)?.full_name ?? au?.user_metadata?.full_name ?? null,
        email: au?.email ?? null,
        role: r.role,
        company_id: r.company_id ?? null,
        company_name: r.company_id ? companyName.get(r.company_id) ?? null : null,
        actions: stat?.actions ?? 0,
        creates: stat?.creates ?? 0,
        updates: stat?.updates ?? 0,
        deletes: stat?.deletes ?? 0,
        logins: loginsByUser.get(r.user_id) ?? 0,
        last_active_at: stat?.last ?? null,
        last_sign_in_at: au?.last_sign_in_at ?? null,
      };
    });
    userRows.sort((a, b) => b.actions - a.actions);

    return {
      companies: companyRows,
      users: userRows,
      thresholds,
      alerts,
      totals: {
        companies: companyRows.length,
        users: userRows.length,
        rows: companyRows.reduce((a, c) => a + c.total_rows, 0),
        media_files: companyRows.reduce((a, c) => a + c.media_files, 0),
        activity_events: companyRows.reduce((a, c) => a + c.activity_events, 0),
        logins: (logins.data ?? []).length,
        warnings: alerts.filter((a) => a.severity === "warning").length,
        criticals: alerts.filter((a) => a.severity === "critical").length,
      },
    };
  });

/** Update the platform-wide resource thresholds (super admin only). */
export const saveThresholds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rows_warn: z.number().int().min(0),
        rows_critical: z.number().int().min(0),
        files_warn: z.number().int().min(0),
        files_critical: z.number().int().min(0),
        seats_warn_pct: z.number().int().min(0).max(1000),
        seats_critical_pct: z.number().int().min(0).max(1000),
        activity_warn: z.number().int().min(0),
        activity_critical: z.number().int().min(0),
        inactive_days: z.number().int().min(0).max(3650),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("platform_thresholds")
      .upsert({ id: true, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

