import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "blue" | "emerald" | "amber" | "red" | "violet" | "sky";

const TONE_ICON: Record<StatTone, string> = {
  neutral: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  violet: "bg-violet-50 text-violet-600",
  sky: "bg-sky-50 text-sky-600",
};

const TONE_VALUE: Record<StatTone, string> = {
  neutral: "text-foreground",
  blue: "text-foreground",
  emerald: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-red-700",
  violet: "text-foreground",
  sky: "text-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  hint?: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-[var(--radius)] border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </div>
          <div className={cn("mt-2 text-[26px] font-semibold leading-none tracking-tight tabular", TONE_VALUE[tone])}>
            {value === undefined || value === null ? "—" : value}
          </div>
          {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && (
          <div className={cn("grid h-9 w-9 place-items-center rounded-lg", TONE_ICON[tone])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
