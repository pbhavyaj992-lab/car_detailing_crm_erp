import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { getMyCompany } from "@/lib/api/my-company";
import { SubscriptionGate } from "@/components/subscription-gate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { data: company } = useQuery({
    queryKey: ["my-company"],
    queryFn: getMyCompany,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return (
    <AppShell company={company}>
      <SubscriptionGate>
        <Outlet />
      </SubscriptionGate>
    </AppShell>
  );
}
