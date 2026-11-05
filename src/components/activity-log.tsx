import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listActivityFor, listRecentActivity, type ActivityEntry } from "@/lib/api/activity";
import { formatDateTime } from "@/lib/format";

const actionVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v.length > 40 ? `${v.slice(0, 40)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v).slice(0, 60); } catch { return String(v); }
}

export function ActivityRow({ e }: { e: ActivityEntry }) {
  const changeKeys = e.changes ? Object.keys(e.changes) : [];
  return (
    <div className="flex gap-3 border-b py-2 last:border-0">
      <div className="pt-1">
        <Badge variant={actionVariant[e.action] ?? "outline"} className="capitalize">{e.action}</Badge>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">{e.summary ?? `${e.action} ${e.entity}`}</div>
        {changeKeys.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {changeKeys.slice(0, 6).map((k) => (
              <li key={k}>
                <span className="font-medium text-foreground">{k}</span>: {fmtValue(e.changes?.[k]?.from)} → {fmtValue(e.changes?.[k]?.to)}
              </li>
            ))}
            {changeKeys.length > 6 && <li>+{changeKeys.length - 6} more…</li>}
          </ul>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          {e.actor_name ?? "System"} · {formatDateTime(e.created_at)}
        </div>
      </div>
    </div>
  );
}

/** Activity for a single record (includes child rows, and optionally a linked record). */
export function ActivityLog({
  entity,
  entityId,
  title = "Activity log",
  alsoEntity,
  alsoEntityId,
}: {
  entity: string;
  entityId: string;
  title?: string;
  alsoEntity?: string;
  alsoEntityId?: string | null;
}) {
  const q = useQuery({
    queryKey: ["activity", entity, entityId],
    queryFn: () => listActivityFor(entity, entityId),
  });
  const linked = useQuery({
    queryKey: ["activity", alsoEntity ?? "none", alsoEntityId ?? "none"],
    enabled: !!alsoEntity && !!alsoEntityId,
    queryFn: () => listActivityFor(alsoEntity!, alsoEntityId!),
  });
  const entries = [...(q.data ?? []), ...(linked.data ?? [])].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
  return (
    <Card className="p-4 no-print">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!q.isLoading && entries.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
      <div className="space-y-0">
        {entries.map((e) => <ActivityRow key={e.id} e={e} />)}
      </div>
    </Card>
  );
}

/** Global recent-activity feed. */
export function RecentActivityFeed({ limit = 50 }: { limit?: number }) {
  const q = useQuery({ queryKey: ["activity-recent", limit], queryFn: () => listRecentActivity(limit) });
  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
      <div className="space-y-0">
        {(q.data ?? []).map((e) => <ActivityRow key={e.id} e={e} />)}
      </div>
    </Card>
  );
}
