import { normalizePhone } from "./format";

/**
 * Build a wa.me deep link that opens WhatsApp on the staff device (or the
 * customer's browser) with a prefilled message. Uses +91 as the default
 * country code because the CRM is India-based.
 */
export function buildWhatsAppLink(phone: string, message: string, countryCode = "91"): string {
  const local = normalizePhone(phone);
  const digits = local ? `${countryCode}${local}` : String(phone).replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildSmsLink(phone: string, message: string): string {
  const local = normalizePhone(phone);
  const to = local ? `+91${local}` : phone;
  // ?body works on iOS; Android uses ?body= too. Some browsers use &body.
  return `sms:${to}?&body=${encodeURIComponent(message)}`;
}

type SiteMsgOpts = {
  siteUrl?: string;
  businessName?: string;
};

function baseUrl(opts?: SiteMsgOpts): string {
  if (opts?.siteUrl) return opts.siteUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function biz(opts?: SiteMsgOpts) {
  return opts?.businessName ?? "Workspace";
}

export function quoteMessage(args: {
  customerName: string;
  quoteNumber: string;
  vehicle?: string | null;
  total: number | string;
  quoteId?: string;
}, opts?: SiteMsgOpts): string {
  return [
    `Hi ${args.customerName.split(" ")[0]},`,
    ``,
    `Your quotation ${args.quoteNumber} from ${biz(opts)}${args.vehicle ? ` for ${args.vehicle}` : ""} is ready.`,
    `Estimated total: ₹${args.total}`,
    `The full quotation is attached as a PDF.`,
    ``,
    `Reply here if you have any questions.`,
  ].filter(Boolean).join("\n");
}

export function readyMessage(args: {
  customerName: string;
  vehicle: string;
  jobNumber: string;
  jobId?: string;
}, opts?: SiteMsgOpts): string {
  const link = args.jobId ? `${baseUrl(opts)}/jobs/${args.jobId}` : "";
  return [
    `Hi ${args.customerName.split(" ")[0]},`,
    ``,
    `Good news — your vehicle ${args.vehicle} is ready for pickup at ${biz(opts)} (job ${args.jobNumber}).`,
    link ? `Details: ${link}` : "",
    ``,
    `We're open till 8 PM. See you soon!`,
  ].filter(Boolean).join("\n");
}

export function invoiceMessage(args: {
  customerName: string;
  invoiceNumber: string;
  vehicle?: string | null;
  total: number | string;
  balance?: number | string;
  invoiceId?: string;
}, opts?: SiteMsgOpts): string {
  const bal = args.balance != null && Number(args.balance) > 0
    ? `Balance due: ₹${args.balance}\n`
    : `Payment received in full. `;
  return [
    `Hi ${args.customerName.split(" ")[0]},`,
    ``,
    `Invoice ${args.invoiceNumber} from ${biz(opts)}${args.vehicle ? ` for ${args.vehicle}` : ""}.`,
    `Total: ₹${args.total}`,
    bal,
    `The full invoice is attached as a PDF.`,
    ``,
    `Thank you for trusting us with your vehicle.`,
  ].filter(Boolean).join("\n");
}

/**
 * Open a WhatsApp chat in a new top-level browser tab. Using window.open
 * with an explicit target avoids the Lovable preview iframe intercepting
 * the click and trying to navigate to api.whatsapp.com inside the iframe
 * (which is blocked by X-Frame-Options).
 */
export function openWhatsApp(phone: string, message: string, countryCode = "91") {
  const url = buildWhatsAppLink(phone, message, countryCode);
  if (typeof window !== "undefined") {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    // Fallback for popup blockers: navigate top frame.
    if (!w && window.top) {
      try { (window.top as Window).location.href = url; } catch { window.location.href = url; }
    }
  }
}

/**
 * Share a generated PDF (quote / invoice) with the customer over WhatsApp.
 *
 * Mobile browsers that support Web Share Level 2 open the native share sheet
 * with the file attached, so the customer receives the actual document.
 * Everywhere else we download the PDF and open WhatsApp with the message
 * prefilled so staff can attach the just-downloaded file.
 */
export async function shareDocumentOnWhatsApp(args: {
  phone: string;
  message: string;
  blob: Blob;
  filename: string;
  countryCode?: string;
}): Promise<"shared" | "downloaded"> {
  const safeName = `${args.filename.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/\.pdf$/i, "")}.pdf`;
  const file = new File([args.blob], safeName, { type: "application/pdf" });

  const nav: any = typeof navigator !== "undefined" ? navigator : undefined;
  if (nav?.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text: args.message });
      return "shared";
    } catch (err: any) {
      if (err?.name === "AbortError") return "shared";
      // fall through to download fallback
    }
  }

  const { downloadBlob } = await import("./pdf-document");
  downloadBlob(args.blob, safeName);
  openWhatsApp(args.phone, args.message, args.countryCode);
  return "downloaded";
}
