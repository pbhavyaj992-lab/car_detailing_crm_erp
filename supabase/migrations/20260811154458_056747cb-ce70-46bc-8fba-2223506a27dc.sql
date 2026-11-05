-- ============================================================
-- 1. TENANT-SAFE LOOKUP RPCs
-- ============================================================

-- Scoped customer lookup by company (internal)
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  _phone text, _name text, _email text DEFAULT NULL, _address text DEFAULT NULL, _source text DEFAULT NULL
) RETURNS public.customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _norm text := public.normalize_phone(_phone);
  _company uuid := public.current_company_id();
  _row public.customers;
BEGIN
  IF _company IS NULL THEN RAISE EXCEPTION 'Unauthorized: No tenant context' USING ERRCODE = '42501'; END IF;
  IF _norm IS NULL THEN RAISE EXCEPTION 'Invalid phone number: %', _phone USING ERRCODE = '22023'; END IF;
  IF NOT public.current_user_is_staff() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _row FROM public.customers
   WHERE company_id = _company AND normalized_phone = _norm AND deleted_at IS NULL
   LIMIT 1;
  IF FOUND THEN RETURN _row; END IF;

  INSERT INTO public.customers(company_id, phone, name, email, address, source, created_by)
  VALUES (_company, _phone, _name, _email, _address, COALESCE(_source,'walk_in'), auth.uid())
  ON CONFLICT (company_id, normalized_phone) WHERE normalized_phone IS NOT NULL
  DO UPDATE SET name = EXCLUDED.name
  RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- Scoped vehicle lookup by company (internal)
CREATE OR REPLACE FUNCTION public.find_or_create_vehicle(
  _customer_id uuid, _number text, _brand text DEFAULT NULL, _model text DEFAULT NULL,
  _color text DEFAULT NULL, _fuel_type text DEFAULT NULL
) RETURNS public.vehicles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _norm text := public.normalize_vehicle_reg(_number);
  _company uuid := public.current_company_id();
  _row public.vehicles;
BEGIN
  IF _company IS NULL THEN RAISE EXCEPTION 'Unauthorized: No tenant context' USING ERRCODE = '42501'; END IF;
  IF _norm IS NULL OR length(_norm) < 4 THEN RAISE EXCEPTION 'Invalid registration: %', _number USING ERRCODE = '22023'; END IF;
  IF NOT public.current_user_is_staff() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _row FROM public.vehicles
   WHERE company_id = _company AND normalized_registration = _norm AND deleted_at IS NULL
   LIMIT 1;
  IF FOUND THEN RETURN _row; END IF;

  INSERT INTO public.vehicles(company_id, customer_id, number, brand, model, color, fuel_type)
  VALUES (_company, _customer_id, _number, _brand, _model, _color, _fuel_type)
  ON CONFLICT (company_id, normalized_registration) WHERE normalized_registration IS NOT NULL
  DO UPDATE SET brand = COALESCE(EXCLUDED.brand, public.vehicles.brand)
  RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- ============================================================
-- 2. SUBSCRIPTION ENFORCEMENT & LIMITS
-- ============================================================

-- Function to check if current company can perform business operations
CREATE OR REPLACE FUNCTION public.check_subscription_active()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  _company uuid := public.current_company_id();
  _status text;
  _ends_at timestamptz;
  _grace int;
BEGIN
  IF _company IS NULL THEN RETURN true; END IF;
  
  -- Bypass for super_admins
  IF public.has_role(auth.uid(), 'super_admin') THEN RETURN true; END IF;

  SELECT status, subscription_ends_at, grace_days INTO _status, _ends_at, _grace
  FROM public.companies WHERE id = _company;

  IF _status IN ('suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Your subscription is inactive. Please renew your plan to continue.' USING ERRCODE = '42501';
  END IF;

  IF _ends_at IS NOT NULL AND (now() > (_ends_at + (COALESCE(_grace, 0) || ' days')::interval)) THEN
    RAISE EXCEPTION 'Your subscription has expired. Please renew your plan to continue.' USING ERRCODE = '42501';
  END IF;
  
  RETURN true;
END; $$;

-- Policies to enforce subscription on writes
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['quotes', 'jobs', 'invoices', 'payments', 'expenses', 'inquiries'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "subscription_write_enforcement" ON public.%I', t);
    EXECUTE format('CREATE POLICY "subscription_write_enforcement" ON public.%I FOR INSERT WITH CHECK ( public.check_subscription_active() )', t);
  END LOOP;
END $$;
