DO $sq$ BEGIN CREATE TYPE public.app_role AS ENUM ('super_admin','owner','manager','reception','worker'); EXCEPTION WHEN duplicate_object THEN null; END $sq$;
DO $sq$ BEGIN CREATE TYPE public.vehicle_context AS ENUM ('at_garage','inquiry_only'); EXCEPTION WHEN duplicate_object THEN null; END $sq$;
DO $sq$ BEGIN CREATE TYPE public.quote_status AS ENUM ('draft','approved','converted','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $sq$;
DO $sq$ BEGIN CREATE TYPE public.job_status AS ENUM ('received','inspection','work_started','quality_check','ready','delivered'); EXCEPTION WHEN duplicate_object THEN null; END $sq$;
DO $sq$ BEGIN CREATE TYPE public.media_stage AS ENUM ('pre_work','post_work'); EXCEPTION WHEN duplicate_object THEN null; END $sq$;
DO $sq$ BEGIN CREATE TYPE public.media_kind AS ENUM ('photo','video'); EXCEPTION WHEN duplicate_object THEN null; END $sq$;
DO $sq$ BEGIN CREATE TYPE public.payment_method AS ENUM ('cash','upi','card','bank_transfer','other'); EXCEPTION WHEN duplicate_object THEN null; END $sq$;
DO $sq$ BEGIN CREATE TYPE public.invoice_status AS ENUM ('unpaid','partial','paid','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $sq$;
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles; CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users update own profile" ON public.profiles; CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles; CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_roles readable by authenticated" ON public.user_roles; CREATE POLICY "user_roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
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
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TABLE IF NOT EXISTS public.settings (
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
DROP POLICY IF EXISTS "settings readable" ON public.settings; CREATE POLICY "settings readable" ON public.settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "settings admin write" ON public.settings; CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated
  USING (public.current_user_can_admin()) WITH CHECK (public.current_user_can_admin());
DROP TRIGGER IF EXISTS trg_settings_updated ON public.settings;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
INSERT INTO public.settings(id) VALUES (true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.services (
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
DROP POLICY IF EXISTS "services readable" ON public.services; CREATE POLICY "services readable" ON public.services FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "services admin write" ON public.services; CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (public.current_user_can_admin()) WITH CHECK (public.current_user_can_admin());
DROP TRIGGER IF EXISTS trg_services_updated ON public.services;
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
INSERT INTO public.services(name, price, sort_order) VALUES
  ('Exterior Wash', 500, 1),
  ('Interior Cleaning', 800, 2),
  ('Wax Polish', 1500, 3),
  ('Paint Correction', 8000, 4),
  ('Ceramic Coating', 15000, 5),
  ('PPF', 45000, 6) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.customers (
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
CREATE INDEX IF NOT EXISTS idx_f0_i0 ON public.customers (phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read customers" ON public.customers; CREATE POLICY "staff read customers" ON public.customers FOR SELECT TO authenticated USING (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff write customers" ON public.customers; CREATE POLICY "staff write customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff update customers" ON public.customers; CREATE POLICY "staff update customers" ON public.customers FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
DROP POLICY IF EXISTS "admin delete customers" ON public.customers; CREATE POLICY "admin delete customers" ON public.customers FOR DELETE TO authenticated USING (public.current_user_can_admin());
DROP TRIGGER IF EXISTS trg_customers_updated ON public.customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TABLE IF NOT EXISTS public.vehicles (
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
CREATE INDEX IF NOT EXISTS idx_f0_i2 ON public.vehicles (customer_id);
CREATE INDEX IF NOT EXISTS idx_f0_i3 ON public.vehicles (number);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read vehicles" ON public.vehicles; CREATE POLICY "staff read vehicles" ON public.vehicles FOR SELECT TO authenticated USING (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff write vehicles" ON public.vehicles; CREATE POLICY "staff write vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff update vehicles" ON public.vehicles; CREATE POLICY "staff update vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
DROP POLICY IF EXISTS "admin delete vehicles" ON public.vehicles; CREATE POLICY "admin delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (public.current_user_can_admin());
DROP TRIGGER IF EXISTS trg_vehicles_updated ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
