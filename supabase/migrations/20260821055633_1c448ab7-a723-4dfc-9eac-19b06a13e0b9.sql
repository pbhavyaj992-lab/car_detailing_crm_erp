-- 1. Inquiries: anon may only insert against a company with an active public site
DROP POLICY IF EXISTS "inquiries_insert_anon" ON public.inquiries;
CREATE POLICY "inquiries_insert_anon" ON public.inquiries
FOR INSERT TO anon
WITH CHECK (
  company_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.company_sites cs
    WHERE cs.company_id = public.inquiries.company_id
      AND cs.is_active = true
  )
);

-- 2. Storage: tenant-scoped policies for private buckets (path = <company_id>/...)
DROP POLICY IF EXISTS "tenant_files_select" ON storage.objects;
CREATE POLICY "tenant_files_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id IN ('vehicle-media','expense-bills','customer-docs')
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);

DROP POLICY IF EXISTS "tenant_files_insert" ON storage.objects;
CREATE POLICY "tenant_files_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('vehicle-media','expense-bills','customer-docs')
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);

DROP POLICY IF EXISTS "tenant_files_update" ON storage.objects;
CREATE POLICY "tenant_files_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id IN ('vehicle-media','expense-bills','customer-docs')
  AND (storage.foldername(name))[1] = public.current_company_id()::text
)
WITH CHECK (
  bucket_id IN ('vehicle-media','expense-bills','customer-docs')
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);

DROP POLICY IF EXISTS "tenant_files_delete" ON storage.objects;
CREATE POLICY "tenant_files_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id IN ('vehicle-media','expense-bills','customer-docs')
  AND (storage.foldername(name))[1] = public.current_company_id()::text
);

-- 3. platform_stats + delete_company_completely: super admin only (already enforced in body); revoke broad execute on internal helpers
REVOKE EXECUTE ON FUNCTION public.check_auth_rate_limit(text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_single_super_admin() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_invoices_set_number() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_jobs_log_status() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_jobs_set_number() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_quotes_set_number() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_set_company_id() FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_doc_number(text, text) FROM authenticated, anon, PUBLIC;

-- platform_stats: enforce super admin only
CREATE OR REPLACE FUNCTION public.platform_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v json;
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'companies_total', (SELECT count(*) FROM public.companies),
    'companies_active', (SELECT count(*) FROM public.companies c WHERE public.is_company_active(c.id)),
    'companies_suspended', (SELECT count(*) FROM public.companies WHERE status IN ('suspended','cancelled')),
    'users_total', (SELECT count(DISTINCT user_id) FROM public.user_roles),
    'customers_total', (SELECT count(*) FROM public.customers WHERE deleted_at IS NULL),
    'jobs_total', (SELECT count(*) FROM public.jobs WHERE deleted_at IS NULL),
    'jobs_open', (SELECT count(*) FROM public.jobs WHERE deleted_at IS NULL AND status <> 'delivered'),
    'invoices_total', (SELECT count(*) FROM public.invoices WHERE deleted_at IS NULL),
    'revenue_total', (SELECT COALESCE(SUM(amount),0) FROM public.payments),
    'signups_30d', (SELECT count(*) FROM public.companies WHERE created_at >= now() - interval '30 days'),
    'per_company', COALESCE((
      SELECT json_agg(x ORDER BY x.name)
      FROM (
        SELECT c.id, c.name,
          (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.company_id = c.id) AS users,
          (SELECT count(*) FROM public.customers cu WHERE cu.company_id = c.id AND cu.deleted_at IS NULL) AS customers,
          (SELECT count(*) FROM public.jobs j WHERE j.company_id = c.id AND j.deleted_at IS NULL) AS jobs,
          (SELECT COALESCE(SUM(p.amount),0) FROM public.payments p WHERE p.company_id = c.id) AS revenue
        FROM public.companies c
      ) x
    ), '[]'::json)
  ) INTO v;
  RETURN v;
END;
$function$;

-- find_or_create_* : ignore caller-supplied company and always use caller's tenant
CREATE OR REPLACE FUNCTION public.find_or_create_customer(_company_id uuid DEFAULT NULL::uuid, _name text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _email text DEFAULT NULL::text, _address text DEFAULT NULL::text, _source text DEFAULT NULL::text)
 RETURNS customers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_customer public.customers;
  v_company uuid;
  v_norm text := public.normalize_phone(_phone);
BEGIN
  v_company := public.current_company_id();
  IF v_company IS NULL OR (_company_id IS NOT NULL AND _company_id <> v_company) THEN
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

CREATE OR REPLACE FUNCTION public.find_or_create_vehicle(_company_id uuid DEFAULT NULL::uuid, _customer_id uuid DEFAULT NULL::uuid, _number text DEFAULT NULL::text, _brand text DEFAULT NULL::text, _model text DEFAULT NULL::text, _color text DEFAULT NULL::text, _fuel_type text DEFAULT NULL::text)
 RETURNS vehicles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_vehicle public.vehicles;
  v_company uuid;
  v_norm text := public.normalize_registration(_number);
BEGIN
  v_company := public.current_company_id();
  IF v_company IS NULL OR (_company_id IS NOT NULL AND _company_id <> v_company) THEN
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

-- delete_company_completely: super admin only (unchanged body, re-asserted)
CREATE OR REPLACE FUNCTION public.delete_company_completely(_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can delete companies' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.companies WHERE id = _company_id;
END; $function$;