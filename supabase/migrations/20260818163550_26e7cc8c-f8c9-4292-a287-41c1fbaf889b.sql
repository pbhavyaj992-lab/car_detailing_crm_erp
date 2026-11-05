-- 1) Make _company_id optional so the server derives it from the caller
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  _company_id uuid DEFAULT NULL,
  _name text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _address text DEFAULT NULL,
  _source text DEFAULT NULL
)
RETURNS public.customers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer public.customers;
  v_company uuid;
  v_norm text := public.normalize_phone(_phone);
BEGIN
  v_company := COALESCE(public.current_company_id(), _company_id);
  IF v_company IS NULL OR NOT public.in_my_company(v_company) THEN
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
END; $function$;

CREATE OR REPLACE FUNCTION public.find_or_create_vehicle(
  _company_id uuid DEFAULT NULL,
  _customer_id uuid DEFAULT NULL,
  _number text DEFAULT NULL,
  _brand text DEFAULT NULL,
  _model text DEFAULT NULL,
  _color text DEFAULT NULL,
  _fuel_type text DEFAULT NULL
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_vehicle public.vehicles;
  v_company uuid;
  v_norm text := public.normalize_registration(_number);
BEGIN
  v_company := COALESCE(public.current_company_id(), _company_id);
  IF v_company IS NULL OR NOT public.in_my_company(v_company) THEN
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
END; $function$;

REVOKE ALL ON FUNCTION public.find_or_create_customer(uuid, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.find_or_create_vehicle(uuid, uuid, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_vehicle(uuid, uuid, text, text, text, text, text) TO authenticated;

-- 2) Backfill missing company_id into auth metadata from role records
UPDATE auth.users u
SET raw_user_meta_data = jsonb_set(COALESCE(u.raw_user_meta_data, '{}'::jsonb), '{company_id}', to_jsonb(r.company_id::text))
FROM public.user_roles r
WHERE r.user_id = u.id
  AND COALESCE(u.raw_user_meta_data->>'company_id', '') = '';

-- 3) Backfill profiles.company_id from role records where missing
UPDATE public.profiles p
SET company_id = r.company_id
FROM public.user_roles r
WHERE r.user_id = p.id AND p.company_id IS NULL;