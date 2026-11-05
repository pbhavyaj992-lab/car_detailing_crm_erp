ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS adjustment_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS adjustment_note text;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS follow_up_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_follow_up_at timestamptz;

CREATE OR REPLACE FUNCTION public.tg_payments_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _inv uuid; _paid numeric; _total numeric; _adj numeric;
BEGIN
  _inv := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO _paid FROM public.payments WHERE invoice_id = _inv;
  SELECT total, COALESCE(adjustment_amount,0) INTO _total, _adj FROM public.invoices WHERE id = _inv;
  UPDATE public.invoices SET
    paid_amount = _paid,
    status = CASE
      WHEN status = 'cancelled'::public.invoice_status THEN status
      WHEN _paid <= 0 THEN 'unpaid'::public.invoice_status
      WHEN (_paid + COALESCE(_adj,0)) >= _total THEN 'paid'::public.invoice_status
      ELSE 'partial'::public.invoice_status
    END
  WHERE id = _inv;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_invoices_recalc_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'cancelled'::public.invoice_status
     AND (NEW.adjustment_amount IS DISTINCT FROM OLD.adjustment_amount
          OR NEW.total IS DISTINCT FROM OLD.total) THEN
    NEW.status := CASE
      WHEN NEW.paid_amount <= 0 AND COALESCE(NEW.adjustment_amount,0) <= 0 THEN 'unpaid'::public.invoice_status
      WHEN (NEW.paid_amount + COALESCE(NEW.adjustment_amount,0)) >= NEW.total THEN 'paid'::public.invoice_status
      ELSE 'partial'::public.invoice_status
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoices_recalc_status ON public.invoices;
CREATE TRIGGER trg_invoices_recalc_status
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_recalc_status();