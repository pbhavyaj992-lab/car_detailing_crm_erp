-- ============ BATCH 8 (RETRY): DROP AND RECREATE RPC ============

DROP FUNCTION IF EXISTS public.delete_company_completely(uuid);
CREATE OR REPLACE FUNCTION public.delete_company_completely(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_can_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  DELETE FROM public.companies WHERE id = _company_id;
END; $$;

DROP FUNCTION IF EXISTS public.find_or_create_customer(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.find_or_create_customer(uuid, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  _company_id uuid,
  _name text,
  _phone text,
  _email text DEFAULT NULL,
  _address text DEFAULT NULL,
  _source text DEFAULT NULL
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

DROP FUNCTION IF EXISTS public.find_or_create_vehicle(uuid, uuid, text, text, text);
DROP FUNCTION IF EXISTS public.find_or_create_vehicle(uuid, uuid, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.find_or_create_vehicle(
  _company_id uuid,
  _customer_id uuid,
  _number text,
  _brand text DEFAULT NULL,
  _model text DEFAULT NULL,
  _color text DEFAULT NULL,
  _fuel_type text DEFAULT NULL
) RETURNS public.vehicles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vehicle public.vehicles;
BEGIN
  SELECT * INTO v_vehicle FROM public.vehicles 
  WHERE company_id = _company_id AND number = _number 
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.vehicles (company_id, customer_id, number, brand, model, color, fuel_type)
    VALUES (_company_id, _customer_id, _number, _brand, _model, _color, _fuel_type)
    RETURNING * INTO v_vehicle;
  END IF;

  RETURN v_vehicle;
END; $$;
