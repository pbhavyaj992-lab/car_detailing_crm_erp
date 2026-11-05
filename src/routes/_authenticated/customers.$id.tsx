import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCustomer } from "@/lib/api/customers";
import { listVehiclesByCustomer } from "@/lib/api/vehicles";
import { formatINR, formatDate } from "@/lib/format";
import { Phone, Mail, MapPin } from "lucide-react";
import { ActivityLog } from "@/components/activity-log";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => getCustomer(id) });
  const vehicles = useQuery({ queryKey: ["customer-vehicles", id], queryFn: () => listVehiclesByCustomer(id) });
  const quotes = useQuery({
    queryKey: ["customer-quotes", id],
    queryFn: async () => (await supabase.from("quotes").select("*, vehicle:vehicles(number)").eq("customer_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const jobs = useQuery({
    queryKey: ["customer-jobs", id],
    queryFn: async () => (await supabase.from("jobs").select("*, vehicle:vehicles(number)").eq("customer_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const invoices = useQuery({
    queryKey: ["customer-invoices", id],
    queryFn: async () =>
      (await supabase
        .from("invoices")
        .select("*, vehicle:vehicles(number)")
        .eq("customer_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })).data ?? [],
  });

  const inv = (invoices.data ?? []) as any[];
  const lifetime = inv.reduce((s, i) => s + Number(i.paid_amount ?? 0), 0);
  const billed = inv.reduce((s, i) => s + Number(i.total ?? 0), 0);
  const outstanding = Math.max(0, billed - lifetime);

  const c = customer.data;
  if (!c) return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full rounded-[var(--radius)]" />
      <Skeleton className="h-40 w-full rounded-[var(--radius)]" />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{c.name}</h1>
        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Phone className="h-3 w-3 shrink-0" />{c.phone}</div>
          {c.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 shrink-0" />{c.email}</div>}
          {c.address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{c.address}</div>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Visits" value={String((jobs.data ?? []).length)} />
        <Stat label="Total billed" value={formatINR(billed)} />
        <Stat label="Lifetime spent" value={formatINR(lifetime)} />
        <Stat label="Outstanding" value={formatINR(outstanding)} />
      </div>



      <Section title="Vehicles">
        <div className="grid gap-2">
          {(vehicles.data ?? []).map((v) => (
            <Link key={v.id} to="/vehicles/$id" params={{ id: v.id }}>
              <Card className="p-3 transition-shadow hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{v.number}</div>
                    <div className="text-xs text-muted-foreground truncate">{[v.brand, v.model, v.color].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {(vehicles.data ?? []).length === 0 && !vehicles.isLoading && (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No vehicles yet.</p>
          )}
        </div>
      </Section>

      <Section title="Quotes">
        <div className="grid gap-2">
          {(quotes.data ?? []).map((q: any) => (
            <Link key={q.id} to="/quotes/$id" params={{ id: q.id }}>
              <Card className="p-3 transition-shadow hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm"><span className="font-medium">{q.number}</span> · <span className="text-muted-foreground">{q.vehicle?.number ?? "—"}</span></div>
                  <div className="flex items-center gap-2 shrink-0"><span className="text-sm font-semibold tabular">{formatINR(q.total)}</span><StatusBadge status={q.status} /></div>
                </div>
              </Card>
            </Link>
          ))}
          {(quotes.data ?? []).length === 0 && !quotes.isLoading && (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No quotes.</p>
          )}
        </div>
      </Section>

      <Section title="Jobs">
        <div className="grid gap-2">
          {(jobs.data ?? []).map((j: any) => (
            <Link key={j.id} to="/jobs/$id" params={{ id: j.id }}>
              <Card className="p-3 transition-shadow hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm"><span className="font-medium">{j.number}</span> · <span className="text-muted-foreground">{j.vehicle?.number}</span></div>
                  <div className="flex items-center gap-2 shrink-0"><StatusBadge status={j.status} /><span className="text-xs text-muted-foreground">{formatDate(j.created_at)}</span></div>
                </div>
              </Card>
            </Link>
          ))}
          {(jobs.data ?? []).length === 0 && !jobs.isLoading && (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No jobs.</p>
          )}
        </div>
      </Section>

      <Section title="Bills / Invoices">
        <div className="grid gap-2">
          {inv.map((i: any) => (
            <Link key={i.id} to="/invoices/$id" params={{ id: i.id }}>
              <Card className="p-3 transition-shadow hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <span className="font-medium">{i.number}</span> · <span className="text-muted-foreground">{i.vehicle?.number ?? "—"}</span>
                    <div className="text-xs text-muted-foreground">{formatDate(i.issued_at ?? i.created_at)} · Paid {formatINR(i.paid_amount)}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold tabular">{formatINR(i.total)}</span>
                    <StatusBadge status={i.status} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {inv.length === 0 && !invoices.isLoading && (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No bills yet.</p>
          )}
        </div>
      </Section>

      
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular">{value}</div>
    </Card>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-[0.08em]">{title}</h2>
      {children}
    </div>
  );
}
