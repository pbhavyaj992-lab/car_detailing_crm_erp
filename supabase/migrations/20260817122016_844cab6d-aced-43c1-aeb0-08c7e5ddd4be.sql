-- ============ BATCH 3: JOBS, QUOTES, INVOICES, PAYMENTS ============

-- 1. QUOTES
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  context public.vehicle_context NOT NULL DEFAULT 'at_garage',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 18.00,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quotes_customer_id_idx ON public.quotes (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read quotes" ON public.quotes; CREATE POLICY "staff read quotes" ON public.quotes FOR SELECT TO authenticated USING (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff write quotes" ON public.quotes; CREATE POLICY "staff write quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff update quotes" ON public.quotes; CREATE POLICY "staff update quotes" ON public.quotes FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
DROP POLICY IF EXISTS "admin delete quotes" ON public.quotes; CREATE POLICY "admin delete quotes" ON public.quotes FOR DELETE TO authenticated USING (public.current_user_can_admin());
DROP TRIGGER IF EXISTS trg_quotes_updated ON public.quotes;
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_quotes_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT quote_prefix INTO _prefix FROM public.settings WHERE id;
    NEW.number := public.next_doc_number('quote', COALESCE(_prefix,'Q'));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_quotes_number ON public.quotes;
CREATE TRIGGER trg_quotes_number BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_quotes_set_number();

-- 2. QUOTE ITEMS
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items (quote_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read quote_items" ON public.quote_items; CREATE POLICY "staff read quote_items" ON public.quote_items FOR SELECT TO authenticated USING (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff write quote_items" ON public.quote_items; CREATE POLICY "staff write quote_items" ON public.quote_items FOR ALL TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());

-- 3. JOBS
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  status public.job_status NOT NULL DEFAULT 'received',
  assigned_to uuid[] NOT NULL DEFAULT '{}',
  expected_delivery timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read jobs" ON public.jobs; CREATE POLICY "staff read jobs" ON public.jobs FOR SELECT TO authenticated USING (public.current_user_is_staff());
DROP POLICY IF EXISTS "reception+ write jobs" ON public.jobs; CREATE POLICY "reception+ write jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.current_user_can_finance());
DROP POLICY IF EXISTS "reception+ update jobs" ON public.jobs; CREATE POLICY "reception+ update jobs" ON public.jobs FOR UPDATE TO authenticated USING (public.current_user_can_finance() OR auth.uid() = ANY(assigned_to)) WITH CHECK (public.current_user_can_finance() OR auth.uid() = ANY(assigned_to));
DROP POLICY IF EXISTS "admin delete jobs" ON public.jobs; CREATE POLICY "admin delete jobs" ON public.jobs FOR DELETE TO authenticated USING (public.current_user_can_admin());
DROP TRIGGER IF EXISTS trg_jobs_updated ON public.jobs;
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.tg_jobs_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT job_prefix INTO _prefix FROM public.settings WHERE id;
    NEW.number := public.next_doc_number('job', COALESCE(_prefix,'J'));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_jobs_number ON public.jobs;
CREATE TRIGGER trg_jobs_number BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_set_number();

-- 4. JOB STATUS EVENTS
CREATE TABLE IF NOT EXISTS public.job_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status public.job_status,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.job_status_events TO authenticated;
GRANT ALL ON public.job_status_events TO service_role;
ALTER TABLE public.job_status_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read job events" ON public.job_status_events; CREATE POLICY "staff read job events" ON public.job_status_events FOR SELECT TO authenticated USING (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff insert job events" ON public.job_status_events; CREATE POLICY "staff insert job events" ON public.job_status_events FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());

-- 5. INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 18.00,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON public.invoices (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance read invoices" ON public.invoices; CREATE POLICY "finance read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.current_user_can_finance());
DROP POLICY IF EXISTS "finance write invoices" ON public.invoices; CREATE POLICY "finance write invoices" ON public.invoices FOR ALL TO authenticated USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());
DROP TRIGGER IF EXISTS trg_invoices_updated ON public.invoices;
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
DROP TRIGGER IF EXISTS trg_invoices_number ON public.invoices;
CREATE TRIGGER trg_invoices_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_set_number();

-- 6. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance rw invoice_items" ON public.invoice_items; CREATE POLICY "finance rw invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());

-- 7. PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance rw payments" ON public.payments; CREATE POLICY "finance rw payments" ON public.payments FOR ALL TO authenticated USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());

CREATE OR REPLACE FUNCTION public.tg_payments_recalc() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.invoices
  SET paid_amount = (SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)),
      status = CASE
        WHEN (SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)) >= total THEN 'paid'::public.invoice_status
        WHEN (SELECT COALESCE(SUM(amount),0) FROM public.payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)) > 0 THEN 'partial'::public.invoice_status
        ELSE 'unpaid'::public.invoice_status
      END
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS trg_payments_recalc ON public.payments;
CREATE TRIGGER trg_payments_recalc AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_payments_recalc();
