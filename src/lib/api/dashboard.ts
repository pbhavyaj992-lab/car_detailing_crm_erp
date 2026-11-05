import { supabase } from "@/integrations/supabase/client";
import { getCompanyId } from "@/lib/api/company-context";

export async function getDashboardMetrics() {
  const companyId = await getCompanyId();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const isoDay = startOfDay.toISOString();
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1).toISOString();
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);

  const [garageInside, todaysVehicles, pendingQuotes, activeJobs, readyForDelivery, completedToday, unpaidInvoices, monthPayments, newInquiries, followUps, adjustments] =
    await Promise.all([
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["received", "inspection", "work_started", "quality_check", "ready"]),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", isoDay),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "draft"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["work_started", "quality_check"]),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "ready"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "delivered").gte("delivered_at", isoDay),
      supabase.from("invoices").select("total, paid_amount, adjustment_amount").eq("company_id", companyId).in("status", ["unpaid", "partial"]),
      supabase.from("payments").select("amount, created_at").eq("company_id", companyId).gte("created_at", startOfMonth),
      supabase.from("inquiries" as never).select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "new"),
      supabase.from("inquiries" as never).select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "follow_up").lte("follow_up_at", endOfDay.toISOString()),
      supabase.from("invoices").select("adjustment_amount").eq("company_id", companyId).gt("adjustment_amount", 0).gte("created_at", startOfMonth),
    ]);


  const pendingPayments = (unpaidInvoices.data ?? []).reduce(
    (s, i) => s + (Number(i.total) - Number(i.paid_amount) - Number(i.adjustment_amount ?? 0)),
    0,
  );
  const adjustedThisMonth = ((adjustments.data ?? []) as unknown as { adjustment_amount: number }[]).reduce(
    (s, i) => s + Number(i.adjustment_amount ?? 0),
    0,
  );
  const monthRevenue = (monthPayments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return {
    garageInside: garageInside.count ?? 0,
    todaysVehicles: todaysVehicles.count ?? 0,
    pendingQuotes: pendingQuotes.count ?? 0,
    activeJobs: activeJobs.count ?? 0,
    readyForDelivery: readyForDelivery.count ?? 0,
    completedToday: completedToday.count ?? 0,
    pendingPayments,
    monthRevenue,
    newInquiries: (newInquiries as { count: number | null }).count ?? 0,
    followUpsDue: (followUps as { count: number | null }).count ?? 0,
    adjustedThisMonth,
  };
}
