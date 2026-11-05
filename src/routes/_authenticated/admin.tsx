import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Users, Briefcase, IndianRupee, Plus, Pencil, Trash2, TrendingUp, Eye, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-session";
import {
  COMPANY_STATUSES,
  PLAN_TIERS,
  createCompany,
  deleteCompany,
  getPlatformStats,
  listCompanies,
  slugify,
  updateCompany,
  type Company,
  subscriptionState,
  type CompanyInput,
  listPlatformPlans,
  type PlatformPlan,
} from "@/lib/api/companies";
import { PlatformUsers } from "@/components/admin/platform-users";
import { ManageSubscription } from "@/components/admin/manage-subscription";

import { LogoUpload, LogoThumb } from "@/components/logo-upload";
import { ResourceUsage } from "@/components/admin/resource-usage";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Super Admin | Ishan Detailing OS" },
      { name: "description", content: "Create and manage tenant companies and live platform statistics." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Super Admin | Ishan Detailing OS" },
      { property: "og:description", content: "Create and manage tenant companies and live platform statistics." },
    ],
  }),
});

const EMPTY: CompanyInput = {
  name: "",
  slug: "",
  plan_tier: "starter",
  status: "active",
  logo_url: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  address: "",
  notes: "",
  seats: 5,
  
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  trial: "bg-amber-50 text-amber-700 border-amber-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

const SUB_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  due_soon: "bg-amber-50 text-amber-700 border-amber-200",
  grace: "bg-orange-50 text-orange-700 border-orange-200",
  expired: "bg-red-50 text-red-700 border-red-200",
  inactive: "bg-slate-100 text-slate-600 border-slate-200",
};

function AdminPage() {
  const { roles, isReady } = useRoles();
  const isSuperAdmin = roles.includes("super_admin");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [subCompany, setSubCompany] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyInput>(EMPTY);
  

  const companies = useQuery({ queryKey: ["companies"], queryFn: listCompanies, enabled: isSuperAdmin });
  const stats = useQuery({ queryKey: ["platform-stats"], queryFn: getPlatformStats, enabled: isSuperAdmin });
  // Plans query removed for now at user request
  // const plans = useQuery<PlatformPlan[]>({ queryKey: ["platform-plans"], queryFn: listPlatformPlans, enabled: isSuperAdmin });

  const statsByCompany = useMemo(() => {
    const map: Record<string, { users: number; customers: number; jobs: number; revenue: number }> = {};
    (stats.data?.per_company ?? []).forEach((c) => {
      map[c.id] = { users: c.users, customers: c.customers, jobs: c.jobs, revenue: c.revenue };
    });
    return map;
  }, [stats.data]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["platform-stats"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: CompanyInput = {
        ...form,
        name: form.name.trim(),
        slug: (form.slug || slugify(form.name)).trim(),
        seats: Number(form.seats ?? 5),
      };
      if (!payload.name) throw new Error("Business name is required");
      if (editing) await updateCompany(editing.id, payload);
      else await createCompany(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Business updated" : "Business created");
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => {
      toast.success("Business deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(c: Company) {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      plan_tier: c.plan_tier,
      status: c.status,
      logo_url: c.logo_url ?? "",
      contact_name: c.contact_name ?? "",
      contact_email: c.contact_email ?? "",
      contact_phone: c.contact_phone ?? "",
      address: c.address ?? "",
      notes: c.notes ?? "",
      seats: c.seats,
      
    });
    setOpen(true);
  }

  if (isReady && !isSuperAdmin) {
    return (
      <Card className="p-8 text-center">
        <h1 className="text-lg font-semibold">Restricted area</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Only platform super admins can access the master panel.
        </p>
      </Card>
    );
  }

  const s = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin"
        subtitle="Create and manage tenant businesses across the platform."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New business
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Businesses" value={s?.companies_total} icon={Building2} tone="blue" hint={`${s?.companies_active ?? 0} active`} />
        <StatCard label="Platform users" value={s?.users_total} icon={Users} tone="violet" />
        <StatCard label="Open jobs" value={s?.jobs_open} icon={Briefcase} tone="amber" hint={`${s?.jobs_total ?? 0} total`} />
        <StatCard label="Collected revenue" value={s ? `₹${Number(s.revenue_total).toLocaleString("en-IN")}` : undefined} icon={IndianRupee} tone="emerald" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Customers" value={s?.customers_total} icon={Users} />
        <StatCard label="Invoices" value={s?.invoices_total} />
        <StatCard label="New businesses (30d)" value={s?.signups_30d} icon={TrendingUp} tone="sky" />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold text-destructive">
          Tenant businesses (RESTRICTED ACCESS)
        </div>
        {companies.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (companies.data ?? []).length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No businesses yet — create your first tenant.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Users</th>
                  <th className="px-4 py-2">Customers</th>
                  <th className="px-4 py-2">Jobs</th>
                  <th className="px-4 py-2">Revenue</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(companies.data ?? []).map((c) => {
                  const cs = statsByCompany[c.id];
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <LogoThumb value={c.logo_url} name={c.name} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{c.name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {c.contact_email || c.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs capitalize ${SUB_TONE[subscriptionState(c)] ?? STATUS_TONE.cancelled}`}>
                          {subscriptionState(c).replace("_", " ")}
                        </span>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {c.subscription_ends_at
                            ? `till ${new Date(c.subscription_ends_at).toLocaleDateString()}`
                            : "no expiry"}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{cs?.users ?? 0}</td>
                      <td className="px-4 py-3 tabular-nums">{cs?.customers ?? 0}</td>
                      <td className="px-4 py-3 tabular-nums">{cs?.jobs ?? 0}</td>
                      <td className="px-4 py-3 tabular-nums">₹{Number(cs?.revenue ?? 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild aria-label="Open business data">
                            <Link to="/business/$id" params={{ id: c.id }}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSubCompany(c)}
                            aria-label="Manage subscription"
                          >
                            <CalendarClock className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Edit business">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete business"
                            onClick={() => {
                              if (confirm(`Delete ${c.name}? This will permanently remove the business and ALL its associated data from the platform. This action cannot be undone.`)) {
                                remove.mutate(c.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Resource usage section removed at user request */}

      <PlatformUsers companies={companies.data ?? []} />

      <ManageSubscription company={subCompany} onClose={() => setSubCompany(null)} />



      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit business" : "New business"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Business name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: editing ? f.slug : slugify(e.target.value),
                  }))
                }
                placeholder="Acme Services Pvt Ltd"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_STATUSES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <LogoUpload
              value={form.logo_url ?? ""}
              slug={form.slug || "company"}
              onChange={(v) => setForm((f) => ({ ...f, logo_url: v }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Contact name</Label>
                <Input value={form.contact_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Contact email</Label>
                <Input type="email" value={form.contact_email ?? ""} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Contact phone</Label>
                <Input value={form.contact_phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Address</Label>
              <Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Internal notes</Label>
              <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Create business"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
