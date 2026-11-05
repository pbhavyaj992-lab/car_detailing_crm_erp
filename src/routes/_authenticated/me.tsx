import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useProfile, useRoles, useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "My Profile | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MePage,
});

function MePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { roles } = useRoles();
  const { user } = useSession();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader title="My Profile" subtitle="Manage your personal profile and preferences." />
      <Card className="p-4 space-y-2">
        <div>
          <div className="text-xs text-muted-foreground">Name</div>
          <div className="font-medium">{profile?.full_name ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Email</div>
          <div className="text-sm">{user?.email}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Roles</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {roles.length === 0 && <span className="text-xs text-muted-foreground">No roles assigned</span>}
            {roles.map((r) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}
          </div>
        </div>
      </Card>
      <Button variant="secondary" className="w-full" onClick={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
    </div>
  );
}
