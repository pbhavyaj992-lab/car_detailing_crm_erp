import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { listStaff } from "@/lib/api/settings";
import { inviteStaff, removeStaff, toggleUserRole, setUserPermission } from "@/lib/admin.functions";
import { useRoles } from "@/hooks/use-session";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Check, Minus, ChevronDown, UserPlus, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff")({
  component: StaffPage,
  head: () => ({
    meta: [
      { title: "Staff & Permissions | Ishan Detailing OS" },
      { name: "description", content: "Manage staff accounts, roles, and per-user permissions." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Staff & Permissions | Ishan Detailing OS" },
      { property: "og:description", content: "Manage staff accounts, roles, and per-user permissions." },
    ],
  }),
});

const ROLES = [
  { key: "super_admin", label: "Super Admin", tone: "bg-rose-100 text-rose-700 border-rose-200" },
  { key: "admin", label: "Admin", tone: "bg-orange-100 text-orange-700 border-orange-200" },
  { key: "owner", label: "Owner", tone: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { key: "manager", label: "Manager", tone: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "reception", label: "Reception", tone: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "worker", label: "Worker", tone: "bg-amber-100 text-amber-700 border-amber-200" },
] as const;

type RoleKey = (typeof ROLES)[number]["key"];

/** Roles a business can assign. super_admin is platform-only and never shown here. */
const ASSIGNABLE_ROLES = ROLES.filter((r) => r.key !== "super_admin");

type Permission = { key: string; label: string; roles: RoleKey[] };

const PERMISSION_GROUPS: { group: string; items: Permission[] }[] = [
  {
    group: "Dashboard & Insights",
    items: [
      { key: "dashboard.view", label: "View dashboard & KPIs", roles: ["super_admin", "admin", "owner", "manager"] },
      { key: "garage.view", label: "View live garage board", roles: ["super_admin", "admin", "owner", "manager", "reception", "worker"] },
      { key: "activity.view", label: "View global activity log", roles: ["super_admin", "admin", "owner", "manager"] },
    ],
  },
  {
    group: "Customers & Vehicles",
    items: [
      { key: "search.use", label: "Search customers, vehicles & jobs", roles: ["super_admin", "admin", "owner", "manager", "reception", "worker"] },
      { key: "customers.edit", label: "Create / edit customers & vehicles", roles: ["super_admin", "admin", "owner", "manager", "reception"] },
      { key: "customers.history", label: "View customer history & lifetime spend", roles: ["super_admin", "admin", "owner", "manager", "reception"] },
    ],
  },
  {
    group: "Quotes & Jobs",
    items: [
      { key: "quotes.create", label: "Create quotes (wizard)", roles: ["super_admin", "admin", "owner", "manager", "reception"] },
      { key: "quotes.convert", label: "Approve & convert quote to job", roles: ["super_admin", "admin", "owner", "manager", "reception"] },
      { key: "jobs.update_status", label: "Update job status (work started, in progress)", roles: ["super_admin", "admin", "owner", "manager", "reception", "worker"] },
      { key: "jobs.upload_media", label: "Upload pre / post work photos", roles: ["super_admin", "admin", "owner", "manager", "reception", "worker"] },
      { key: "jobs.deliver", label: "Deliver & generate invoice", roles: ["super_admin", "admin", "owner", "manager", "reception"] },
    ],
  },
  {
    group: "Finance",
    items: [
      { key: "invoices.view", label: "View invoices & payments", roles: ["super_admin", "admin", "owner", "manager", "reception"] },
      { key: "payments.record", label: "Record payments", roles: ["super_admin", "admin", "owner", "manager", "reception"] },
      { key: "pdf.download", label: "Download / print quote & invoice PDFs", roles: ["super_admin", "admin", "owner", "manager", "reception"] },
    ],
  },
  {
    group: "Administration",
    items: [
      { key: "settings.manage", label: "Manage business settings & services catalog", roles: ["super_admin", "admin", "owner"] },
      { key: "staff.manage", label: "Invite / remove staff", roles: ["super_admin", "admin", "owner"] },
      { key: "roles.assign", label: "Assign & change staff roles", roles: ["super_admin", "admin", "owner"] },
      { key: "records.delete", label: "Delete customers, vehicles or jobs", roles: ["super_admin", "admin", "owner"] },
    ],
  },
];

const ALL_PERMS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items);

function permissionFromRoles(perm: Permission, userRoles: RoleKey[]): boolean {
  return perm.roles.some((r) => userRoles.includes(r));
}

function effectivePermission(perm: Permission, userRoles: RoleKey[], overrides: Record<string, boolean>): boolean {
  if (perm.key in overrides) return overrides[perm.key];
  return permissionFromRoles(perm, userRoles);
}

function StaffPage() {
  const { isAdmin } = useRoles();
  if (!isAdmin) return <div className="text-sm text-muted-foreground">Admins only.</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="Staff & Permissions" subtitle="Manage team members, assign roles, and control what each person can do." />
      <StaffSection />
      <RolePermissionsSection />
    </div>
  );
}

