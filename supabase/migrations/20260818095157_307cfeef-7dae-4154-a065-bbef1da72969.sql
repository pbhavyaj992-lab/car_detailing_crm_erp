-- ============ RESET ============
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres;

-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','owner','manager','reception','worker');
CREATE TYPE public.vehicle_context AS ENUM ('at_garage','inquiry_only');
CREATE TYPE public.quote_status AS ENUM ('draft','approved','converted','cancelled');
CREATE TYPE public.job_status AS ENUM ('received','inspection','work_started','quality_check','ready','delivered');
CREATE TYPE public.media_stage AS ENUM ('pre_work','post_work');
CREATE TYPE public.media_kind AS ENUM ('photo','video');
CREATE TYPE public.payment_method AS ENUM ('cash','upi','card','bank_transfer','other');
CREATE TYPE public.invoice_status AS ENUM ('unpaid','partial','paid','cancelled');

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan_tier text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  logo_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  notes text,
  seats integer NOT NULL DEFAULT 5,
  trial_ends_at timestamptz,
  billing_cycle text NOT NULL DEFAULT 'monthly',
  plan_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  subscription_started_at timestamptz,
  subscription_ends_at timestamptz,
  grace_days integer NOT NULL DEFAULT 3,
  public_site_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.companies (id, name, slug, plan_tier, status)
VALUES ('00000000-0000-0000-0000-000000000001','Coating Buddies','coating-buddies','enterprise','active');

-- ============ PROFILES / ROLES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_user_permissions_updated BEFORE UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ ROLE HELPERS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.in_my_company(_cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _cid IS NOT NULL AND _cid = public.current_company_id();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_finance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('super_admin','admin','owner','manager','reception'));
$$;

CREATE OR REPLACE FUNCTION public.current_user_can_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('super_admin','admin','owner'));
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.tg_set_company_id() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    NEW.company_id := COALESCE(public.current_company_id(), NEW.company_id);
  ELSIF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  RETURN NEW;
END; $$;

-- profiles / roles policies
CREATE POLICY "profiles self or same company" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.in_my_company(company_id) OR public.current_user_is_super_admin());
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.current_user_can_admin()) WITH CHECK (id = auth.uid() OR public.current_user_can_admin());

CREATE POLICY "user_roles read own company" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.in_my_company(company_id) OR public.current_user_is_super_admin());
CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.current_user_is_super_admin() OR (public.current_user_can_admin() AND public.in_my_company(company_id)))
  WITH CHECK (public.current_user_is_super_admin() OR (public.current_user_can_admin() AND public.in_my_company(company_id)));

CREATE POLICY "user_permissions read" ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.in_my_company(company_id) OR public.current_user_is_super_admin());
CREATE POLICY "user_permissions admin write" ON public.user_permissions FOR ALL TO authenticated
  USING (public.current_user_can_admin() AND (public.in_my_company(company_id) OR public.current_user_is_super_admin()))
  WITH CHECK (public.current_user_can_admin() AND (public.in_my_company(company_id) OR public.current_user_is_super_admin()));

-- companies policies
CREATE POLICY "companies read own" ON public.companies FOR SELECT TO authenticated
  USING (public.current_user_is_super_admin() OR id = public.current_company_id());
CREATE POLICY "companies super admin write" ON public.companies FOR ALL TO authenticated
  USING (public.current_user_is_super_admin()) WITH CHECK (public.current_user_is_super_admin());
CREATE POLICY "companies admin update own" ON public.companies FOR UPDATE TO authenticated
  USING (public.current_user_can_admin() AND id = public.current_company_id())
  WITH CHECK (public.current_user_can_admin() AND id = public.current_company_id());

-- ============ PLATFORM TABLES ============
CREATE TABLE public.platform_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  price_yearly numeric(12,2) NOT NULL DEFAULT 0,
  features text[] NOT NULL DEFAULT '{}',
  max_seats integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_plans TO authenticated;
GRANT ALL ON public.platform_plans TO service_role;
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable" ON public.platform_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "plans super admin write" ON public.platform_plans FOR ALL TO authenticated
  USING (public.current_user_is_super_admin()) WITH CHECK (public.current_user_is_super_admin());
INSERT INTO public.platform_plans (name, slug, price_monthly, price_yearly, max_seats) VALUES
  ('Starter','starter',999,9990,5),
  ('Pro','pro',2499,24990,15),
  ('Enterprise','enterprise',4999,49990,100);

