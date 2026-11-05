export type Thresholds = {
  rows_warn: number;
  rows_critical: number;
  files_warn: number;
  files_critical: number;
  seats_warn_pct: number;
  seats_critical_pct: number;
  activity_warn: number;
  activity_critical: number;
  inactive_days: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  rows_warn: 8000,
  rows_critical: 15000,
  files_warn: 500,
  files_critical: 1000,
  seats_warn_pct: 90,
  seats_critical_pct: 100,
  activity_warn: 20000,
  activity_critical: 50000,
  inactive_days: 30,
};

export type Severity = "ok" | "warning" | "critical";

export type Breach = {
  metric: string;
  severity: Exclude<Severity, "ok">;
  value: number;
  limit: number;
  label: string;
};

export type CompanyAlert = {
  company_id: string;
  name: string;
  severity: Severity;
  breaches: Breach[];
};

type UsageLike = {
  company_id: string;
  name: string;
  seats: number;
  seats_used: number;
  media_files: number;
  activity_events: number;
  total_rows: number;
  last_activity_at: string | null;
};

function check(
  metric: string,
  value: number,
  warn: number,
  critical: number,
  format: (v: number, l: number) => string,
): Breach | null {
  if (critical > 0 && value >= critical)
    return { metric, severity: "critical", value, limit: critical, label: format(value, critical) };
  if (warn > 0 && value >= warn)
    return { metric, severity: "warning", value, limit: warn, label: format(value, warn) };
  return null;
}

export function evaluateCompany(c: UsageLike, t: Thresholds): CompanyAlert {
  const breaches: Breach[] = [];

  const rows = check("rows", c.total_rows, t.rows_warn, t.rows_critical, (v, l) =>
    `${v.toLocaleString()} data records (limit ${l.toLocaleString()})`,
  );
  if (rows) breaches.push(rows);

  const files = check("files", c.media_files, t.files_warn, t.files_critical, (v, l) =>
    `${v.toLocaleString()} files stored (limit ${l.toLocaleString()})`,
  );
  if (files) breaches.push(files);

  const activity = check("activity", c.activity_events, t.activity_warn, t.activity_critical, (v, l) =>
    `${v.toLocaleString()} logged actions (limit ${l.toLocaleString()})`,
  );
  if (activity) breaches.push(activity);

  if (c.seats > 0) {
    const pct = Math.round((c.seats_used / c.seats) * 100);
    const seats = check("seats", pct, t.seats_warn_pct, t.seats_critical_pct, (v) =>
      `${c.seats_used}/${c.seats} seats used (${v}%)`,
    );
    if (seats) breaches.push(seats);
  }

  if (t.inactive_days > 0) {
    const last = c.last_activity_at ? new Date(c.last_activity_at).getTime() : null;
    const idleDays = last === null ? null : Math.floor((Date.now() - last) / 86400000);
    if (idleDays === null) {
      breaches.push({
        metric: "inactivity",
        severity: "warning",
        value: 0,
        limit: t.inactive_days,
        label: "No recorded activity yet",
      });
    } else if (idleDays >= t.inactive_days) {
      breaches.push({
        metric: "inactivity",
        severity: "warning",
        value: idleDays,
        limit: t.inactive_days,
        label: `Inactive for ${idleDays} days`,
      });
    }
  }

  const severity: Severity = breaches.some((b) => b.severity === "critical")
    ? "critical"
    : breaches.length > 0
      ? "warning"
      : "ok";

  return { company_id: c.company_id, name: c.name, severity, breaches };
}

export function evaluateAll(companies: UsageLike[], t: Thresholds): CompanyAlert[] {
  const rank = { critical: 0, warning: 1, ok: 2 } as const;
  return companies
    .map((c) => evaluateCompany(c, t))
    .filter((a) => a.severity !== "ok")
    .sort((a, b) => rank[a.severity] - rank[b.severity] || b.breaches.length - a.breaches.length);
}
