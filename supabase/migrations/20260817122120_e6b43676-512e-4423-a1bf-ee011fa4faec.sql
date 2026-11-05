-- ============ BATCH 5 (RETRY): HELPERS AND PLATFORM MODULES ============

-- 1. HELPERS FIRST
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.in_my_company(_cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _cid IS NOT NULL AND _cid = public.current_company_id();
$$;

CREATE OR REPLACE FUNCTION public.shares_my_company(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.company_id = public.current_company_id()
  );
$$;

-- 2. AUTH ATTEMPTS
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.auth_attempts TO authenticated;
GRANT ALL ON public.auth_attempts TO service_role;
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view auth attempts" ON public.auth_attempts; CREATE POLICY "Admins can view auth attempts" ON public.auth_attempts FOR SELECT TO authenticated USING (public.current_user_can_admin());

-- 3. COMPANY SITES
CREATE TABLE IF NOT EXISTS public.company_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subdomain text UNIQUE,
  custom_domain text UNIQUE,
  theme_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.company_sites TO authenticated;
GRANT ALL ON public.company_sites TO service_role;
ALTER TABLE public.company_sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff read own site" ON public.company_sites; CREATE POLICY "Staff read own site" ON public.company_sites FOR SELECT TO authenticated USING (company_id = public.current_company_id());

-- 4. PLATFORM PLANS
CREATE TABLE IF NOT EXISTS public.platform_plans (
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
GRANT SELECT ON public.platform_plans TO authenticated, anon;
GRANT ALL ON public.platform_plans TO service_role;
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone read active plans" ON public.platform_plans; CREATE POLICY "Anyone read active plans" ON public.platform_plans FOR SELECT TO authenticated, anon USING (is_active = true);

-- 5. COMPANY PAYMENTS
CREATE TABLE IF NOT EXISTS public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  paid_on timestamptz NOT NULL DEFAULT now(),
  method text NOT NULL DEFAULT 'stripe',
  reference text,
  status text NOT NULL DEFAULT 'succeeded',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.company_payments TO authenticated;
GRANT ALL ON public.company_payments TO service_role;
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read own company payments" ON public.company_payments; CREATE POLICY "Admins read own company payments" ON public.company_payments FOR SELECT TO authenticated USING (company_id = public.current_company_id());

-- 6. RPC: PLATFORM STATS
CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSON;
BEGIN
  IF NOT public.current_user_can_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  SELECT json_build_object(
    'total_companies', (SELECT count(*) FROM public.companies),
    'total_active_users', (SELECT count(distinct user_id) FROM public.user_roles),
    'total_inquiries', (SELECT count(*) FROM public.inquiries),
    'total_jobs', (SELECT count(*) FROM public.jobs)
  ) INTO v_result;
  RETURN v_result;
END; $$;

-- 7. SECURITY HARDENING
ALTER FUNCTION public.has_role(_user_id uuid, _role public.app_role) SET search_path = public;
ALTER FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[]) SET search_path = public;
ALTER FUNCTION public.current_user_is_staff() SET search_path = public;
ALTER FUNCTION public.current_user_can_admin() SET search_path = public;
ALTER FUNCTION public.current_user_can_finance() SET search_path = public;
ALTER FUNCTION public.next_doc_number(_type text, _prefix text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.platform_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_doc_number(text, text) FROM PUBLIC, anon;
