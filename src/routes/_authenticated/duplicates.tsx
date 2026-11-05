import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { listDuplicateCustomerGroups, type Customer } from "@/lib/api/customers";
import { mergeCustomers } from "@/lib/api/leads";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { useRoles } from "@/hooks/use-session";

export const Route = createFileRoute("/_authenticated/duplicates")({
  component: DuplicatesPage,
  head: () => ({
    meta: [
      { title: "Duplicate Customers | Ishan Detailing OS" },
      { name: "description", content: "Review and merge duplicate customer records." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function DuplicatesPage() {
  const { isAdmin, isReady } = useRoles();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["duplicate-customers"],
    queryFn: listDuplicateCustomerGroups,
    enabled: isReady && isAdmin,
  });

  const merge = useMutation({
    mutationFn: async ({ source, target }: { source: string; target: string }) => {
      await mergeCustomers(source, target);
    },
    onSuccess: () => {
      toast.success("Merged. All related records moved to the surviving customer.");
      qc.invalidateQueries({ queryKey: ["duplicate-customers"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Merge failed"),
  });

  if (isReady && !isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Duplicates" subtitle="Admin only." />
        <EmptyState icon={Users} title="Not authorized" description="Only Owners and Super Admins can merge duplicates." />
      </div>
    );
  }

  const groups = q.data ?? [];
  return (
    <div className="space-y-4">
      <PageHeader title="Duplicate customers" subtitle="Customers who share a normalized phone number. Pick which record to keep." />
      {q.isLoading && <Card className="p-6 text-sm text-muted-foreground">Scanning…</Card>}
      {!q.isLoading && groups.length === 0 && (
        <EmptyState icon={Users} title="No duplicates found" description="Every customer has a unique phone number." />
      )}
      <div className="grid gap-4">
        {groups.map((g) => (
          <Card key={g.normalized_phone} className="p-4 space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Phone </span>
              <span className="font-semibold tabular">+91 {g.normalized_phone}</span>
              <span className="text-muted-foreground"> · {g.customers.length} records</span>
            </div>
            <div className="grid gap-2">
              {g.customers.map((c: Customer) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <Link to="/customers/$id" params={{ id: c.id }} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      Raw {c.phone} · Created {formatDate(c.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {g.customers
                      .filter((o) => o.id !== c.id)
                      .map((o) => (
                        <Button
                          key={o.id}
                          size="sm"
                          variant="outline"
                          disabled={merge.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `Merge "${o.name}" INTO "${c.name}"?\n\nAll vehicles, quotes, jobs, invoices, payments, media and activity from "${o.name}" will move to "${c.name}". "${o.name}" will be archived.`,
                              )
                            ) {
                              merge.mutate({ source: o.id, target: c.id });
                            }
                          }}
                        >
                          Keep this · absorb {o.name.slice(0, 14)}
                        </Button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
