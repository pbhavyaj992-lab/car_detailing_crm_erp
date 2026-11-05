REVOKE ALL ON FUNCTION public.recalc_invoice_paid(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_payments_recalc_invoice() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_invoices_recalc_status() FROM PUBLIC, anon, authenticated;