CREATE TABLE public.platform_thresholds (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  rows_warn integer NOT NULL DEFAULT 8000,
  rows_critical integer NOT NULL DEFAULT 15000,
  files_warn integer NOT NULL DEFAULT 500,
  files_critical integer NOT NULL DEFAULT 1000,
  seats_warn_pct integer NOT NULL DEFAULT 90,
  seats_critical_pct integer NOT NULL DEFAULT 100,
  activity_warn integer NOT NULL DEFAULT 20000,
  activity_critical integer NOT NULL DEFAULT 50000,
  inactive_days integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_thresholds TO authenticated;
GRANT ALL ON public.platform_thresholds TO service_role;
ALTER TABLE public.platform_thresholds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thresholds super admin" ON public.platform_thresholds FOR ALL TO authenticated
  USING (public.current_user_is_super_admin()) WITH CHECK (public.current_user_is_super_admin());
INSERT INTO public.platform_thresholds(id) VALUES (true);

CREATE TABLE public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  paid_on date NOT NULL DEFAULT current_date,
  method text,
  reference text,
  period_start timestamptz,
  period_end timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_payments TO authenticated;
GRANT ALL ON public.company_payments TO service_role;
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_payments super admin" ON public.company_payments FOR ALL TO authenticated
  USING (public.current_user_is_super_admin()) WITH CHECK (public.current_user_is_super_admin());
CREATE TRIGGER trg_company_payments_updated BEFORE UPDATE ON public.company_payments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_company_payments_company ON public.company_payments(company_id, paid_on DESC);

CREATE TABLE public.company_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subdomain text UNIQUE,
  custom_domain text UNIQUE,
  theme text NOT NULL DEFAULT 'midnight',
  theme_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_sites TO authenticated;
GRANT ALL ON public.company_sites TO service_role;
ALTER TABLE public.company_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_sites own" ON public.company_sites FOR ALL TO authenticated
  USING (public.in_my_company(company_id) OR public.current_user_is_super_admin())
  WITH CHECK (public.in_my_company(company_id) OR public.current_user_is_super_admin());
CREATE TRIGGER trg_company_sites_updated BEFORE UPDATE ON public.company_sites FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.auth_attempts TO service_role;
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_attempts super admin read" ON public.auth_attempts FOR SELECT TO authenticated
  USING (public.current_user_is_super_admin());

CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  ip_address text,
  user_agent text,
  device_type text,
  browser text,
  os text,
  country text,
  region text,
  city text,
  latitude numeric,
  longitude numeric,
  event_type text NOT NULL DEFAULT 'sign_in',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "login_events insert self" ON public.login_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "login_events read own company" ON public.login_events FOR SELECT TO authenticated
  USING (public.current_user_is_super_admin() OR (public.current_user_can_admin() AND public.in_my_company(company_id)));

-- ============ SETTINGS / SERVICES ============
CREATE TABLE public.settings (
  company_id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.companies(id) ON DELETE CASCADE,
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings read own" ON public.settings FOR SELECT TO authenticated
  USING (public.in_my_company(company_id) OR public.current_user_is_super_admin());
CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated
  USING (public.current_user_can_admin() AND (public.in_my_company(company_id) OR public.current_user_is_super_admin()))
  WITH CHECK (public.current_user_can_admin() AND (public.in_my_company(company_id) OR public.current_user_is_super_admin()));
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
INSERT INTO public.settings(company_id, business_name) VALUES ('00000000-0000-0000-0000-000000000001','Coating Buddies');

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services read own" ON public.services FOR SELECT TO authenticated
  USING (public.in_my_company(company_id) OR public.current_user_is_super_admin());
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (public.current_user_can_admin() AND (public.in_my_company(company_id) OR public.current_user_is_super_admin()))
  WITH CHECK (public.current_user_can_admin() AND (public.in_my_company(company_id) OR public.current_user_is_super_admin()));
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_services_company BEFORE INSERT ON public.services FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
INSERT INTO public.services(company_id, name, price, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001','Exterior Wash',500,1),
  ('00000000-0000-0000-0000-000000000001','Interior Cleaning',800,2),
  ('00000000-0000-0000-0000-000000000001','Wax Polish',1500,3),
  ('00000000-0000-0000-0000-000000000001','Paint Correction',8000,4),
  ('00000000-0000-0000-0000-000000000001','Ceramic Coating',15000,5),
  ('00000000-0000-0000-0000-000000000001','PPF',45000,6);

-- ============ CUSTOMERS / VEHICLES ============
CREATE OR REPLACE FUNCTION public.normalize_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT regexp_replace(coalesce(p,''), '[^0-9]', '', 'g'); $$;

CREATE OR REPLACE FUNCTION public.normalize_registration(r text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT upper(regexp_replace(coalesce(r,''), '[^a-zA-Z0-9]', '', 'g')); $$;

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  normalized_phone text,
  name text NOT NULL,
  email text,
  address text,
  notes text,
  source text,
  lead_status text NOT NULL DEFAULT 'won',
  follow_up_at timestamptz,
  last_contacted_at timestamptz,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_company_phone ON public.customers (company_id, normalized_phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers own company" ON public.customers FOR ALL TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_customers_company BEFORE INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

CREATE OR REPLACE FUNCTION public.tg_customers_normalize() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.normalized_phone := public.normalize_phone(NEW.phone); RETURN NEW; END; $$;
CREATE TRIGGER trg_customers_norm BEFORE INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_customers_normalize();

CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  number text NOT NULL,
  normalized_registration text,
  brand text,
  model text,
  color text,
  fuel_type text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vehicles_company_reg ON public.vehicles (company_id, normalized_registration);
CREATE INDEX idx_vehicles_customer ON public.vehicles (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles own company" ON public.vehicles FOR ALL TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_vehicles_company BEFORE INSERT ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

CREATE OR REPLACE FUNCTION public.tg_vehicles_normalize() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.normalized_registration := public.normalize_registration(NEW.number); RETURN NEW; END; $$;
CREATE TRIGGER trg_vehicles_norm BEFORE INSERT OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_vehicles_normalize();

-- ============ NUMBERING ============
CREATE TABLE public.doc_sequences (
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.companies(id) ON DELETE CASCADE,
  kind text NOT NULL,
  year int NOT NULL,
  last_no int NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, kind, year)
);
GRANT ALL ON public.doc_sequences TO service_role;
ALTER TABLE public.doc_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_doc_number(_kind text, _prefix text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year int := extract(year from now())::int;
  _n int;
  _company uuid := COALESCE(public.current_company_id(), '00000000-0000-0000-0000-000000000001');
BEGIN
  INSERT INTO public.doc_sequences(company_id, kind, year, last_no)
  VALUES (_company, _kind, _year, 1)
  ON CONFLICT (company_id, kind, year) DO UPDATE SET last_no = public.doc_sequences.last_no + 1
  RETURNING last_no INTO _n;
  RETURN _prefix || '-' || _year || '-' || lpad(_n::text, 4, '0');
END; $$;

-- ============ QUOTES ============
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  number text NOT NULL,
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
  follow_up_at timestamptz,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);
CREATE INDEX idx_quotes_customer ON public.quotes (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotes own company" ON public.quotes FOR ALL TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE TRIGGER trg_quotes_updated BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_quotes_company BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

CREATE OR REPLACE FUNCTION public.tg_quotes_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT quote_prefix INTO _prefix FROM public.settings WHERE company_id = NEW.company_id;
    NEW.number := public.next_doc_number('quote', COALESCE(_prefix,'Q'));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_quotes_number BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_quotes_set_number();

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_items_quote ON public.quote_items (quote_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_items TO authenticated;
GRANT ALL ON public.quote_items TO service_role;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quote_items own company" ON public.quote_items FOR ALL TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE TRIGGER trg_quote_items_company BEFORE INSERT ON public.quote_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

-- ============ JOBS ============
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  number text NOT NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
  status public.job_status NOT NULL DEFAULT 'received',
  assigned_to uuid[] NOT NULL DEFAULT '{}',
  expected_delivery timestamptz,
  started_at timestamptz,
  delivered_at timestamptz,
  notes text,
  delivery_notes text,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);
CREATE INDEX idx_jobs_status ON public.jobs (company_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs own company" ON public.jobs FOR ALL TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_jobs_company BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

CREATE OR REPLACE FUNCTION public.tg_jobs_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT job_prefix INTO _prefix FROM public.settings WHERE company_id = NEW.company_id;
    NEW.number := public.next_doc_number('job', COALESCE(_prefix,'J'));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_jobs_number BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_set_number();

CREATE TABLE public.job_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  status public.job_status,
  changed_by uuid REFERENCES auth.users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_job_events_job ON public.job_status_events (job_id);
GRANT SELECT, INSERT ON public.job_status_events TO authenticated;
GRANT ALL ON public.job_status_events TO service_role;
ALTER TABLE public.job_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_events own company" ON public.job_status_events FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE POLICY "job_events insert own company" ON public.job_status_events FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));

CREATE OR REPLACE FUNCTION public.tg_jobs_log_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.status = 'work_started' AND NEW.started_at IS NULL THEN NEW.started_at := now(); END IF;
      IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;
    END IF;
    INSERT INTO public.job_status_events(company_id, job_id, status, changed_by)
    VALUES (NEW.company_id, NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_jobs_status_ins AFTER INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_log_status();
CREATE TRIGGER trg_jobs_status_upd BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_log_status();

-- ============ INVOICES ============
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  number text NOT NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_amount numeric(12,2) NOT NULL DEFAULT 0,
  adjustment_note text,
  tax_rate numeric(5,2) NOT NULL DEFAULT 18.00,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'unpaid',
  notes text,
  signature_url text,
  signed_at timestamptz,
  deleted_at timestamptz,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);
CREATE INDEX idx_invoices_customer ON public.invoices (customer_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices finance own company" ON public.invoices FOR ALL TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_invoices_company BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

CREATE OR REPLACE FUNCTION public.tg_invoices_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT invoice_prefix INTO _prefix FROM public.settings WHERE company_id = NEW.company_id;
    NEW.number := public.next_doc_number('invoice', COALESCE(_prefix,'INV'));
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_invoices_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_set_number();

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  name text NOT NULL,
  qty numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0
);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items (invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT ALL ON public.invoice_items TO service_role;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice_items finance own company" ON public.invoice_items FOR ALL TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));
CREATE TRIGGER trg_invoice_items_company BEFORE INSERT ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  method public.payment_method NOT NULL DEFAULT 'cash',
  reference text,
  received_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_invoice ON public.payments (invoice_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments finance own company" ON public.payments FOR ALL TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));
CREATE TRIGGER trg_payments_company BEFORE INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

-- ============ MEDIA / EXPENSES / INQUIRIES ============
CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
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
CREATE INDEX idx_media_vehicle ON public.media (vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media TO authenticated;
GRANT ALL ON public.media TO service_role;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "media own company" ON public.media FOR ALL TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE TRIGGER trg_media_company BEFORE INSERT ON public.media FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  spent_on date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  vendor text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  notes text,
  bill_path text,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses finance own company" ON public.expenses FOR ALL TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_expenses_company BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
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
  follow_up_count integer NOT NULL DEFAULT 0,
  last_follow_up_at timestamptz,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT INSERT ON public.inquiries TO anon;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inquiries public submit" ON public.inquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "inquiries read own company" ON public.inquiries FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE POLICY "inquiries update own company" ON public.inquiries FOR UPDATE TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE POLICY "inquiries admin delete" ON public.inquiries FOR DELETE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id));
CREATE TRIGGER trg_inquiries_updated BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  entity text NOT NULL,
  entity_id uuid,
  parent_entity text,
  parent_id uuid,
  action text NOT NULL,
  summary text,
  changes jsonb,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_company ON public.activity_log (company_id, created_at DESC);
GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity read own company" ON public.activity_log FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE POLICY "activity insert own company" ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
CREATE TRIGGER trg_activity_company BEFORE INSERT ON public.activity_log FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();

-- ============ AUTH HOOKS ============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
  default_cid uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles(id, company_id, full_name, phone)
  VALUES (NEW.id, default_cid,
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first OR lower(NEW.email) = 'pbhavyaj992@gmail.com' THEN
    INSERT INTO public.user_roles(company_id, user_id, role)
    VALUES (default_cid, NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.enforce_single_super_admin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
  _owner_email constant text := 'pbhavyaj992@gmail.com';
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.role = 'super_admin' THEN
    SELECT lower(email) INTO _email FROM auth.users WHERE id = NEW.user_id;
    IF _email IS DISTINCT FROM _owner_email THEN
      RAISE EXCEPTION 'Super admin role is reserved for the platform owner account' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.role = 'super_admin' THEN
    SELECT lower(email) INTO _email FROM auth.users WHERE id = OLD.user_id;
    IF _email = _owner_email AND (TG_OP = 'DELETE' OR NEW.role <> 'super_admin') THEN
      RAISE EXCEPTION 'The platform owner super admin role cannot be removed' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END; $$;
CREATE TRIGGER trg_single_super_admin
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_super_admin();

-- ============ RPCs USED BY THE APP ============
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(_identifier text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN TRUE; END; $$;

CREATE OR REPLACE FUNCTION public.my_company_subscription()
RETURNS TABLE (plan_tier text, status text, seats integer, subscription_ends_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.plan_tier, c.status, c.seats, c.subscription_ends_at
  FROM public.companies c WHERE c.id = public.current_company_id();
$$;

CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result json;
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  SELECT json_build_object(
    'total_companies', (SELECT count(*) FROM public.companies),
    'total_active_users', (SELECT count(distinct user_id) FROM public.user_roles),
    'total_inquiries', (SELECT count(*) FROM public.inquiries),
    'total_jobs', (SELECT count(*) FROM public.jobs)
  ) INTO v_result;
  RETURN v_result;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_company_completely(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can delete companies' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.companies WHERE id = _company_id;
END; $$;

CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  _company_id uuid, _name text, _phone text,
  _email text DEFAULT NULL, _address text DEFAULT NULL, _source text DEFAULT NULL
) RETURNS public.customers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer public.customers;
  v_company uuid;
  v_norm text := public.normalize_phone(_phone);
BEGIN
  v_company := COALESCE(public.current_company_id(), _company_id);
  IF NOT public.in_my_company(v_company) THEN
    RAISE EXCEPTION 'Not allowed for this business' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_customer FROM public.customers
  WHERE company_id = v_company AND normalized_phone = v_norm AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.customers (company_id, name, phone, email, address, source)
    VALUES (v_company, _name, _phone, _email, _address, _source)
    RETURNING * INTO v_customer;
  END IF;
  RETURN v_customer;
END; $$;

CREATE OR REPLACE FUNCTION public.find_or_create_vehicle(
  _company_id uuid, _customer_id uuid, _number text,
  _brand text DEFAULT NULL, _model text DEFAULT NULL, _color text DEFAULT NULL, _fuel_type text DEFAULT NULL
) RETURNS public.vehicles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vehicle public.vehicles;
  v_company uuid;
  v_norm text := public.normalize_registration(_number);
BEGIN
  v_company := COALESCE(public.current_company_id(), _company_id);
  IF NOT public.in_my_company(v_company) THEN
    RAISE EXCEPTION 'Not allowed for this business' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_vehicle FROM public.vehicles
  WHERE company_id = v_company AND normalized_registration = v_norm AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.vehicles (company_id, customer_id, number, brand, model, color, fuel_type)
    VALUES (v_company, _customer_id, _number, _brand, _model, _color, _fuel_type)
    RETURNING * INTO v_vehicle;
  END IF;
  RETURN v_vehicle;
END; $$;

CREATE OR REPLACE FUNCTION public.merge_customers(_source uuid, _target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _moved jsonb := '{}'::jsonb;
  _n int;
  _company uuid;
BEGIN
  IF NOT public.current_user_can_admin() THEN
    RAISE EXCEPTION 'Only admins can merge customers' USING ERRCODE = '42501';
  END IF;
  IF _source = _target THEN RAISE EXCEPTION 'Source and target must be different'; END IF;

  SELECT company_id INTO _company FROM public.customers WHERE id = _target;
  IF _company IS NULL OR NOT public.in_my_company(_company) THEN
    RAISE EXCEPTION 'Target customer not found' USING ERRCODE = '42501';
  END IF;

  UPDATE public.vehicles SET customer_id = _target WHERE customer_id = _source AND company_id = _company;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('vehicles', _n);
  UPDATE public.quotes SET customer_id = _target WHERE customer_id = _source AND company_id = _company;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('quotes', _n);
  UPDATE public.jobs SET customer_id = _target WHERE customer_id = _source AND company_id = _company;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('jobs', _n);
  UPDATE public.invoices SET customer_id = _target WHERE customer_id = _source AND company_id = _company;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('invoices', _n);
  UPDATE public.inquiries SET customer_id = _target WHERE customer_id = _source AND company_id = _company;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('inquiries', _n);
  UPDATE public.media SET customer_id = _target WHERE customer_id = _source AND company_id = _company;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('media', _n);

  UPDATE public.customers
  SET deleted_at = now(),
      normalized_phone = normalized_phone || '_merged' || extract(epoch from now())::bigint
  WHERE id = _source AND company_id = _company;

  INSERT INTO public.activity_log(company_id, entity, entity_id, action, summary, changes, actor_id)
  VALUES (_company, 'customer', _target, 'merge', 'Merged duplicate customer into this record',
    jsonb_build_object('source', _source, 'target', _target, 'moved', _moved), auth.uid());

  RETURN _moved;
END; $$;

-- ============ FUNCTION EXECUTE GRANTS ============
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $do$;
