import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Search as SearchIcon } from "lucide-react";
import { globalSearch } from "@/lib/api/search";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({
    meta: [
      { title: "Search | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const results = useQuery({
    queryKey: ["search", q],
    queryFn: () => globalSearch(q),
    enabled: q.trim().length > 1,
  });
  const d = results.data;
  const empty = d && d.customers.length === 0 && d.vehicles.length === 0 && d.jobs.length === 0 && d.quotes.length === 0 && d.invoices.length === 0;
  return (
    <div className="space-y-4">
      <PageHeader title="Search" subtitle="Instantly find customers, vehicles, jobs, quotes and invoices." />
      <Input autoFocus placeholder="Phone, vehicle no., invoice, job or name" value={q} onChange={(e) => setQ(e.target.value)} className="h-12" />
      {empty && <EmptyState icon={SearchIcon} title="No results" description="Try a different name, phone or number." />}

      {d && (
        <div className="space-y-4">
          <Group title="Customers" empty={d.customers.length === 0}>
            {d.customers.map((c) => (
              <Link key={c.id} to="/customers/$id" params={{ id: c.id }} className="block"><Card className="p-3"><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.phone}</div></Card></Link>
            ))}
          </Group>
          <Group title="Vehicles" empty={d.vehicles.length === 0}>
            {d.vehicles.map((v: any) => (
              <Link key={v.id} to="/vehicles/$id" params={{ id: v.id }} className="block"><Card className="p-3"><div className="font-medium">{v.number}</div><div className="text-xs text-muted-foreground">{v.customer?.name}</div></Card></Link>
            ))}
          </Group>
          <Group title="Jobs" empty={d.jobs.length === 0}>
            {d.jobs.map((j: any) => (
              <Link key={j.id} to="/jobs/$id" params={{ id: j.id }} className="block"><Card className="p-3"><div className="font-medium">{j.number}</div><div className="text-xs text-muted-foreground">{j.vehicle?.number} · {j.customer?.name}</div></Card></Link>
            ))}
          </Group>
          <Group title="Quotes" empty={d.quotes.length === 0}>
            {d.quotes.map((row: any) => (
              <Link key={row.id} to="/quotes/$id" params={{ id: row.id }} className="block"><Card className="p-3"><div className="flex justify-between"><span className="font-medium">{row.number}</span><span>{formatINR(row.total)}</span></div><div className="text-xs text-muted-foreground">{row.customer?.name}</div></Card></Link>
            ))}
          </Group>
          <Group title="Invoices" empty={d.invoices.length === 0}>
            {d.invoices.map((i: any) => (
              <Link key={i.id} to="/invoices/$id" params={{ id: i.id }} className="block"><Card className="p-3"><div className="flex justify-between"><span className="font-medium">{i.number}</span><span>{formatINR(i.total)}</span></div><div className="text-xs text-muted-foreground">{i.customer?.name}</div></Card></Link>
            ))}
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ title, children, empty }: { title: string; children: React.ReactNode; empty: boolean }) {
  if (empty) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title.toUpperCase()}</div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}
