-- ============ QUOTES ============
CREATE TABLE public.quotes (
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
CREATE INDEX ON public.quotes (customer_id);
CREATE INDEX ON public.quotes (vehicle_id);
CREATE INDEX ON public.quotes (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read quotes" ON public.quotes FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "staff write quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
CREATE POLICY "staff update quotes" ON public.quotes FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
CREATE POLICY "admin delete quotes" ON public.quotes FOR DELETE TO authenticated USING (public.current_user_can_admin());
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
CREATE TRIGGER trg_quotes_number BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_quotes_set_number();

CREATE TABLE public.quote_items (
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
CREATE INDEX ON public.quote_items (quote_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read quote_items" ON public.quote_items FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "staff write quote_items" ON public.quote_items FOR ALL TO authenticated
  USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());

-- ============ JOBS ============
CREATE TABLE public.jobs (
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
CREATE INDEX ON public.jobs (status);
CREATE INDEX ON public.jobs (customer_id);
CREATE INDEX ON public.jobs (vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read jobs" ON public.jobs FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "reception+ write jobs" ON public.jobs FOR INSERT TO authenticated WITH CHECK (public.current_user_can_finance());
CREATE POLICY "reception+ update jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (public.current_user_can_finance() OR auth.uid() = ANY(assigned_to))
  WITH CHECK (public.current_user_can_finance() OR auth.uid() = ANY(assigned_to));
CREATE POLICY "admin delete jobs" ON public.jobs FOR DELETE TO authenticated USING (public.current_user_can_admin());
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
CREATE TRIGGER trg_jobs_number BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_set_number();
