import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Database,
  HardDrive,
  LogIn,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { getResourceUsage, saveThresholds } from "@/lib/platform-usage.functions";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/platform-usage-alerts";
import { useSession } from "@/hooks/use-session";

function when(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "1y", days: 365 },
  { label: "All time", days: null as number | null },
];

const THRESHOLD_FIELDS: { key: keyof Thresholds; label: string }[] = [
  { key: "rows_warn", label: "Data records — warning" },
  { key: "rows_critical", label: "Data records — critical" },
  { key: "files_warn", label: "Files stored — warning" },
  { key: "files_critical", label: "Files stored — critical" },
  { key: "seats_warn_pct", label: "Seats used % — warning" },
  { key: "seats_critical_pct", label: "Seats used % — critical" },
  { key: "activity_warn", label: "Logged actions — warning" },
  { key: "activity_critical", label: "Logged actions — critical" },
  { key: "inactive_days", label: "Inactive after (days)" },
];

function SeverityPill({ severity }: { severity: "ok" | "warning" | "critical" }) {
  const map = {
    ok: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-800",
    critical: "bg-red-100 text-red-700",
  } as const;
  const text = { ok: "OK", warning: "Warning", critical: "Critical" } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[severity]}`}>
      {text[severity]}
    </span>
  );
}

export function ResourceUsage() {
  const { session } = useSession();
  const fetchUsage = useServerFn(getResourceUsage);
  const persistThresholds = useServerFn(saveThresholds);
  const [tab, setTab] = useState<"businesses" | "users">("businesses");
  const [q, setQ] = useState("");
  const [days, setDays] = useState<number | null>(null);
  const [showLimits, setShowLimits] = useState(false);
  const [draft, setDraft] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  const usage = useQuery({
    queryKey: ["platform-resource-usage", days],
    enabled: !!session,
    queryFn: () => fetchUsage({ data: { days } }),
  });

  useEffect(() => {
    if (usage.data?.thresholds) setDraft(usage.data.thresholds);
  }, [usage.data?.thresholds]);

  const save = useMutation({
    mutationFn: () => persistThresholds({ data: draft }),
    onSuccess: () => {
      toast.success("Resource limits updated");
      setShowLimits(false);
      usage.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const d = usage.data;
  const periodLabel =
    days === null ? "all time" : `last ${PERIODS.find((p) => p.days === days)?.label ?? `${days}d`}`;

  const companies = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (d?.companies ?? []).filter((c) => !t || c.name.toLowerCase().includes(t));
  }, [d, q]);

  const users = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (d?.users ?? []).filter(
      (u) =>
        !t ||
        (u.name ?? "").toLowerCase().includes(t) ||
        (u.email ?? "").toLowerCase().includes(t) ||
        (u.company_name ?? "").toLowerCase().includes(t),
    );
  }, [d, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Usage period</span>
        <div className="flex rounded-lg border border-border p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.label}
              onClick={() => setDays(p.days)}
              className={`rounded-md px-3 py-1 text-xs transition ${
                days === p.days ? "bg-secondary font-medium" : "text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">Showing data created in the {periodLabel}.</span>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => setShowLimits((s) => !s)}>
          <SlidersHorizontal className="mr-2 h-3.5 w-3.5" /> Resource limits
        </Button>
      </div>

      {showLimits && (
        <Card className="p-4">
          <div className="mb-3 text-sm font-semibold">Alert thresholds</div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {THRESHOLD_FIELDS.map((f) => (
              <label key={f.key} className="space-y-1">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <Input
                  type="number"
                  min={0}
                  value={draft[f.key]}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, [f.key]: Number(e.target.value || 0) }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save limits"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(DEFAULT_THRESHOLDS)}>
              Reset to defaults
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Data records" value={d?.totals.rows} icon={Database} tone="blue" hint={`across all businesses · ${periodLabel}`} />
        <StatCard label="Files stored" value={d?.totals.media_files} icon={HardDrive} tone="violet" />
        <StatCard label="Actions logged" value={d?.totals.activity_events} icon={Activity} tone="amber" />
        <StatCard label="Total logins" value={d?.totals.logins} icon={LogIn} tone="emerald" />
        <StatCard
          label="Businesses over limits"
          value={(d?.totals.criticals ?? 0) + (d?.totals.warnings ?? 0)}
          icon={ShieldAlert}
          tone="red"
          hint={`${d?.totals.criticals ?? 0} critical · ${d?.totals.warnings ?? 0} warning`}
        />
      </div>

      {(d?.alerts?.length ?? 0) > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Resource alerts
          </div>
          <div className="divide-y divide-border">
            {(d?.alerts ?? []).map((a) => (
              <div key={a.company_id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <SeverityPill severity={a.severity} />
                <span className="font-medium">{a.name}</span>
                <span className="text-sm text-muted-foreground">
                  {a.breaches.map((b) => b.label).join(" · ")}
                </span>
                <Link
                  to="/business/$id"
                  params={{ id: a.company_id }}
                  className="ml-auto text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  Open business
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}


      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="mr-auto text-sm font-semibold">Resource utilisation · {periodLabel}</div>
          <div className="flex rounded-lg border border-border p-0.5">
            {(["businesses", "users"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 text-xs capitalize transition ${
                  tab === t ? "bg-secondary font-medium" : "text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-8 w-44"
          />
          <Button variant="outline" size="sm" onClick={() => usage.refetch()} disabled={usage.isFetching}>
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${usage.isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {usage.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading usage…</div>
        ) : usage.error ? (
          <div className="p-6 text-sm text-red-600">{(usage.error as Error).message}</div>
        ) : tab === "businesses" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Seats</th>
                  <th className="px-4 py-2">Customers</th>
                  <th className="px-4 py-2">Vehicles</th>
                  <th className="px-4 py-2">Jobs</th>
                  <th className="px-4 py-2">Quotes</th>
                  <th className="px-4 py-2">Invoices</th>
                  <th className="px-4 py-2">Expenses</th>
                  <th className="px-4 py-2">Files</th>
                  <th className="px-4 py-2">Total records</th>
                  <th className="px-4 py-2">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.company_id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2">
                      <SeverityPill severity={c.severity} />
                      {c.breach_labels.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.breach_labels.join(" · ")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">
                      <span className={c.seats_used > c.seats ? "text-red-600 font-medium" : ""}>
                        {c.seats_used}/{c.seats}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">{c.customers}</td>
                    <td className="px-4 py-2 tabular-nums">{c.vehicles}</td>
                    <td className="px-4 py-2 tabular-nums">{c.jobs}</td>
                    <td className="px-4 py-2 tabular-nums">{c.quotes}</td>
                    <td className="px-4 py-2 tabular-nums">{c.invoices}</td>
                    <td className="px-4 py-2 tabular-nums">{c.expenses}</td>
                    <td className="px-4 py-2 tabular-nums">{c.media_files}</td>
                    <td className="px-4 py-2 font-semibold tabular-nums">{c.total_rows}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{when(c.last_activity_at)}</td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={12}>

                      No businesses match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Actions</th>
                  <th className="px-4 py-2">Created</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2">Deleted</th>
                  <th className="px-4 py-2">Logins</th>
                  <th className="px-4 py-2">Last active</th>
                  <th className="px-4 py-2">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <div className="font-medium">{u.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.email ?? "—"}</div>
                    </td>
                    <td className="px-4 py-2">{u.company_name ?? "—"}</td>
                    <td className="px-4 py-2 capitalize">{u.role.replace("_", " ")}</td>
                    <td className="px-4 py-2 font-semibold tabular-nums">{u.actions}</td>
                    <td className="px-4 py-2 tabular-nums">{u.creates}</td>
                    <td className="px-4 py-2 tabular-nums">{u.updates}</td>
                    <td className="px-4 py-2 tabular-nums">{u.deletes}</td>
                    <td className="px-4 py-2 tabular-nums">{u.logins}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{when(u.last_active_at)}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{when(u.last_sign_in_at)}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-sm text-muted-foreground" colSpan={10}>
                      <Users className="mr-2 inline h-4 w-4" /> No users match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
