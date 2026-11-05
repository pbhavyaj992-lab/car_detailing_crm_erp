import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

export type AppRole = "super_admin" | "admin" | "owner" | "manager" | "reception" | "worker";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, ready };
}

export function useRoles() {
  const { user, ready } = useSession();
  const q = useQuery({
    queryKey: ["user_roles", user?.id],
    enabled: ready && !!user,
    queryFn: async () => {
      if (!user) return [] as AppRole[];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
  });
  const roles = q.data ?? [];
  return {
    roles,
    isReady: ready && q.isFetched,
    hasRole: (r: AppRole) => roles.includes(r),
    hasAny: (rs: AppRole[]) => roles.some((r) => rs.includes(r)),
    isAdmin: roles.some((r) => r === "super_admin" || r === "admin" || r === "owner"),
    isSuperAdmin: roles.includes("super_admin"),
    canFinance: roles.some((r) =>
      ["super_admin", "owner", "manager", "reception"].includes(r),
    ),
    isWorkerOnly: roles.length > 0 && roles.every((r) => r === "worker"),
  };
}

export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      return data;
    },
  });
}
