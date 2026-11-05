export { computeMoneyTotals } from "./billing/calculations";

export function formatINR(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Normalize an Indian mobile number to canonical 10-digit form.
 * Accepts inputs like "+91 98765-43210", "09876543210", "919876543210" etc.
 * Returns "" if the input can't be normalized to a 10-digit number.
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  let d = String(input).replace(/\D/g, "");
  if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  if (d.length > 10) d = d.slice(-10);
  return d.length === 10 ? d : "";
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input).length === 10;
}

/** Canonical vehicle registration: uppercase alphanumeric, no separators. */
export function normalizeVehicleNumber(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export const JOB_STATUSES = [
  "received",
  "inspection",
  "work_started",
  "quality_check",
  "ready",
  "delivered",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  received: "Received",
  inspection: "Inspection",
  work_started: "Work Started",
  quality_check: "Quality Check",
  ready: "Ready",
  delivered: "Delivered",
};

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "quote_sent",
  "follow_up",
  "won",
  "lost",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New Inquiry",
  contacted: "Contacted",
  quote_sent: "Quote Sent",
  follow_up: "Follow-up",
  won: "Won",
  lost: "Lost",
};

export const CUSTOMER_SOURCES = [
  "walk_in",
  "phone",
  "whatsapp",
  "instagram",
  "facebook",
  "google",
  "referral",
  "website",
  "other",
] as const;
export type CustomerSource = (typeof CUSTOMER_SOURCES)[number];
export const CUSTOMER_SOURCE_LABEL: Record<CustomerSource, string> = {
  walk_in: "Walk in",
  phone: "Phone",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  referral: "Referral",
  website: "Website",
  other: "Other",
};
