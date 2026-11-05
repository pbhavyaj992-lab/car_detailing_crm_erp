import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDashboardMetrics } from "@/lib/api/dashboard";
import { garageBoard } from "@/lib/api/jobs";
import { formatINR } from "@/lib/format";
import { useRoles, useProfile } from "@/hooks/use-session";
import { PlusCircle, Search, ClipboardList, Receipt, Car, Users, TrendingUp, Clock, CheckCircle2, IndianRupee, ArrowRight, Inbox, Bell, Scissors } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, type StatTone } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { statusAccentClass } from "@/lib/status-accent";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { canFinance, isWorkerOnly, isSuperAdmin, isReady } = useRoles();
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const metrics = useQuery({ queryKey: ["dashboard-metrics"], queryFn: getDashboardMetrics, enabled: !isWorkerOnly && !isSuperAdmin });
  const board = useQuery({ queryKey: ["garage-board"], queryFn: garageBoard, enabled: !isSuperAdmin });

  useEffect(() => {
    if (isReady && isSuperAdmin) navigate({ to: "/admin", replace: true });
  }, [isReady, isSuperAdmin, navigate]);

  if (isSuperAdmin) return null;
  if (isWorkerOnly) return <WorkerHome />;


  const cards: { label: string; value: number | string | undefined; icon: any; tone: StatTone; to?: string; search?: Record<string, unknown> }[] = [
    { label: "New Inquiries", value: metrics.data?.newInquiries, icon: Inbox, tone: "blue", to: "/leads" },
    { label: "Follow-ups Due", value: metrics.data?.followUpsDue, icon: Bell, tone: "amber", to: "/leads" },
    { label: "Vehicles Inside", value: metrics.data?.garageInside, icon: Car, tone: "sky", to: "/jobs" },
    { label: "Today's Vehicles", value: metrics.data?.todaysVehicles, icon: Users, tone: "sky", to: "/jobs" },
    { label: "Pending Quotes", value: metrics.data?.pendingQuotes, icon: ClipboardList, tone: "amber", to: "/quotes" },
    { label: "Active Jobs", value: metrics.data?.activeJobs, icon: Clock, tone: "violet", to: "/jobs" },
    { label: "Ready for Delivery", value: metrics.data?.readyForDelivery, icon: CheckCircle2, tone: "emerald", to: "/jobs" },
    { label: "Completed Today", value: metrics.data?.completedToday, icon: TrendingUp, tone: "emerald", to: "/jobs" },
  ];
  if (canFinance) {
    cards.push(
      { label: "Pending Payments", value: metrics.data ? formatINR(metrics.data.pendingPayments) : undefined, icon: Receipt as any, tone: "red", to: "/invoices" },
      { label: "This Month", value: metrics.data ? formatINR(metrics.data.monthRevenue) : undefined, icon: IndianRupee as any, tone: "emerald", to: "/analytics" },
      { label: "Adjusted This Month", value: metrics.data ? formatINR(metrics.data.adjustedThisMonth) : undefined, icon: Scissors as any, tone: "amber", to: "/expenses" },
    );
  }


  const firstName = profile?.full_name ? profile.full_name.split(" ")[0] : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title={firstName ? `Good to see you, ${firstName}` : "Dashboard"}
        subtitle="Here's what's happening across the garage today."
        actions={
          <>
            <Link to="/search"><Button variant="outline" className="h-10 md:h-9"><Search className="h-4 w-4" /> Search</Button></Link>
            <Link to="/new"><Button className="h-10 md:h-9"><PlusCircle className="h-4 w-4" /> New Quote</Button></Link>
          </>
        }
      />

      <div className="grid auto-rows-fr grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const card = <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} tone={c.tone} className="h-full" />;
          return c.to ? <Link key={c.label} to={c.to} className="block h-full transition-transform active:scale-[0.98]">{card}</Link> : card;
        })}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Live Garage Board</h2>
            <p className="text-xs text-muted-foreground">Vehicles currently in the workshop.</p>
          </div>
          <Link to="/jobs" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {board.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-[var(--radius)] border border-border bg-card" />
            ))}
          </div>
        ) : (board.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Car}
            title="No vehicles in the garage"
            description="Create a new quote to check a vehicle in."
            action={
              <Link to="/new">
                <Button size="sm"><PlusCircle className="h-4 w-4" /> New Quote</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(board.data ?? []).slice(0, 6).map((j: any) => (
              <Link key={j.id} to="/jobs/$id" params={{ id: j.id }}>
                <Card className={`border-border p-4 pl-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-elevated)] ${statusAccentClass(j.status)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold tracking-tight">{j.vehicle?.number}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[j.vehicle?.brand, j.vehicle?.model].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <StatusBadge status={j.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{j.customer?.name}</span>
                    <span className="tabular">{j.number}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function WorkerHome() {
  const board = useQuery({ queryKey: ["garage-board"], queryFn: garageBoard });
  return (
    <div className="space-y-5">
      <PageHeader title="Today's Jobs" subtitle="Tap a card to open its checklist." />
      {(board.data?.length ?? 0) === 0 ? (
        <EmptyState icon={Car} title="Nothing assigned yet" description="Jobs will appear here as they're checked in." />
      ) : (
        <div className="grid gap-3">
          {(board.data ?? []).map((j: any) => (
            <Link key={j.id} to="/jobs/$id" params={{ id: j.id }}>
              <Card className={`border-border p-4 pl-5 transition-all hover:-translate-y-px hover:shadow-[var(--shadow-elevated)] ${statusAccentClass(j.status)}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold tracking-tight">{j.vehicle?.number}</div>
                  <StatusBadge status={j.status} />
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{j.customer?.name} · {j.number}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
