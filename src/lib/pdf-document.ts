// Programmatic PDF builder for quotes and invoices.
// Renders directly with jsPDF text/lines — independent of DOM/CSS — so the
// output is consistent regardless of html2canvas or Tailwind quirks.
//
// Note: jsPDF's built-in fonts don't include the ₹ glyph, so amounts are
// formatted as "Rs. 1,234" in the PDF (standard Indian invoice convention).
import type { Settings } from "@/lib/api/settings";


type Money = number | string | null | undefined;

const money = (v: Money): string => {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  if (!Number.isFinite(n)) return "Rs. 0";
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
};

const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
};

const fmtDateTime = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
};

export type DocItem = { name: string; qty: number | string; unit_price: Money; amount: Money };

export type QuoteDoc = {
  number: string;
  created_at: string;
  status: string;
  customer: { name: string; phone: string };
  vehicle?: { number?: string | null } | null;
  items: DocItem[];
  subtotal: Money;
  discount: Money;
  tax_rate: number | string;
  tax_amount: Money;
  total: Money;
  notes?: string | null;
};

export type InvoiceDoc = {
  number: string;
  issued_at: string;
  status: string;
  customer: { name: string; phone: string };
  vehicle?: { number?: string | null } | null;
  items: DocItem[];
  subtotal: Money;
  tax_rate: number | string;
  tax_amount: Money;
  total: Money;
  paid_amount: Money;
};

type BuildOpts = { settings?: Settings | null };

async function newDoc() {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  return pdf;
}

// Page geometry (mm)
const PAGE_W = 210;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

function drawHeader(pdf: any, settings: Settings | null | undefined, title: string, number: string, dateStr: string, logoDataUrl: string | null): number {
  let y = MARGIN;

  // Logo (left)
  let textX = MARGIN;
  if (logoDataUrl) {
    const logoW = 26;
    const logoH = 17;
    try {
      pdf.addImage(logoDataUrl, "PNG", MARGIN, y, logoW, logoH);
      textX = MARGIN + logoW + 6;
    } catch { /* ignore */ }
  }

  // Business block (left)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(15, 23, 42);
  pdf.text(settings?.business_name || "Business", textX, y + 4);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(120, 120, 120);
  pdf.setFontSize(9);
  pdf.setTextColor(90, 90, 90);
  let by = y + 14;
  if (settings?.address) {
    const lines = pdf.splitTextToSize(settings.address, 90);
    pdf.text(lines, textX, by);
    by += lines.length * 4;
  }
  const contactBits: string[] = [];
  if (settings?.phone) contactBits.push(settings.phone);
  if (settings?.email) contactBits.push(settings.email);
  if (contactBits.length) {
    pdf.text(contactBits.join(" · "), textX, by);
    by += 4;
  }
  if (settings?.gstin) {
    pdf.text(`GSTIN: ${settings.gstin}`, textX, by);
    by += 4;
  }

  // Document title block (right)
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(15, 23, 42);
  pdf.text(title.toUpperCase(), PAGE_W - MARGIN, y + 2, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(60, 60, 60);
  pdf.text(number, PAGE_W - MARGIN, y + 8, { align: "right" });
  if (dateStr) {
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(dateStr, PAGE_W - MARGIN, y + 13, { align: "right" });
  }

  const endY = Math.max(by, y + 18);
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, endY + 2, PAGE_W - MARGIN, endY + 2);
  return endY + 8;
}

function drawParty(pdf: any, y: number, heading: string, party: { name: string; phone: string }, vehicleNumber?: string | null): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text(heading.toUpperCase(), MARGIN, y);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(15, 23, 42);
  pdf.text(party.name || "—", MARGIN, y + 6);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(80, 80, 80);
  pdf.text(party.phone || "", MARGIN, y + 11);

  if (vehicleNumber) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text("VEHICLE", PAGE_W - MARGIN, y, { align: "right" });
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42);
    pdf.text(vehicleNumber, PAGE_W - MARGIN, y + 6, { align: "right" });
  }
  return y + 18;
}

