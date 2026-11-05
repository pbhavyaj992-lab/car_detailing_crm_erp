-- 1) Recalculate invoice paid_amount + status from payments
CREATE OR REPLACE FUNCTION public.recalc_invoice_paid(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _paid numeric;
  _inv public.invoices;
BEGIN
  IF _invoice_id IS NULL THEN RETURN; END IF;
  SELECT * INTO _inv FROM public.invoices WHERE id = _invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO _paid FROM public.payments WHERE invoice_id = _invoice_id;

  UPDATE public.invoices
  SET paid_amount = _paid,
      status = CASE
        WHEN status = 'cancelled' THEN status
        WHEN _paid + COALESCE(adjustment_amount, 0) >= COALESCE(total, 0) AND COALESCE(total,0) > 0 THEN 'paid'::invoice_status
        WHEN _paid > 0 THEN 'partial'::invoice_status
        ELSE 'unpaid'::invoice_status
      END
  WHERE id = _invoice_id
    AND (paid_amount IS DISTINCT FROM _paid
      OR status IS DISTINCT FROM CASE
        WHEN status = 'cancelled' THEN status
        WHEN _paid + COALESCE(adjustment_amount, 0) >= COALESCE(total, 0) AND COALESCE(total,0) > 0 THEN 'paid'::invoice_status
        WHEN _paid > 0 THEN 'partial'::invoice_status
        ELSE 'unpaid'::invoice_status
      END);
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

DROP TRIGGER IF EXISTS trg_payments_recalc ON public.payments;
CREATE TRIGGER trg_payments_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_payments_recalc_invoice();

-- Recalc when the invoice total / adjustment changes
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

DROP TRIGGER IF EXISTS trg_invoices_recalc ON public.invoices;
CREATE TRIGGER trg_invoices_recalc
AFTER UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_recalc_status();

-- 2) Backfill existing invoices from real payment rows
WITH sums AS (
  SELECT i.id,
         COALESCE((SELECT SUM(p.amount) FROM public.payments p WHERE p.invoice_id = i.id), 0) AS paid
  FROM public.invoices i
)
UPDATE public.invoices i
SET paid_amount = s.paid,
    status = CASE
      WHEN i.status = 'cancelled' THEN i.status
      WHEN s.paid + COALESCE(i.adjustment_amount,0) >= COALESCE(i.total,0) AND COALESCE(i.total,0) > 0 THEN 'paid'::invoice_status
      WHEN s.paid > 0 THEN 'partial'::invoice_status
      ELSE 'unpaid'::invoice_status
    END
FROM sums s
WHERE s.id = i.id;

-- 3) Ensure inquiries always get stamped with a company_id
DROP TRIGGER IF EXISTS tr_set_inquiries_company_id ON public.inquiries;
CREATE TRIGGER tr_set_inquiries_company_id
BEFORE INSERT ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

-- 4) Tighten inquiry INSERT: signed-in staff may only create leads in their own company
DROP POLICY IF EXISTS inquiries_insert_policy ON public.inquiries;
DROP POLICY IF EXISTS "Anyone can submit an inquiry" ON public.inquiries;
CREATE POLICY inquiries_insert_authenticated
  ON public.inquiries FOR INSERT TO authenticated
  WITH CHECK (company_id IS NOT NULL AND company_id = public.current_company_id());
CREATE POLICY inquiries_insert_anon
  ON public.inquiries FOR INSERT TO anon
  WITH CHECK (company_id IS NOT NULL);
