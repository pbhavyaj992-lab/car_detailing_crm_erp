import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Users, Briefcase, FileText, Receipt, Wallet, Activity, Car, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoles } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import type { Company } from "@/lib/api/companies";
import {
  tenantActivity,
  tenantCustomers,
  tenantExpenses,
  tenantInvoices,
  tenantJobs,
  tenantOverview,
  tenantQuotes,
} from "@/lib/api/tenant-inspect";

export const Route = createFileRoute("/_authenticated/business/$id")({
  component: BusinessInspector,
  head: () => ({
    meta: [
      { title: "Business Inspector | Ishan Detailing OS" },
      { name: "description", content: "Inspect a tenant business: customers, jobs, quotes, invoices, expenses and activity." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Business Inspector | Ishan Detailing OS" },
      { property: "og:description", content: "Inspect a tenant business: customers, jobs, quotes, invoices, expenses and activity." },
    ],
  }),
});

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="p-6 text-sm text-muted-foreground">No {label} yet for this business.</div>;
}

function BusinessInspector() {
  const { id } = Route.useParams();
  const { isSuperAdmin, isReady } = useRoles();
  const enabled = isSuperAdmin;

  const company = useQuery({
    queryKey: ["company", id],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Company | null;
    },
  });

  const overview = useQuery({ queryKey: ["tenant-overview", id], enabled, queryFn: () => tenantOverview(id) });
  const customers = useQuery({ queryKey: ["tenant-customers", id], enabled, queryFn: () => tenantCustomers(id) });
  const jobs = useQuery({ queryKey: ["tenant-jobs", id], enabled, queryFn: () => tenantJobs(id) });
  const quotes = useQuery({ queryKey: ["tenant-quotes", id], enabled, queryFn: () => tenantQuotes(id) });
  const invoices = useQuery({ queryKey: ["tenant-invoices", id], enabled, queryFn: () => tenantInvoices(id) });
  const expenses = useQuery({ queryKey: ["tenant-expenses", id], enabled, queryFn: () => tenantExpenses(id) });
  const activity = useQuery({ queryKey: ["tenant-activity", id], enabled, queryFn: () => tenantActivity(id) });

  if (isReady && !isSuperAdmin) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-lg font-semibold">Restricted area</h1>
        <p className="mt-1 text-sm text-muted-foreground">Only platform super admins can inspect tenant data.</p>
      </Card>
    );
  }

  const o = overview.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {company.data?.logo_url ? (
              <img src={company.data.logo_url} alt={`${company.data.name} logo`} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary"><Building2 className="h-4 w-4 text-muted-foreground" /></span>
            )}
            {company.data?.name ?? "Business"}
          </span>
        }
        subtitle={
          company.data
            ? `${company.data.plan_tier} plan · ${company.data.status} · ${company.data.contact_email ?? company.data.slug}`
            : "Loading business…"
        }
        actions={
          <Button variant="outline" asChild>
            <Link to="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Back to master panel</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Customers" value={o?.customers} icon={Users} tone="blue" hint={`${o?.vehicles ?? 0} vehicles`} />
        <StatCard label="Open jobs" value={o?.openJobs} icon={Briefcase} tone="amber" hint={`${o?.jobs ?? 0} total`} />
        <StatCard label="Collected" value={o ? formatINR(o.collected) : undefined} icon={IndianRupee} tone="emerald" hint={`${formatINR(o?.outstanding ?? 0)} due`} />
        <StatCard label="Team members" value={o?.staff} icon={Users} tone="violet" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Quotes" value={o?.quotes} icon={FileText} />
        <StatCard label="Invoices" value={o?.invoices} icon={Receipt} hint={`${formatINR(o?.billed ?? 0)} billed`} />
        <StatCard label="Expenses" value={o ? formatINR(o.expenses) : undefined} icon={Wallet} />
        <StatCard label="Vehicles" value={o?.vehicles} icon={Car} tone="sky" />
      </div>






      <Tabs defaultValue="customers">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          
        </TabsList>

        <TabsContent value="customers">
          <Card className="overflow-hidden">
            {(customers.data ?? []).length === 0 ? <Empty label="customers" /> : (
              <Table head={["Customer", "Phone", "Email", "Vehicles", "Status", "Added"]}>
                {((customers.data ?? []) as any[]).map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">{c.phone}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(c.vehicles ?? []).map((v: any) => v.number).join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{c.lead_status}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(c.created_at)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card className="overflow-hidden">
            {(jobs.data ?? []).length === 0 ? <Empty label="jobs" /> : (
              <Table head={["Job", "Customer", "Vehicle", "Status", "Expected", "Created"]}>
                {(jobs.data ?? []).map((j) => (
                  <tr key={j.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{j.number}</td>
                    <td className="px-4 py-3">{j.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3">{j.vehicle?.number ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{String(j.status).replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(j.expected_delivery)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(j.created_at)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="quotes">
          <Card className="overflow-hidden">
            {(quotes.data ?? []).length === 0 ? <Empty label="quotes" /> : (
              <Table head={["Quote", "Customer", "Status", "Total", "Created"]}>
                {(quotes.data ?? []).map((q) => (
                  <tr key={q.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{q.number}</td>
                    <td className="px-4 py-3">{q.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{q.status}</td>
                    <td className="px-4 py-3 tabular-nums">{formatINR(q.total)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(q.created_at)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="invoices">
          <Card className="overflow-hidden">
            {(invoices.data ?? []).length === 0 ? <Empty label="invoices" /> : (
              <Table head={["Invoice", "Customer", "Status", "Total", "Paid", "Issued"]}>
                {(invoices.data ?? []).map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{i.number}</td>
                    <td className="px-4 py-3">{i.customer?.name ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{i.status}</td>
                    <td className="px-4 py-3 tabular-nums">{formatINR(i.total)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatINR(i.paid_amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(i.issued_at)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card className="overflow-hidden">
            {(expenses.data ?? []).length === 0 ? <Empty label="expenses" /> : (
              <Table head={["Date", "Category", "Vendor", "Method", "Amount"]}>
                {(expenses.data ?? []).map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-3">{formatDate(e.spent_on)}</td>
                    <td className="px-4 py-3 capitalize">{e.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.vendor ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.payment_method ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{formatINR(e.amount)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
