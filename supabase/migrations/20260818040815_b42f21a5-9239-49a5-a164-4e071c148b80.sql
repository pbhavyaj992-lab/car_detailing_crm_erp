CREATE TABLE public.job_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status public.job_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.job_status_events (job_id);
GRANT SELECT, INSERT ON public.job_status_events TO authenticated;
GRANT ALL ON public.job_status_events TO service_role;
ALTER TABLE public.job_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read job events" ON public.job_status_events FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "staff insert job events" ON public.job_status_events FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());

CREATE OR REPLACE FUNCTION public.tg_jobs_log_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.job_status_events(job_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
    IF NEW.status = 'work_started' AND NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
    IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_jobs_status_ins AFTER INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_log_status();
CREATE TRIGGER trg_jobs_status_upd BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_log_status();

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 18.00,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  notes text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.invoices (customer_id);
CREATE INDEX ON public.invoices (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.current_user_can_finance());
CREATE POLICY "finance write invoices" ON public.invoices FOR ALL TO authenticated
  USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_invoices_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT invoice_prefix INTO _prefix FROM public.settings WHERE id;
    NEW.number := public.next_doc_number('invoice', COALESCE(_prefix,'INV'));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_invoices_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_set_number();

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  name text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX ON public.invoice_items (invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance rw invoice_items" ON public.invoice_items FOR ALL TO authenticated
  USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text,
  received_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payments (invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance rw payments" ON public.payments FOR ALL TO authenticated
  USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());

CREATE OR REPLACE FUNCTION public.tg_payments_recalc() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _inv uuid; _paid numeric; _total numeric;
BEGIN
  _inv := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO _paid FROM public.payments WHERE invoice_id = _inv;
  SELECT total INTO _total FROM public.invoices WHERE id = _inv;
  UPDATE public.invoices SET
    paid_amount = _paid,
    status = CASE
      WHEN _paid <= 0 THEN 'unpaid'::public.invoice_status
      WHEN _paid >= _total THEN 'paid'::public.invoice_status
      ELSE 'partial'::public.invoice_status
    END
  WHERE id = _inv;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER trg_payments_recalc AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_payments_recalc();

CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  stage public.media_stage NOT NULL,
  kind public.media_kind NOT NULL DEFAULT 'photo',
  storage_path text NOT NULL,
  mime text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.media (vehicle_id);
CREATE INDEX ON public.media (job_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media TO authenticated;
GRANT ALL ON public.media TO service_role;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read media" ON public.media FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "staff write media" ON public.media FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
CREATE POLICY "staff delete own media" ON public.media FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.current_user_can_admin());
