import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { useMySubscription } from "@/hooks/use-subscription";
import { useRoles } from "@/hooks/use-session";

/**
 * Blocks a tenant's workspace when the platform subscription is inactive
 * (suspended, cancelled or past the expiry + grace window).
 * Super admins are never locked out.
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { isSuperAdmin, isReady } = useRoles();
  const { data, isLoading } = useMySubscription();

  if (isSuperAdmin || !isReady || isLoading || !data || data.is_active) return <>{children}</>;

  const effectiveEnd = data.subscription_ends_at ?? (data.status === "trial" ? data.trial_ends_at : null);
  const expired = effectiveEnd ? new Date(effectiveEnd) : null;

  return (
    <Card className="mx-auto max-w-lg p-8 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-lg font-semibold">Subscription inactive</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {data.name}&apos;s subscription is <span className="capitalize">{data.status}</span>
        {expired ? ` (ended on ${expired.toLocaleDateString()})` : ""}. Creating and editing records is
        disabled until it is renewed. Contact the platform administrator on{" "}
        <a href="tel:+919586461871" className="font-medium text-foreground hover:underline">
          +91 95864 61871
        </a>{" "}
        to restore access for your team.
      </p>
    </Card>
  );
}
