
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','owner','manager','reception','worker');
CREATE TYPE public.vehicle_context AS ENUM ('at_garage','inquiry_only');
CREATE TYPE public.quote_status AS ENUM ('draft','approved','converted','cancelled');
CREATE TYPE public.job_status AS ENUM ('received','inspection','work_started','quality_check','ready','delivered');
CREATE TYPE public.media_stage AS ENUM ('pre_work','post_work');
CREATE TYPE public.media_kind AS ENUM ('photo','video');
CREATE TYPE public.payment_method AS ENUM ('cash','upi','card','bank_transfer','other');
CREATE TYPE public.invoice_status AS ENUM ('unpaid','partial','paid','cancelled');

-- ============ UTILITY: updated_at ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_finance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','owner','manager','reception')
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','owner')
  );
$$;

-- ============ SIGNUP HOOK: profile + first-user super_admin ============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
BEGIN
  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SETTINGS ============
CREATE TABLE public.settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  business_name text NOT NULL DEFAULT 'Car Detailing',
  gstin text,
  address text,
  phone text,
  email text,
  default_tax_rate numeric(5,2) NOT NULL DEFAULT 18.00,
  currency text NOT NULL DEFAULT 'INR',
  quote_prefix text NOT NULL DEFAULT 'Q',
  job_prefix text NOT NULL DEFAULT 'J',
  invoice_prefix text NOT NULL DEFAULT 'INV',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable" ON public.settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated
  USING (public.current_user_can_admin()) WITH CHECK (public.current_user_can_admin());
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
INSERT INTO public.settings(id) VALUES (true);

-- ============ SERVICES ============
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services readable" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (public.current_user_can_admin()) WITH CHECK (public.current_user_can_admin());
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.services(name, price, sort_order) VALUES
  ('Exterior Wash', 500, 1),
  ('Interior Cleaning', 800, 2),
  ('Wax Polish', 1500, 3),
  ('Paint Correction', 8000, 4),
  ('Ceramic Coating', 15000, 5),
  ('PPF', 45000, 6);

-- ============ CUSTOMERS ============
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  name text NOT NULL,
  email text,
  address text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.customers (phone);
CREATE INDEX ON public.customers USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(phone,'')));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read customers" ON public.customers FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "staff write customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
CREATE POLICY "staff update customers" ON public.customers FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
CREATE POLICY "admin delete customers" ON public.customers FOR DELETE TO authenticated USING (public.current_user_can_admin());
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ VEHICLES ============
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  number text NOT NULL UNIQUE,
  brand text,
  model text,
  color text,
  fuel_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.vehicles (customer_id);
CREATE INDEX ON public.vehicles (number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "staff write vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
CREATE POLICY "staff update vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
CREATE POLICY "admin delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (public.current_user_can_admin());
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ NUMBERING (sequences per year) ============
CREATE TABLE public.doc_sequences (
  kind text NOT NULL,
  year int NOT NULL,
  last_no int NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, year)
);
GRANT ALL ON public.doc_sequences TO service_role;
ALTER TABLE public.doc_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_doc_number(_kind text, _prefix text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year int := extract(year from now())::int;
  _n int;
BEGIN
  INSERT INTO public.doc_sequences(kind, year, last_no) VALUES (_kind, _year, 1)
  ON CONFLICT (kind, year) DO UPDATE SET last_no = public.doc_sequences.last_no + 1
  RETURNING last_no INTO _n;
  RETURN _prefix || '-' || _year || '-' || lpad(_n::text, 4, '0');
END; $$;

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

-- Auto-log status changes
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

-- ============ INVOICES & PAYMENTS ============
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

-- Recompute invoice paid_amount/status
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

-- ============ MEDIA ============
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
