import { cn } from "@/lib/utils";
import { JOB_STATUS_LABEL } from "@/lib/format";

type Tone = "neutral" | "blue" | "amber" | "violet" | "emerald" | "slate" | "red" | "sky";

const TONE: Record<Tone, string> = {
  neutral: "bg-secondary text-secondary-foreground ring-border",
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  red: "bg-red-50 text-red-700 ring-red-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
};

const STATUS_TONE: Record<string, Tone> = {
  received: "slate",
  inspection: "blue",
  washing: "sky",
  detailing: "violet",
  coating: "violet",
  work_started: "amber",
  quality_check: "violet",
  ready: "emerald",
  delivered: "slate",
  completed: "emerald",
  cancelled: "red",
  draft: "slate",
  pending: "amber",
  approved: "emerald",
  rejected: "red",
  converted: "blue",
  paid: "emerald",
  unpaid: "amber",
  partial: "amber",
  overdue: "red",
};

const LABELS: Record<string, string> = {
  ...JOB_STATUS_LABEL,
  draft: "Draft",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  converted: "Converted",
  paid: "Paid",
  unpaid: "Unpaid",
  partial: "Partial",
  overdue: "Overdue",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function StatusBadge({
  status,
  className,
  tone,
  children,
}: {
  status?: string;
  className?: string;
  tone?: Tone;
  children?: React.ReactNode;
}) {
  const resolvedTone: Tone = tone ?? (status ? STATUS_TONE[status] ?? "neutral" : "neutral");
  const label = children ?? (status ? LABELS[status] ?? status : "");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        TONE[resolvedTone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotFor(resolvedTone))} />
      {label}
    </span>
  );
}

function dotFor(tone: Tone) {
  return {
    neutral: "bg-muted-foreground/60",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-400",
    red: "bg-red-500",
    sky: "bg-sky-500",
  }[tone];
}
