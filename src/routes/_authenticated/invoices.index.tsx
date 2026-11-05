import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Receipt } from "lucide-react";
import { listInvoices } from "@/lib/api/invoices";
import { formatINR, formatDate } from "@/lib/format";
import { openInvoiceForDownload } from "@/lib/print-download";

export const Route = createFileRoute("/_authenticated/invoices/")({
  head: () => ({
    meta: [
      { title: "Invoices | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: InvoicesList,
});

function InvoicesList() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["invoices"], queryFn: () => listInvoices({}) });
  return (
    <div className="space-y-4">
      <PageHeader title="Invoices" subtitle="Billed jobs and their payment status." />
      <div className="grid gap-2">
        {q.isLoading && Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[84px] w-full rounded-[var(--radius)]" />
        ))}
        {(q.data ?? []).map((i: any) => (
          <Card key={i.id} className="p-4 transition-shadow hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]">
            <div className="flex items-center justify-between gap-3">
              <Link to="/invoices/$id" params={{ id: i.id }} className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{i.number}</div>
                    <div className="font-semibold truncate">{i.customer?.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{i.vehicle?.number} · {formatDate(i.created_at)}</div>
                  </div>
                  <div className="text-right pl-2">
                    <div className="font-semibold tabular">{formatINR(i.total)}</div>
                    <div className="mt-1"><StatusBadge status={i.status} /></div>
                  </div>
                </div>
              </Link>
              <Button
                variant="outline"
                aria-label="Download PDF"
                className="h-11 w-11 shrink-0 sm:w-auto sm:px-3"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openInvoiceForDownload(navigate, i.id); }}
              >
                <Download className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
            </div>
          </Card>
        ))}
        {(q.data ?? []).length === 0 && !q.isLoading && (
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            description="Invoices appear here once a job is completed and billed."
          />
        )}
      </div>
    </div>
  );
}
