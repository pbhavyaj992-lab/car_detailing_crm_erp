import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { isSubscriptionActive, type Company } from "@/lib/api/companies";

export type MySubscription = {
  company_id: string;
  name: string;
  status: string;
  plan_tier: string;
  billing_cycle: string;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  trial_ends_at: string | null;
  grace_days: number;
  is_active: boolean;
};

/** Subscription state of the signed-in user's own tenant. */
export function useMySubscription() {
  const { user, ready } = useSession();
  return useQuery({
    queryKey: ["my-subscription", user?.id],
    enabled: ready && !!user,
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    queryFn: async () => {
      const { data: companyId, error: companyIdError } = await supabase.rpc("current_company_id" as any);
      if (companyIdError) throw companyIdError;
      if (!companyId) return null;

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const company = data as Company;
      return {
        company_id: company.id,
        name: company.name,
        status: company.status,
        plan_tier: company.plan_tier,
        billing_cycle: company.billing_cycle,
        subscription_started_at: company.subscription_started_at,
        subscription_ends_at: company.subscription_ends_at,
        trial_ends_at: company.trial_ends_at,
        grace_days: company.grace_days,
        is_active: isSubscriptionActive(company),
      } satisfies MySubscription;
    },
  });
}
