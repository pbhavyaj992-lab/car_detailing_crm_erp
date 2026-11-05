import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  createCompanyUser,
  deletePlatformUser,
  listPlatformUsers,
  resetUserPassword,
  updateCompanyUser,
  type PlatformUser,
} from "@/lib/platform-admin.functions";
import type { Company } from "@/lib/api/companies";

// Super admin is a single fixed platform account — never assignable here.
const ROLES = ["admin", "owner", "manager", "reception", "worker"] as const;


type FormState = {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: string;
  company_id: string;
};

const EMPTY: FormState = {
  email: "",
  password: "",
  full_name: "",
  phone: "",
  role: "owner",
  company_id: "",
};

export function PlatformUsers({ companies }: { companies: Company[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPlatformUsers);
  const createFn = useServerFn(createCompanyUser);
  const updateFn = useServerFn(updateCompanyUser);
  const deleteFn = useServerFn(deletePlatformUser);
  const resetFn = useServerFn(resetUserPassword);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [pwUser, setPwUser] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [filter, setFilter] = useState("all");

  // Only call the protected server fn once a session exists, otherwise the
  // bearer token is missing and the request fails with "Unauthorized".
  const [hasSession, setHasSession] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session);
      setMyId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
      setMyId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const users = useQuery({
    queryKey: ["platform-users"],
    queryFn: () => listFn({ data: undefined as never }),
    enabled: hasSession,
    retry: false,
  });


  const companyName = useMemo(() => {
    const m = new Map(companies.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? "—" : "—");
  }, [companies]);

  const rows = useMemo(() => {
    const all = users.data ?? [];
    return filter === "all" ? all : all.filter((u) => u.company_id === filter);
  }, [users.data, filter]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["platform-users"] });
    qc.invalidateQueries({ queryKey: ["platform-stats"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.company_id) throw new Error("Pick a business");
      if (editing) {
        const res = await updateFn({
          data: {
            user_id: editing.user_id,
            role: form.role,
            company_id: form.company_id,
            full_name: form.full_name,
            phone: form.phone,
          },
        });
        if (res && res.ok === false) throw new Error(res.message ?? "Could not update user");
      } else {

        if (form.password.length < 8) throw new Error("Password must be at least 8 characters");
        await createFn({
          data: {
            email: form.email.trim(),
            password: form.password,
            full_name: form.full_name.trim(),
            phone: form.phone,
            role: form.role,
            company_id: form.company_id,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "User updated" : "User created");
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { user_id: id } }),
    onSuccess: (res) => {
      if (res && res.ok === false) {
        toast.error(res.message ?? "Could not remove user");
        return;
      }
      toast.success("User removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPw = useMutation({
    mutationFn: async () => {
      if (!pwUser) return;
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      
      const res = await resetFn({ data: { user_id: pwUser.user_id, password: newPassword } });
      
      // If the server returns ok: false, it means an error occurred (like weak password)
      // but it was caught by the server function.
      if (res && res.ok === false) {
        throw new Error(res.message);
      }
    },
    onSuccess: () => {
      toast.success("Password updated successfully");
      setPwUser(null);
      setNewPassword("");
    },
    onError: (e: Error) => {
      // Provide clear feedback for validation/strength issues
      if (e.message.toLowerCase().includes("weak")) {
        toast.error("Password is too weak. Please use a mix of letters, numbers, and symbols.");
      } else {
        toast.error(e.message);
      }
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, company_id: filter !== "all" ? filter : companies[0]?.id ?? "" });
    setOpen(true);
  }

  function openEdit(u: PlatformUser) {
    setEditing(u);
    setForm({
      email: u.email ?? "",
      password: "",
      full_name: u.full_name ?? "",
      phone: u.phone ?? "",
      role: u.role,
      company_id: u.company_id ?? companies[0]?.id ?? "",
    });
    setOpen(true);
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserCog className="h-4 w-4 text-muted-foreground" /> Business owners &amp; users
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All businesses</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openCreate} disabled={companies.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Add user
          </Button>
        </div>
      </div>

      {users.isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground">No users yet for this selection.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Business</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Last sign in</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{u.full_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email || "—"}</td>
                  <td className="px-4 py-3">{companyName(u.company_id)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs capitalize">
                      {u.role.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit user" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Reset password"
                        onClick={() => {
                          setPwUser(u);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete user"
                        disabled={u.user_id === myId}
                        title={u.user_id === myId ? "You cannot delete your own account" : "Delete user"}
                        onClick={() => {
                          if (confirm(`Remove ${u.email ?? "this user"} from the platform?`)) {
                            remove.mutate(u.user_id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Business</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm((f) => ({ ...f, company_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select business" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="capitalize">{r.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Full name</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            {!editing && (
              <>
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Temporary password</Label>
                  <Input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : editing ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set new password</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label>{pwUser?.email}</Label>
            <Input 
              type="password"
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              placeholder="Min 8 characters" 
            />
            {newPassword.length > 0 && newPassword.length < 8 && (
              <p className="text-[11px] text-destructive">Must be at least 8 characters.</p>
            )}
            {newPassword.length >= 8 && (
              <p className="text-[11px] text-green-600">Password strength: OK</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwUser(null)}>Cancel</Button>
            <Button onClick={() => resetPw.mutate()} disabled={resetPw.isPending}>Update password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
