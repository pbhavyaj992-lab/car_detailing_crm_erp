import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getSettings, updateSettings } from "@/lib/api/settings";
import { listAllServices, upsertService, deleteService } from "@/lib/api/services";
import { getMyCompany, updateMyCompany } from "@/lib/api/my-company";
import { LogoUpload } from "@/components/logo-upload";
import { useRoles } from "@/hooks/use-session";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useRoles();
  if (!isAdmin) return <div className="text-sm text-muted-foreground">Admins only.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Business identity, logo and services catalog. Manage staff in the Staff section." />
      <CompanyProfileSection />
      
      <BusinessSection />
      <ServicesSection />
    </div>
  );
}

function CompanyProfileSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-company"], queryFn: getMyCompany });
  const [form, setForm] = useState<any>(null);
  const c = form ?? q.data;
  const mut = useMutation({
    mutationFn: () =>
      updateMyCompany(c.id, {
        name: c.name,
        logo_url: c.logo_url || null,
        contact_name: c.contact_name || null,
        contact_email: c.contact_email || null,
        contact_phone: c.contact_phone || null,
        address: c.address || null,
      }),
    onSuccess: () => {
      toast.success("Business profile saved");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["my-company"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!c) return null;
  const set = (patch: Record<string, unknown>) => setForm({ ...c, ...patch });
  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="font-semibold">Business profile</h2>
        <p className="text-xs text-muted-foreground">
          Details set up by the platform admin — you can update them here. Plan {c.plan_tier} · {c.seats} seats · status {c.status}.
        </p>
      </div>
      <LogoUpload value={c.logo_url ?? ""} slug={c.slug} onChange={(v) => set({ logo_url: v })} label="Business logo" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Business name</Label><Input className="mt-1" value={c.name ?? ""} onChange={(e) => set({ name: e.target.value })} /></div>
        <div><Label>Contact person</Label><Input className="mt-1" value={c.contact_name ?? ""} onChange={(e) => set({ contact_name: e.target.value })} /></div>
        <div><Label>Contact email</Label><Input type="email" className="mt-1" value={c.contact_email ?? ""} onChange={(e) => set({ contact_email: e.target.value })} /></div>
        <div><Label>Contact phone</Label><Input className="mt-1" value={c.contact_phone ?? ""} onChange={(e) => set({ contact_phone: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Address</Label><Input className="mt-1" value={c.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={!form || mut.isPending}>Save</Button>
    </Card>
  );
}


function BusinessSection() {
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [form, setForm] = useState<any>(null);
  const s = form ?? q.data;
  const mut = useMutation({
    mutationFn: () => updateSettings(form),
    onSuccess: () => { toast.success("Saved"); q.refetch(); },
  });
  if (!s) return null;
  return (
    <Card className="p-4 space-y-3">
      <h2 className="font-semibold">Billing & documents</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Name on documents</Label><Input className="mt-1" value={s.business_name ?? ""} onChange={(e) => setForm({ ...s, business_name: e.target.value })} /></div>
        <div><Label>GSTIN</Label><Input className="mt-1" value={s.gstin ?? ""} onChange={(e) => setForm({ ...s, gstin: e.target.value })} /></div>
        <div><Label>Phone</Label><Input className="mt-1" value={s.phone ?? ""} onChange={(e) => setForm({ ...s, phone: e.target.value })} /></div>
        <div><Label>Email</Label><Input className="mt-1" value={s.email ?? ""} onChange={(e) => setForm({ ...s, email: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Address</Label><Input className="mt-1" value={s.address ?? ""} onChange={(e) => setForm({ ...s, address: e.target.value })} /></div>
        <div><Label>Default GST (%)</Label><Input type="number" className="mt-1" value={s.default_tax_rate ?? 18} onChange={(e) => setForm({ ...s, default_tax_rate: Number(e.target.value) })} /></div>
        <div><Label>Quote prefix</Label><Input className="mt-1" value={s.quote_prefix ?? ""} onChange={(e) => setForm({ ...s, quote_prefix: e.target.value })} /></div>
        <div><Label>Job prefix</Label><Input className="mt-1" value={s.job_prefix ?? ""} onChange={(e) => setForm({ ...s, job_prefix: e.target.value })} /></div>
        <div><Label>Invoice prefix</Label><Input className="mt-1" value={s.invoice_prefix ?? ""} onChange={(e) => setForm({ ...s, invoice_prefix: e.target.value })} /></div>
      </div>
      <Button onClick={() => mut.mutate()} disabled={!form || mut.isPending}>Save</Button>
    </Card>
  );
}

function ServicesSection() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["services-all"], queryFn: listAllServices });
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const add = useMutation({
    mutationFn: () => upsertService({ name, price: Number(price), active: true }),
    onSuccess: () => { setName(""); setPrice(""); qc.invalidateQueries({ queryKey: ["services-all"] }); qc.invalidateQueries({ queryKey: ["services"] }); },
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services-all"] }),
  });
  const upd = useMutation({
    mutationFn: (row: any) => upsertService(row),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services-all"] }),
  });
  return (
    <Card className="p-4 space-y-3">
      <h2 className="font-semibold">Services & prices</h2>
      <div className="space-y-1">
        {(q.data ?? []).map((s) => (
          <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_120px_auto_auto] items-center gap-2">
            <Input defaultValue={s.name} onBlur={(e) => e.target.value !== s.name && upd.mutate({ ...s, name: e.target.value })} />
            <Input type="number" defaultValue={s.price} onBlur={(e) => Number(e.target.value) !== s.price && upd.mutate({ ...s, price: Number(e.target.value) })} />
            <Badge variant={s.active ? "default" : "secondary"} className="text-[10px]">{s.active ? "Active" : "Hidden"}</Badge>
            <button aria-label={`Delete ${s.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive" onClick={() => del.mutate(s.id)}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-2 pt-2 border-t">
        <Input placeholder="New service name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Button onClick={() => add.mutate()} disabled={!name || !price}><Plus className="mr-1 h-4 w-4" />Add</Button>
      </div>
    </Card>
  );
}
