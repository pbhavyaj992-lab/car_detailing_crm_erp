-- ============ BATCH 7 (RETRY): MISSING COLUMNS, FUNCTIONS AND POLICIES ============

-- 1. FIX CUSTOMERS
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS lead_status text DEFAULT 'active';

-- 2. FIX COMPANY PAYMENTS
ALTER TABLE public.company_payments ADD COLUMN IF NOT EXISTS period_start timestamptz;
ALTER TABLE public.company_payments ADD COLUMN IF NOT EXISTS period_end timestamptz;

-- 3. FUNCTIONS FOR APP LOGIC
CREATE OR REPLACE FUNCTION public.my_company_subscription()
RETURNS TABLE (
  plan_tier text,
  status text,
  seats integer,
  subscription_ends_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT plan_tier, status, seats, subscription_ends_at 
  FROM public.companies 
  WHERE id = public.current_company_id();
$$;

CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  _company_id uuid,
  _name text,
  _phone text,
  _email text DEFAULT NULL,
  _address text DEFAULT NULL
) RETURNS public.customers LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer public.customers;
BEGIN
  SELECT * INTO v_customer FROM public.customers 
  WHERE company_id = _company_id AND (phone = _phone OR (email IS NOT NULL AND email = _email)) 
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.customers (company_id, name, phone, email, address)
    VALUES (_company_id, _name, _phone, _email, _address)
    RETURNING * INTO v_customer;
  END IF;

  RETURN v_customer;
END; $$;

CREATE OR REPLACE FUNCTION public.find_or_create_vehicle(
  _company_id uuid,
  _customer_id uuid,
  _number text,
  _brand text DEFAULT NULL,
  _model text DEFAULT NULL
) RETURNS public.vehicles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vehicle public.vehicles;
BEGIN
  SELECT * INTO v_vehicle FROM public.vehicles 
  WHERE company_id = _company_id AND number = _number 
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.vehicles (company_id, customer_id, number, brand, model)
    VALUES (_company_id, _customer_id, _number, _brand, _model)
    RETURNING * INTO v_vehicle;
  END IF;

  RETURN v_vehicle;
END; $$;

CREATE OR REPLACE FUNCTION public.delete_company_completely(_cid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_can_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM public.companies WHERE id = _cid;
END; $$;

-- 4. LOGIN EVENTS TABLE (Ensure it exists)
CREATE TABLE IF NOT EXISTS public.login_events (
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
DROP POLICY IF EXISTS "Tenant isolation" ON public.login_events;
CREATE POLICY "Tenant isolation" ON public.login_events FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

-- 5. User Roles and Profiles policies
DROP POLICY IF EXISTS "User roles tenant isolation" ON public.user_roles;
CREATE POLICY "User roles tenant isolation" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR company_id = public.current_company_id());

DROP POLICY IF EXISTS "Profiles tenant isolation" ON public.profiles;
CREATE POLICY "Profiles tenant isolation" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR company_id = public.current_company_id());
