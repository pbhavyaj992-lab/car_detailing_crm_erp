import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoles } from "@/hooks/use-session";
import { ActivityRow } from "@/components/activity-log";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Smartphone, Monitor, Tablet, MapPin } from "lucide-react";
import { listActivity, type ActivityEntry } from "@/lib/api/activity";
import { listCompanies } from "@/lib/api/companies";
import { listLoginEvents, type LoginEvent } from "@/lib/api/login-events";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity Log | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ActivityPage,
});

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\n");
  return `${head}\n${body}`;
}

function download(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ActivityPage() {
  const { isSuperAdmin } = useRoles();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Activity"
        subtitle={
          isSuperAdmin
            ? "Everything created, edited, or deleted across the platform."
            : "Everything created, edited, or deleted in your business."
        }
      />
      <Tabs defaultValue="changes">
        <TabsList>
          <TabsTrigger value="changes">Change log</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="logins">Sign-ins</TabsTrigger>}
        </TabsList>
        <TabsContent value="changes" className="mt-4">
          <ChangeLogPanel isSuperAdmin={isSuperAdmin} />
        </TabsContent>
        {isSuperAdmin && (
          <TabsContent value="logins" className="mt-4">
            <LoginsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const ACTIONS = ["create", "update", "delete"];
const ENTITIES = [
  "customers", "vehicles", "inquiries", "quotes", "jobs", "invoices", "payments", "expenses", "services",
];

function ChangeLogPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [companyId, setCompanyId] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = { companyId: companyId || null, actor: actor || null, action: action || null, entity: entity || null, from: from || null, to: to || null, limit: 500 };

  const companies = useQuery({
    queryKey: ["companies", "activity-filter"],
    queryFn: listCompanies,
    enabled: isSuperAdmin,
  });

  const q = useQuery({
    queryKey: ["activity-filtered", filters, isSuperAdmin],
    queryFn: () => listActivity(filters, { isSuperAdmin }),
  });

  const onDownload = () => {
    const rows = (q.data ?? []).map((e: ActivityEntry) => ({
      created_at: e.created_at,
      actor: e.actor_name ?? "System",
      action: e.action,
      entity: e.entity,
      entity_id: e.entity_id,
      summary: e.summary,
      changes: e.changes ? JSON.stringify(e.changes) : "",
    }));
    download(
      `activity-log-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(rows, ["created_at", "actor", "action", "entity", "entity_id", "summary", "changes"]),
    );
  };

  const reset = () => {
    setCompanyId(""); setActor(""); setAction(""); setEntity(""); setFrom(""); setTo("");
  };

  const selectCls =
    "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground";

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-end gap-2 p-3">
        {isSuperAdmin && (
          <select
            aria-label="Business"
            className={selectCls}
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">All businesses</option>
            {(companies.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <select aria-label="Action" className={selectCls} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select aria-label="Entity" className={selectCls} value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">All records</option>
          {ENTITIES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <Input aria-label="Actor" placeholder="Actor" className="h-9 w-36" value={actor} onChange={(e) => setActor(e.target.value)} />
        <Input aria-label="From date" type="date" className="h-9 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input aria-label="To date" type="date" className="h-9 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        <Button size="sm" variant="ghost" onClick={reset}>Reset</Button>
        <div className="ml-auto">
          <Button size="sm" variant="outline" onClick={onDownload} disabled={!q.data?.length}>
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">
          Activity {q.data ? `(${q.data.length})` : ""}
        </h2>
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {q.data && q.data.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity matches these filters yet.</p>
        )}
        <div className="space-y-0">
          {(q.data ?? []).map((e) => <ActivityRow key={e.id} e={e} />)}
        </div>
      </Card>
    </div>
  );
}


function DeviceIcon({ d }: { d: string | null }) {
  if (d === "Mobile") return <Smartphone className="h-4 w-4" />;
  if (d === "Tablet") return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function LoginsPanel() {
  const q = useQuery({ queryKey: ["login-events", 300], queryFn: () => listLoginEvents(300) });
  const onDownload = () => {
    const rows = (q.data ?? []).map((e: LoginEvent) => ({
      created_at: e.created_at,
      user_email: e.user_email,
      user_name: e.user_name,
      event_type: e.event_type,
      ip_address: e.ip_address,
      city: e.city,
      region: e.region,
      country: e.country,
      device_type: e.device_type,
      browser: e.browser,
      os: e.os,
      user_agent: e.user_agent,
    }));
    download(
      `sign-ins-${new Date().toISOString().slice(0, 10)}.csv`,
      toCSV(rows, [
        "created_at", "user_email", "user_name", "event_type",
        "ip_address", "city", "region", "country",
        "device_type", "browser", "os", "user_agent",
      ]),
    );
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onDownload} disabled={!q.data?.length}>
          <Download className="mr-2 h-4 w-4" /> Download CSV
        </Button>
      </div>
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent sign-ins</h2>
        {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {q.data && q.data.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No sign-ins recorded yet. New logins will appear here.
          </p>
        )}
        <div className="divide-y">
          {(q.data ?? []).map((e) => (
            <div key={e.id} className="flex items-start gap-3 py-3">
              <div className="pt-1 text-muted-foreground">
                <DeviceIcon d={e.device_type} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{e.user_name ?? e.user_email ?? "Unknown user"}</span>
                  {e.user_email && e.user_name && (
                    <span className="text-xs text-muted-foreground">{e.user_email}</span>
                  )}
                  <Badge variant={e.event_type === "sign_up" ? "default" : "secondary"} className="capitalize">
                    {e.event_type.replace("_", " ")}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {(e.city || e.country) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {[e.city, e.region, e.country].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {e.ip_address && <span>IP: {e.ip_address}</span>}
                  <span>{[e.browser, e.os, e.device_type].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(e.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
