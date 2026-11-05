import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// The platform Super Admin is a single fixed account and can never be granted
// to anyone else, so it is not an assignable role.
const roleSchema = z.enum(["admin", "owner", "manager", "reception", "worker"]);


async function assertSuperAdmin(supabaseClient: any, userId: string) {
  const { data } = await supabaseClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin");
  if (!data || data.length === 0) throw new Error("Forbidden — super admin only");
}

export type PlatformUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
  company_id: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
};

/** Every user on the platform, with their role and tenant. */
export const listPlatformUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlatformUser[]> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: roles }, { data: profiles }, authList] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role, company_id"),
      supabaseAdmin.from("profiles").select("id, full_name, phone"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const profileById = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const authById = new Map((authList.data?.users ?? []).map((u: any) => [u.id, u]));

    return (roles ?? []).map((r: any) => {
      const au = authById.get(r.user_id);
      const pf = profileById.get(r.user_id);
      return {
        user_id: r.user_id,
        email: au?.email ?? null,
        full_name: pf?.full_name ?? au?.user_metadata?.full_name ?? null,
        phone: pf?.phone ?? null,
        role: r.role,
        company_id: r.company_id ?? null,
        last_sign_in_at: au?.last_sign_in_at ?? null,
        created_at: au?.created_at ?? null,
      };
    });
  });

/** Create a user (typically an owner) attached to a tenant company. */
export const createCompanyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; password: string; full_name: string; phone?: string; role: string; company_id: string }) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        full_name: z.string().min(1),
        phone: z.string().optional(),
        role: roleSchema,
        company_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: data.phone ?? null },
    });
    if (error) throw error;
    const uid = created?.user?.id;
    if (!uid) throw new Error("User was not created");

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: uid, full_name: data.full_name, phone: data.phone ?? null }, { onConflict: "id" });

    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: roleError } = await supabaseAdmin
      .from("user_roles" as any)
      .insert({ user_id: uid, role: data.role as any, company_id: data.company_id });
    if (roleError) throw roleError;

    return { ok: true, user_id: uid };
  });

/** Change a user's role and/or move them to another tenant. */
export const updateCompanyUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: string; company_id: string; full_name?: string; phone?: string }) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: roleSchema,
        company_id: z.string().uuid(),
        full_name: z.string().optional(),
        phone: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Return instead of throwing: a thrown error crosses the RPC boundary as an
    // unhandled runtime error and blanks the admin screen.
    if (data.user_id === context.userId) {
      return { ok: false as const, message: "The platform super admin account cannot be changed" };
    }




    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles" as any)
      .insert({ user_id: data.user_id, role: data.role as any, company_id: data.company_id });
    if (error) throw error;

    if (data.full_name || data.phone) {
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { id: data.user_id, full_name: data.full_name ?? null, phone: data.phone ?? null },
          { onConflict: "id" },
        );
    }
    return { ok: true };
  });

/** Set a new password for any platform user. */
export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; password: string }) =>
    z.object({ user_id: z.string().uuid(), password: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    
    if (error) {
      // Catch all errors and return them cleanly.
      return { ok: false as const, message: error.message };
    }
    return { ok: true };
  });

/** Delete a platform user entirely. */
export const deletePlatformUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    // Return instead of throwing: a thrown error here crosses the RPC boundary
    // as an unhandled runtime error and blanks the admin screen.
    if (data.user_id === context.userId) {
      return { ok: false as const, message: "You cannot delete your own account" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    return { ok: true };
  });
