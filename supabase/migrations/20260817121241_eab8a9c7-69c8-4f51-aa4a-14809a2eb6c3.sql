-- Batch 2/4 (Tables)
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

CREATE TABLE public.job_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status public.job_status,
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
  updated_at timestamptz NOT NULL DEFAULT now(),
  signature_url text,
  signed_at timestamptz
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

CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  vehicle text,
  service text,
  message text,
  source text NOT NULL DEFAULT 'website',
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contacted_at timestamptz,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT INSERT ON public.inquiries TO anon;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit an inquiry" ON public.inquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff can view inquiries" ON public.inquiries FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "Staff can update inquiries" ON public.inquiries FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
CREATE POLICY "Admins can delete inquiries" ON public.inquiries FOR DELETE TO authenticated USING (public.current_user_can_admin());
CREATE TRIGGER trg_inquiries_updated BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
