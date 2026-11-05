import { supabase } from "@/integrations/supabase/client";

export type Range = "daily" | "weekly" | "monthly";

type Point = { bucket: string; label: string; revenue: number; count: number };

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

function fmtLabel(d: Date, range: Range) {
  if (range === "monthly") {
    return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
  }
  if (range === "weekly") {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function bucketKey(d: Date, range: Range) {
  const n = startOfDay(d);
  if (range === "daily") return n.toISOString().slice(0, 10);
  if (range === "weekly") {
    // ISO-ish: week starting Monday
    const day = (n.getDay() + 6) % 7;
    n.setDate(n.getDate() - day);
    return n.toISOString().slice(0, 10);
  }
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function buildBuckets(range: Range): Point[] {
  const now = new Date();
  const points: Point[] = [];
  if (range === "daily") {
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - i);
      points.push({ bucket: bucketKey(d, range), label: fmtLabel(d, range), revenue: 0, count: 0 });
    }
  } else if (range === "weekly") {
    for (let i = 11; i >= 0; i--) {
      const d = startOfDay(new Date());
      d.setDate(d.getDate() - i * 7);
      const day = (d.getDay() + 6) % 7;
      d.setDate(d.getDate() - day);
      points.push({ bucket: bucketKey(d, range), label: fmtLabel(d, range), revenue: 0, count: 0 });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      points.push({ bucket: bucketKey(d, range), label: fmtLabel(d, range), revenue: 0, count: 0 });
    }
  }
  return points;
}

export async function getRevenueAnalytics(range: Range) {
  const points = buildBuckets(range);
  const first = points[0].bucket;
  const from = range === "monthly" ? `${first}-01` : first;

  const [{ data: pays, error: pe }, { data: jobs, error: je }] = await Promise.all([
    supabase.from("payments").select("amount, created_at, method").gte("created_at", from),
    supabase.from("jobs").select("id, status, delivered_at, created_at").gte("created_at", from),
  ]);
  if (pe) throw pe;
  if (je) throw je;

  const map = new Map(points.map((p) => [p.bucket, p]));
  const methodTotals: Record<string, number> = {};
  let totalRevenue = 0;
  let totalPayments = 0;

  for (const p of pays ?? []) {
    const amt = Number(p.amount);
    const key = bucketKey(new Date(p.created_at as string), range);
    const b = map.get(key);
    if (b) b.revenue += amt;
    methodTotals[p.method as string] = (methodTotals[p.method as string] ?? 0) + amt;
    totalRevenue += amt;
    totalPayments += 1;
  }

  let jobsDelivered = 0;
  let jobsCreated = 0;
  for (const j of jobs ?? []) {
    if (j.created_at) {
      const key = bucketKey(new Date(j.created_at as string), range);
      const b = map.get(key);
      if (b) b.count += 1;
    }
    jobsCreated += 1;
    if (j.status === "delivered") jobsDelivered += 1;
  }

  const avgTicket = totalPayments > 0 ? totalRevenue / totalPayments : 0;

  return {
    points,
    totals: { revenue: totalRevenue, payments: totalPayments, avgTicket, jobsCreated, jobsDelivered },
    methodTotals,
  };
}