function RolePermissionsSection() {
  return (
    <Card className="p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Roles & permissions presets</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Roles act as presets. Every permission can also be toggled individually per user above.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ASSIGNABLE_ROLES.map((r) => (
          <span key={r.key} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${r.tone}`}>
            {r.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left font-medium px-3 py-2 w-[42%]">Permission</th>
              {ASSIGNABLE_ROLES.map((r) => (
                <th key={r.key} className="text-center font-medium px-2 py-2 text-xs">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <>
                <tr key={g.group} className="bg-muted/30">
                  <td colSpan={ASSIGNABLE_ROLES.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.group}
                  </td>
                </tr>
                {g.items.map((p) => (
                  <tr key={p.key} className="border-t">
                    <td className="px-3 py-2">{p.label}</td>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <td key={r.key} className="text-center px-2 py-2">
                        {p.roles.includes(r.key) ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" />
                        ) : (
                          <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function StaffSection() {
  const qc = useQueryClient();
  const staff = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const invite = useServerFn(inviteStaff);
  const remove = useServerFn(removeStaff);
  const toggleRole = useServerFn(toggleUserRole);
  const setPerm = useServerFn(setUserPermission);

  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "reception" });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: form }),
    onSuccess: () => { toast.success("Staff added"); setForm({ email: "", password: "", full_name: "", role: "reception" }); setShowAdd(false); qc.invalidateQueries({ queryKey: ["staff"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { user_id: string; role: RoleKey; enabled: boolean }) => toggleRole({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const permMut = useMutation({
    mutationFn: (v: { user_id: string; permission_key: string; state: "grant" | "revoke" | "inherit" }) => setPerm({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Team members</h2>
          <p className="text-xs text-muted-foreground">Toggle roles as presets, or flip individual permissions per person.</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd((v) => !v)}>
          <UserPlus className="mr-1 h-4 w-4" />
          {showAdd ? "Close" : "Add staff"}
        </Button>
      </div>

      {showAdd && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <h3 className="text-sm font-semibold">Create new account</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <Input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Temporary password (min 8)" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select className="h-10 rounded-md border bg-background px-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ASSIGNABLE_ROLES.map((r) => r.key).map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Button onClick={() => inviteMut.mutate()} disabled={inviteMut.isPending || !form.email || form.password.length < 8}>Create account</Button>
        </div>
      )}

      <div className="space-y-2">
        {(staff.data ?? []).map((u) => {
          const isOpen = expanded === u.id;
          const userRoles = (u.roles ?? []) as RoleKey[];
          const overrides = (u as any).permission_overrides ?? {};
          return (
            <div key={u.id} className="rounded-lg border">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 p-2 text-sm">
                <div>
                  <div className="font-medium">{u.full_name ?? "—"}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {userRoles.length === 0 && <span className="text-xs text-muted-foreground">No roles</span>}
                    {userRoles.filter((r) => r !== "super_admin").map((r) => {
                      const meta = ROLES.find((x) => x.key === r);
                      return (
                        <span key={r} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta?.tone ?? ""}`}>
                          {meta?.label ?? r}
                        </span>
                      );
                    })}
                    {Object.keys(overrides).length > 0 && (
                      <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        {Object.keys(overrides).length} custom
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="inline-flex h-11 items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-secondary"
                  onClick={() => setExpanded(isOpen ? null : u.id)}
                >
                  Permissions <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                <button
                  aria-label={`Remove ${u.full_name ?? "user"}`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                  onClick={async () => { if (confirm("Remove this user?")) { await remove({ data: { user_id: u.id } }); qc.invalidateQueries({ queryKey: ["staff"] }); } }}
                ><Trash2 className="h-4 w-4" /></button>
              </div>
              {isOpen && (
                <div className="border-t bg-muted/30 p-3 space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role presets</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ASSIGNABLE_ROLES.map((r) => {
                        const enabled = userRoles.includes(r.key);
                        return (
                          <div key={r.key} className="flex items-center justify-between gap-3 rounded-md border bg-background p-2">
                            <div>
                              <div className="text-sm font-medium">{r.label}</div>
                              <div className="text-[11px] text-muted-foreground">
                                Preset: {ALL_PERMS.filter((p) => p.roles.includes(r.key)).length} permissions
                              </div>
                            </div>
                            <Switch
                              checked={enabled}
                              disabled={toggleMut.isPending}
                              onCheckedChange={(v) => toggleMut.mutate({ user_id: u.id, role: r.key, enabled: v })}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Individual permissions</div>
                      <div className="text-[11px] text-muted-foreground">Toggle any permission independently of roles</div>
                    </div>
                    <div className="rounded-md border bg-background divide-y">
                      {PERMISSION_GROUPS.map((g) => (
                        <div key={g.group} className="p-2">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1 pb-1">{g.group}</div>
                          <div className="space-y-1">
                            {g.items.map((p) => {
                              const fromRole = permissionFromRoles(p, userRoles);
                              const override = p.key in overrides ? overrides[p.key] : null;
                              const effective = effectivePermission(p, userRoles, overrides);
                              const isCustom = override !== null;
                              return (
                                <div key={p.key} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/40">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-sm">{p.label}</div>
                                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      <span>Role default: {fromRole ? "granted" : "denied"}</span>
                                      {isCustom && (
                                        <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-medium text-violet-700">
                                          Custom {override ? "grant" : "revoke"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isCustom && (
                                      <button
                                        aria-label="Reset to role default"
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
                                        onClick={() => permMut.mutate({ user_id: u.id, permission_key: p.key, state: "inherit" })}
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                    <Switch
                                      checked={effective}
                                      disabled={permMut.isPending}
                                      onCheckedChange={(v) => {
                                        // If toggling to the same value as role default, clear override; otherwise set explicit
                                        if (v === fromRole) {
                                          permMut.mutate({ user_id: u.id, permission_key: p.key, state: "inherit" });
                                        } else {
                                          permMut.mutate({ user_id: u.id, permission_key: p.key, state: v ? "grant" : "revoke" });
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
