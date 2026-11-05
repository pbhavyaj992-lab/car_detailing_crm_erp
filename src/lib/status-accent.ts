import type { JobStatus } from "@/lib/format";

// Left-accent border color per job stage for Garage Board cards.
export const JOB_STATUS_ACCENT: Record<JobStatus, string> = {
  received: "before:bg-slate-400",
  inspection: "before:bg-blue-500",
  work_started: "before:bg-amber-500",
  quality_check: "before:bg-violet-500",
  ready: "before:bg-emerald-500",
  delivered: "before:bg-slate-300",
};

export function statusAccentClass(status?: string) {
  const key = (status ?? "received") as JobStatus;
  const cls = JOB_STATUS_ACCENT[key] ?? "before:bg-slate-300";
  return `relative overflow-hidden before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${cls}`;
}
