/**
 * Centralized money calculation logic for the entire platform.
 * Use this to ensure consistent rounding and totals across Quotes, Invoices, and Jobs.
 */
export function computeMoneyTotals(
  items: { qty: number | string; unit_price: number | string }[],
  discount: number | string = 0,
  taxRate: number | string = 0,
) {
  const taxRateVal = Number(taxRate) || 0;
  const subtotal = items.reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_price) || 0),
    0,
  );
  const discountVal = Math.max(0, Number(discount) || 0);
  const afterDiscount = Math.max(0, subtotal - discountVal);
  const tax_amount = +(afterDiscount * (taxRateVal / 100)).toFixed(2);
  const total = +(afterDiscount + tax_amount).toFixed(2);
  return {
    subtotal: +subtotal.toFixed(2),
    discount: discountVal,
    tax_rate: taxRateVal,
    tax_amount,
    total,
  };
}

/** Centralized payment math. */
export function computeInvoiceBalance(total: number, paid: number, adjustments: number = 0) {
  return +(Number(total) - Number(paid) - Number(adjustments)).toFixed(2);
}

/** Sum of actual payment rows recorded against an invoice. */
export function sumPayments(payments?: { amount: number | string }[] | null) {
  return +((payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0)).toFixed(2);
}

/**
 * Payments are the source of truth. `paid_amount` is a denormalized column kept
 * in sync by a DB trigger; if it lags behind we still show the real total.
 */
export function derivedInvoicePaid(invoice: {
  paid_amount?: number | string | null;
  payments?: { amount: number | string }[] | null;
}) {
  return Math.max(Number(invoice.paid_amount ?? 0) || 0, sumPayments(invoice.payments));
}

/** Remaining due, never negative. */
export function derivedInvoiceDue(invoice: {
  total: number | string;
  paid_amount?: number | string | null;
  adjustment_amount?: number | string | null;
  payments?: { amount: number | string }[] | null;
}) {
  const due = computeInvoiceBalance(
    Number(invoice.total) || 0,
    derivedInvoicePaid(invoice),
    Number(invoice.adjustment_amount ?? 0) || 0,
  );
  return due > 0 ? due : 0;
}

