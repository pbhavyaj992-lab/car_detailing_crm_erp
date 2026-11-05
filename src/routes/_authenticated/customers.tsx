import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { listCustomers } from "@/lib/api/customers";
import { formatDate, formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CustomersList,
});

type SortKey = "recent" | "spent" | "visits";

function CustomersList() {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const query = useQuery({ queryKey: ["customers", q], queryFn: () => listCustomers(q) });

  const rows = useMemo(() => {
    const data = [...(query.data ?? [])];
    if (sort === "spent") data.sort((a, b) => b.lifetime_spent - a.lifetime_spent);
    else if (sort === "visits") data.sort((a, b) => b.job_count - a.job_count);
    return data;
  }, [query.data, sort]);

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" subtitle="Everyone who's brought a vehicle to the shop." />
      <Input placeholder="Search by name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="h-11" />
      <div className="flex flex-wrap gap-2">
        {(["recent", "spent", "visits"] as SortKey[]).map((k) => (
          <Button key={k} className="h-10" variant={sort === k ? "default" : "outline"} onClick={() => setSort(k)}>
            {k === "recent" ? "Recent" : k === "spent" ? "Top spenders" : "Most visits"}
          </Button>
        ))}
      </div>
      <div className="grid gap-2">
        {query.isLoading && Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[92px] w-full rounded-[var(--radius)]" />
        ))}
        {rows.map((c) => (
          <Link key={c.id} to="/customers/$id" params={{ id: c.id }}>
            <Card className="p-4 transition-shadow hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-sm text-muted-foreground">{c.phone}</div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span><span className="font-medium text-foreground tabular">{c.job_count}</span> {c.job_count === 1 ? "visit" : "visits"}</span>
                    <span>Lifetime <span className="font-medium text-foreground tabular">{formatINR(c.lifetime_spent)}</span></span>
                    {c.last_visit && <span>Last {formatDate(c.last_visit)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-semibold tabular">{formatINR(c.lifetime_spent)}</div>
                  <div className="text-xs text-muted-foreground">{c.job_count} {c.job_count === 1 ? "job" : "jobs"}</div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
        {rows.length === 0 && !query.isLoading && (
          <EmptyState
            icon={Users}
            title={q ? "No customers found" : "No customers yet"}
            description={q ? "Try a different name or phone number." : "Start a new quote to add your first customer."}
            action={<Link to="/new"><Button size="sm">New quote</Button></Link>}
          />
        )}
      </div>
    </div>
  );
}
