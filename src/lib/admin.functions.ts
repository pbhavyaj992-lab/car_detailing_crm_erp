import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Roles a business (tenant) admin may assign. `super_admin` is a platform-level
 * role and is deliberately NOT assignable from inside a business.
 */
const tenantRoleSchema = z.enum(["admin", "owner", "manager", "reception", "worker"]);

/** Verify the caller is an admin of a business and return that business id. */
async function assertAdmin(supabaseClient: any, userId: string): Promise<string> {
  const { data } = await supabaseClient
    .from("user_roles")
    .select("role, company_id")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin", "owner"]);
  if (!data || data.length === 0) throw new Error("Forbidden");
  return data[0].company_id as string;
}

/** Ensure the target user belongs to the caller's business (no cross-tenant edits). */
async function assertSameCompany(admin: any, targetUserId: string, companyId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", targetUserId)
    .eq("company_id", companyId)
    .limit(1);
  if (!data || data.length === 0) throw new Error("User does not belong to your business");
}

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: string }) =>
    z.object({ user_id: z.string().uuid(), role: tenantRoleSchema }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSameCompany(supabaseAdmin, data.user_id, companyId);
    await supabaseAdmin.from("user_roles" as any).delete().eq("user_id", data.user_id).eq("company_id", companyId);
    const { error } = await supabaseAdmin
      .from("user_roles" as any)
      .insert({ user_id: data.user_id, role: data.role as any, company_id: companyId });
    if (error) throw error;
    return { ok: true };
  });

export const toggleUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: string; enabled: boolean }) =>
    z.object({ user_id: z.string().uuid(), role: tenantRoleSchema, enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSameCompany(supabaseAdmin, data.user_id, companyId);
    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_roles" as any)
        .insert({ user_id: data.user_id, role: data.role as any, company_id: companyId })
        .select()
        .maybeSingle();
      if (error && !String(error.message).toLowerCase().includes("duplicate")) throw error;
    } else {
      if (data.user_id === context.userId && data.role === "owner") {
        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("company_id", companyId)
          .eq("role", "owner");
        const otherAdmins = (admins ?? []).filter((r: any) => r.user_id !== context.userId);
        if (otherAdmins.length === 0) throw new Error("Cannot remove the last owner role from yourself");
      }
      const { error } = await supabaseAdmin
        .from("user_roles" as any)
        .delete()
        .eq("user_id", data.user_id)
        .eq("company_id", companyId)
        .eq("role", data.role as any);
      if (error) throw error;
    }
    return { ok: true };
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; full_name: string; role: string }) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
      full_name: z.string().min(1),
      role: tenantRoleSchema,
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw error;
    if (user?.user) {
      await supabaseAdmin.from("user_roles" as any).delete().eq("user_id", user.user.id);
      await supabaseAdmin
        .from("user_roles" as any)
        .insert({ user_id: user.user.id, role: data.role as any, company_id: companyId });
    }
    return { ok: true, id: user?.user?.id };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      return { ok: false as const, message: "You cannot remove your own account" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSameCompany(supabaseAdmin, data.user_id, companyId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    return { ok: true };
  });

export const setUserPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; permission_key: string; state: "grant" | "revoke" | "inherit" }) =>
    z.object({
      user_id: z.string().uuid(),
      permission_key: z.string().min(1),
      state: z.enum(["grant", "revoke", "inherit"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertSameCompany(supabaseAdmin, data.user_id, companyId);
    if (data.state === "inherit") {
      const { error } = await supabaseAdmin
        .from("user_permissions" as any)
        .delete()
        .eq("user_id", data.user_id)
        .eq("company_id", companyId)
        .eq("permission_key", data.permission_key);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("user_permissions" as any).upsert(
        {
          user_id: data.user_id,
          company_id: companyId,
          permission_key: data.permission_key,
          granted: data.state === "grant",
        },
        { onConflict: "user_id,permission_key" },
      );
      if (error) throw error;
    }
    return { ok: true };
  });
