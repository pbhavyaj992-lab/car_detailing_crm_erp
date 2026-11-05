CREATE OR REPLACE FUNCTION public.recalc_invoice_paid(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _paid numeric;
  _inv public.invoices;
  _new_status public.invoice_status;
BEGIN
  IF _invoice_id IS NULL THEN RETURN; END IF;
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _paid FROM public.payments WHERE invoice_id = _invoice_id;

  _new_status := CASE
    WHEN _inv.status = 'cancelled' THEN _inv.status
    WHEN _paid + COALESCE(_inv.adjustment_amount, 0) >= COALESCE(_inv.total, 0) AND COALESCE(_inv.total, 0) > 0 THEN 'paid'::public.invoice_status
    WHEN _paid > 0 THEN 'partial'::public.invoice_status
    ELSE 'unpaid'::public.invoice_status
  END;

  UPDATE public.invoices
  SET paid_amount = _paid, status = _new_status
  WHERE id = _invoice_id
    AND (paid_amount IS DISTINCT FROM _paid OR status IS DISTINCT FROM _new_status);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_payments_recalc_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_invoice_paid(OLD.invoice_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_invoice_paid(NEW.invoice_id);
  IF TG_OP = 'UPDATE' AND OLD.invoice_id IS DISTINCT FROM NEW.invoice_id THEN
    PERFORM public.recalc_invoice_paid(OLD.invoice_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_invoices_recalc_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total IS DISTINCT FROM OLD.total
     OR COALESCE(NEW.adjustment_amount,0) IS DISTINCT FROM COALESCE(OLD.adjustment_amount,0) THEN
    PERFORM public.recalc_invoice_paid(NEW.id);
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_payments_recalc ON public.payments;
CREATE TRIGGER trg_payments_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_payments_recalc_invoice();

DROP TRIGGER IF EXISTS trg_invoices_recalc ON public.invoices;
CREATE TRIGGER trg_invoices_recalc
AFTER UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_recalc_status();

-- One-time backfill
WITH sums AS (
  SELECT i.id,
         COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.invoice_id = i.id), 0) AS paid
  FROM public.invoices i
)
UPDATE public.invoices i
SET paid_amount = s.paid,
    status = CASE
      WHEN i.status = 'cancelled' THEN i.status
      WHEN s.paid + COALESCE(i.adjustment_amount,0) >= COALESCE(i.total,0) AND COALESCE(i.total,0) > 0 THEN 'paid'::public.invoice_status
      WHEN s.paid > 0 THEN 'partial'::public.invoice_status
      ELSE 'unpaid'::public.invoice_status
    END
FROM sums s
WHERE s.id = i.id
  AND (i.paid_amount IS DISTINCT FROM s.paid
    OR i.status IS DISTINCT FROM CASE
      WHEN i.status = 'cancelled' THEN i.status
      WHEN s.paid + COALESCE(i.adjustment_amount,0) >= COALESCE(i.total,0) AND COALESCE(i.total,0) > 0 THEN 'paid'::public.invoice_status
      WHEN s.paid > 0 THEN 'partial'::public.invoice_status
      ELSE 'unpaid'::public.invoice_status
    END);