function drawItemsTable(pdf: any, y: number, items: DocItem[]): number {
  // Column layout (mm from left margin)
  const colItem = MARGIN;
  const colQty = MARGIN + CONTENT_W * 0.55;
  const colRate = MARGIN + CONTENT_W * 0.72;
  const colAmt = MARGIN + CONTENT_W;

  // Header
  pdf.setFillColor(245, 246, 248);
  pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(90, 90, 90);
  pdf.text("ITEM", colItem + 2, y + 5.5);
  pdf.text("QTY", colQty, y + 5.5, { align: "right" });
  pdf.text("RATE", colRate, y + 5.5, { align: "right" });
  pdf.text("AMOUNT", colAmt - 2, y + 5.5, { align: "right" });
  y += 8;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(30, 30, 30);
  pdf.setDrawColor(230, 230, 230);
  pdf.setLineWidth(0.2);

  for (const it of items) {
    const nameLines = pdf.splitTextToSize(it.name || "", CONTENT_W * 0.5) as string[];
    const rowH = Math.max(9, nameLines.length * 5 + 4);
    // page break
    if (y + rowH > 275) {
      pdf.addPage();
      y = MARGIN;
    }
    pdf.text(nameLines, colItem + 2, y + 5);
    pdf.text(String(it.qty ?? ""), colQty, y + 5, { align: "right" });
    pdf.text(money(it.unit_price), colRate, y + 5, { align: "right" });
    pdf.text(money(it.amount), colAmt - 2, y + 5, { align: "right" });
    y += rowH;
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y);
  }
  return y + 4;
}

type TotalRow = { label: string; value: string; emphasis?: boolean; muted?: boolean };

function drawTotals(pdf: any, y: number, rows: TotalRow[]): number {
  const boxW = 80;
  const boxX = PAGE_W - MARGIN - boxW;
  const rowH = 7;

  for (const r of rows) {
    pdf.setFont("helvetica", r.emphasis ? "bold" : "normal");
    pdf.setFontSize(r.emphasis ? 12 : 10);
    pdf.setTextColor(r.muted ? 120 : (r.emphasis ? 15 : 50), r.muted ? 120 : (r.emphasis ? 23 : 50), r.muted ? 120 : (r.emphasis ? 42 : 50));
    if (r.emphasis) {
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.line(boxX, y - 1, boxX + boxW, y - 1);
    }
    pdf.text(r.label, boxX + 2, y + 4);
    pdf.text(r.value, boxX + boxW - 2, y + 4, { align: "right" });
    y += rowH;
  }
  return y + 4;
}

function drawFooterNote(pdf: any, y: number, text: string) {
  if (!text) return;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  const lines = pdf.splitTextToSize(text, CONTENT_W) as string[];
  pdf.text(lines, MARGIN, y + 4);
}

export async function buildQuotePdf(d: QuoteDoc, opts: BuildOpts = {}): Promise<Blob> {
  const pdf = await newDoc();
  let y = drawHeader(pdf, opts.settings, "Quotation", d.number, fmtDate(d.created_at), null);
  y = drawParty(pdf, y, "Quote for", d.customer, d.vehicle?.number);
  y = drawItemsTable(pdf, y, d.items ?? []);
  const rows: TotalRow[] = [
    { label: "Subtotal", value: money(d.subtotal), muted: true },
  ];
  if (Number(d.discount) > 0) rows.push({ label: "Discount", value: `- ${money(d.discount)}`, muted: true });
  rows.push({ label: `GST (${d.tax_rate}%)`, value: money(d.tax_amount), muted: true });
  rows.push({ label: "Total", value: money(d.total), emphasis: true });
  y = drawTotals(pdf, y, rows);

  // Status stamp
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Status: ${d.status.toUpperCase()}`, MARGIN, y + 4);

  if (d.notes) drawFooterNote(pdf, y + 10, d.notes);

  return pdf.output("blob");
}

export async function buildInvoicePdf(d: InvoiceDoc, opts: BuildOpts = {}): Promise<Blob> {
  const pdf = await newDoc();
  let y = drawHeader(pdf, opts.settings, "Tax Invoice", d.number, fmtDateTime(d.issued_at), null);
  y = drawParty(pdf, y, "Bill to", d.customer, d.vehicle?.number);
  y = drawItemsTable(pdf, y, d.items ?? []);
  const due = Number(d.total) - Number(d.paid_amount);
  const rows: TotalRow[] = [
    { label: "Subtotal", value: money(d.subtotal), muted: true },
    { label: `GST (${d.tax_rate}%)`, value: money(d.tax_amount), muted: true },
    { label: "Total", value: money(d.total), emphasis: true },
    { label: "Paid", value: money(d.paid_amount), muted: true },
    { label: "Due", value: money(due), emphasis: true },
  ];
  y = drawTotals(pdf, y, rows);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 120);
  pdf.text(`Status: ${d.status.toUpperCase()}`, MARGIN, y + 4);

  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
