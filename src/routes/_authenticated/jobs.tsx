import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listJobs, updateJobStatus } from "@/lib/api/jobs";
import { JOB_STATUSES, JOB_STATUS_LABEL, formatDateTime, type JobStatus } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, ClipboardList, ChevronDown, ArrowRight, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { DeliverDialog } from "@/components/deliver-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { statusAccentClass } from "@/lib/status-accent";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({
    meta: [
      { title: "Garage Board | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: JobsBoard,
});

function JobsBoard() {
  const [filter, setFilter] = useState<string>("active");
  const [deliver, setDeliver] = useState<{ id: string; label: string; quote?: any; customer?: any; vehicle?: any } | null>(null);
  const qc = useQueryClient();
  const statuses = filter === "active"
    ? (["received", "inspection", "work_started", "quality_check", "ready"] as const)
    : filter === "delivered"
    ? (["delivered"] as const)
    : JOB_STATUSES;
  const q = useQuery({
    queryKey: ["jobs", filter],
    queryFn: () => listJobs({ status: [...statuses] as any }),
  });


  return (
    <div className="space-y-6">
      <PageHeader
        title="Garage Board"
        subtitle="Every vehicle currently in the workshop."
      />
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {[
          { key: "active", label: "Active" },
          { key: "delivered", label: "Delivered" },
          { key: "all", label: "All" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={cn(
              "min-h-10 rounded-md px-4 text-sm font-medium transition-colors",
              filter === t.key
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-[var(--radius)] border border-border bg-card" />
          ))}
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState icon={ClipboardList} title="No jobs to show" description="Jobs will appear here as vehicles are checked in." />
      ) : (
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(q.data ?? []).map((j: any) => (
            <Card key={j.id} className={`flex h-full flex-col border-border p-4 pl-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-elevated)] ${statusAccentClass(j.status)}`}>
              <Link to="/jobs/$id" params={{ id: j.id }} className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[15px] font-semibold tracking-tight">{j.vehicle?.number}</div>
                    <div className="mt-0.5 min-h-4 truncate text-xs text-muted-foreground">{[j.vehicle?.brand, j.vehicle?.model].filter(Boolean).join(" · ")}</div>
                  </div>
                  <StatusBadge status={j.status} />
                </div>
                <div className="mt-auto">
                  <div className="flex items-center justify-between gap-2 pt-4 text-sm">
                    <span className="truncate text-foreground">{j.customer?.name}</span>
                    {j.quote?.total != null ? (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium tabular text-muted-foreground">
                        Quote ₹{Number(j.quote.total).toLocaleString("en-IN")}
                      </span>
                    ) : (
                      <span className="shrink-0" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate tabular">{j.number}{j.quote?.number ? ` · ${j.quote.number}` : ""}</span>
                    <span className="shrink-0">{formatDateTime(j.created_at)}</span>
                  </div>
                </div>
              </Link>
              <StatusControl job={j} />
              {j.status !== "delivered" ? (
                <Button
                  variant="outline"
                  className="mt-2 h-11 w-full"
                  onClick={() => setDeliver({ id: j.id, label: j.vehicle?.number ?? j.number, quote: j.quote, customer: j.customer, vehicle: j.vehicle } as any)}
                >
                  <CheckCircle2 className="h-4 w-4" /> Deliver & Invoice
                </Button>
              ) : (
                <div className="mt-2 h-11" aria-hidden />
              )}
            </Card>
          ))}
        </div>
      )}

      <DeliverDialog
        open={!!deliver}
        onOpenChange={(o) => !o && setDeliver(null)}
        jobId={deliver?.id ?? ""}
        vehicleLabel={deliver?.label}
        quoteTotal={deliver?.quote?.total}
        quote={deliver?.quote}
        customer={deliver?.customer}
        vehicle={deliver?.vehicle}
        onDone={() => qc.invalidateQueries({ queryKey: ["jobs"] })}
      />
    </div>
  );
}

const WORKFLOW: JobStatus[] = ["received", "inspection", "work_started", "quality_check", "ready"];

function StatusControl({ job }: { job: any }) {
  const qc = useQueryClient();
  const status = job.status as JobStatus;
  const next = WORKFLOW[WORKFLOW.indexOf(status) + 1];

  const mut = useMutation({
    mutationFn: (s: JobStatus) => updateJobStatus(job.id, s),
    onSuccess: (_d, s) => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job", job.id] });
      toast.success(`Moved to ${JOB_STATUS_LABEL[s]}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (status === "delivered") return null;

  return (
    <div className="mt-4 flex gap-2">
      {next && (
        <Button
          size="sm"
          className="h-10 flex-1"
          disabled={mut.isPending}
          onClick={() => mut.mutate(next)}
        >
          <ArrowRight className="h-4 w-4" /> {JOB_STATUS_LABEL[next]}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className={cn("h-10", next ? "px-3" : "flex-1")} disabled={mut.isPending}>
            {next ? null : <span className="mr-1">{JOB_STATUS_LABEL[status]}</span>}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {JOB_STATUSES.filter((s) => s !== "delivered").map((s) => (
            <DropdownMenuItem key={s} onSelect={() => s !== status && mut.mutate(s)}>
              <span className="flex-1">{JOB_STATUS_LABEL[s]}</span>
              {s === status && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { StatusBadge } from "@/components/ui/status-badge";

