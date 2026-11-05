import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { listQuotes, convertQuoteToJob } from "@/lib/api/quotes";
import { formatINR, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowRight, Download, FileText } from "lucide-react";
import { openQuoteForDownload } from "@/lib/print-download";

export const Route = createFileRoute("/_authenticated/quotes/")({
  head: () => ({
    meta: [
      { title: "Quotations | Ishan Detailing OS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: QuotesList,
});

function QuotesList() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["quotes"], queryFn: () => listQuotes({}) });
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRow = (q.data ?? []).find((r: any) => r.id === confirmId);

  const convert = useMutation({
    mutationFn: (id: string) => convertQuoteToJob(id),
    onSuccess: (job) => {
      toast.success(`Job ${job.number} created`);
      qc.invalidateQueries({ queryKey: ["quotes"] });
      setConfirmId(null);
      navigate({ to: "/jobs/$id", params: { id: job.id } });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Quotes" subtitle="Estimates ready to approve or convert into active jobs." />
      <div className="grid gap-3">
        {q.isLoading && Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[128px] w-full rounded-[var(--radius)]" />
        ))}
        {(q.data ?? []).map((row: any) => {
          const canConvert = row.status !== "converted" && row.status !== "cancelled" && !!row.vehicle_id;
          return (
            <Card key={row.id} className="p-4 transition-shadow hover:-translate-y-px hover:shadow-[var(--shadow-elevated)]">
              <div className="flex items-center justify-between gap-3">
                <Link to="/quotes/$id" params={{ id: row.id }} className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">{row.number}</div>
                  <div className="font-semibold truncate">{row.customer?.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {row.vehicle?.number ?? "Inquiry"} · {formatDate(row.created_at)}
                  </div>
                </Link>
                <div className="text-right shrink-0">
                  <div className="font-semibold tabular">{formatINR(row.total)}</div>
                  <div className="mt-1"><StatusBadge status={row.status} /></div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  className="h-11 flex-1"
                  onClick={(e) => { e.preventDefault(); openQuoteForDownload(navigate, row.id); }}
                >
                  <Download className="mr-1 h-4 w-4" /> Download PDF
                </Button>
                {canConvert && (
                  <Button
                    className="h-11 flex-1"
                    onClick={(e) => { e.preventDefault(); setConfirmId(row.id); }}
                  >
                    Convert <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {(q.data ?? []).length === 0 && !q.isLoading && (
          <EmptyState
            icon={FileText}
            title="No quotes yet"
            description="Create your first quote from the New workflow."
            action={<Link to="/new"><Button size="sm">New quote</Button></Link>}
          />
        )}
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Convert quote to job?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRow ? (
                <>This will create an active job for <b>{confirmRow.customer?.name}</b> ({confirmRow.vehicle?.number}) worth <b>{formatINR(confirmRow.total)}</b>.</>
              ) : "This will create an active job."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={convert.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={convert.isPending}
              onClick={(e) => { e.preventDefault(); if (confirmId) convert.mutate(confirmId); }}
            >
              {convert.isPending ? "Converting…" : "Convert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
