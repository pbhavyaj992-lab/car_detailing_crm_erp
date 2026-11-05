import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { IndianRupee, Receipt, TrendingUp, ClipboardList, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRevenueAnalytics, type Range } from "@/lib/api/analytics";
import { formatINR } from "@/lib/format";
import { AccessDenied } from "@/components/access-denied";
import { useRoles } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AnalyticsPage,
});

const RANGES: { key: Range; label: string }[] = [
  { key: "daily", label: "Daily · 30d" },
  { key: "weekly", label: "Weekly · 12w" },
  { key: "monthly", label: "Monthly · 12m" },
];

const METHOD_COLORS: Record<string, string> = {
  cash: "#10b981",
  upi: "#2563eb",
  card: "#8b5cf6",
  bank_transfer: "#0ea5e9",
  other: "#94a3b8",
};

function AnalyticsPage() {
  const { canFinance, isReady } = useRoles();
  const [range, setRange] = useState<Range>("daily");
  const q = useQuery({
    queryKey: ["analytics", range],
    queryFn: () => getRevenueAnalytics(range),
    enabled: canFinance,
  });

  if (!isReady) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!canFinance) return <AccessDenied message="Revenue analytics are limited to owners, managers and reception." />;

  const totals = q.data?.totals;
  const methodData = Object.entries(q.data?.methodTotals ?? {}).map(([k, v]) => ({
    name: k.replace("_", " "),
    value: v,
    key: k,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        subtitle="Revenue, payments and job throughput at a glance."
        actions={
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                variant={range === r.key ? "default" : "outline"}
                className="h-10 md:h-9"
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Revenue" value={totals ? formatINR(totals.revenue) : undefined} icon={IndianRupee} tone="emerald" />
        <StatCard label="Payments" value={totals?.payments} icon={Receipt} tone="blue" />
        <StatCard label="Avg Ticket" value={totals ? formatINR(totals.avgTicket) : undefined} icon={TrendingUp} tone="violet" />
        <StatCard label="Jobs Created" value={totals?.jobsCreated} icon={ClipboardList} tone="amber" />
        <StatCard label="Jobs Delivered" value={totals?.jobsDelivered} icon={CheckCircle2} tone="emerald" />
      </div>

      <Card className="p-4 md:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight">Revenue trend</h2>
          <p className="text-xs text-muted-foreground">{RANGES.find((r) => r.key === range)?.label}</p>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={q.data?.points ?? []} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                formatter={(v: number) => [formatINR(v), "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 md:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight">Jobs created</h2>
            <p className="text-xs text-muted-foreground">Volume per bucket</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={q.data?.points ?? []} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight">Payment methods</h2>
            <p className="text-xs text-muted-foreground">Share of collected revenue</p>
          </div>
          {methodData.length === 0 ? (
            <div className="grid h-64 place-items-center text-sm text-muted-foreground">No payments in this range</div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={methodData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {methodData.map((m) => (
                      <Cell key={m.key} fill={METHOD_COLORS[m.key] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
