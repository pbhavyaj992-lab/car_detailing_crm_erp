
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

DROP POLICY IF EXISTS "super admin manage companies" ON public.companies;
CREATE POLICY "super admin manage companies" ON public.companies
  FOR ALL TO authenticated
  USING (public.current_user_is_super_admin())
  WITH CHECK (public.current_user_is_super_admin());

DROP POLICY IF EXISTS "super admin manage settings" ON public.settings;
CREATE POLICY "super admin manage settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.current_user_is_super_admin())
  WITH CHECK (public.current_user_is_super_admin());

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'companies_total', (SELECT count(*) FROM public.companies),
    'companies_active', (SELECT count(*) FROM public.companies WHERE status = 'active'),
    'users_total', (SELECT count(DISTINCT user_id) FROM public.user_roles),
    'customers_total', (SELECT count(*) FROM public.customers WHERE deleted_at IS NULL),
    'jobs_total', (SELECT count(*) FROM public.jobs WHERE deleted_at IS NULL),
    'jobs_open', (SELECT count(*) FROM public.jobs WHERE deleted_at IS NULL AND status <> 'delivered'),
    'invoices_total', (SELECT count(*) FROM public.invoices WHERE deleted_at IS NULL),
    'revenue_total', (SELECT COALESCE(SUM(paid_amount),0) FROM public.invoices WHERE deleted_at IS NULL),
    'signups_30d', (SELECT count(*) FROM public.companies WHERE created_at > now() - interval '30 days'),
    'per_company', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'name')
      FROM (
        SELECT jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'users', (SELECT count(*) FROM public.user_roles ur WHERE ur.company_id = c.id),
          'customers', (SELECT count(*) FROM public.customers cu WHERE cu.company_id = c.id AND cu.deleted_at IS NULL),
          'jobs', (SELECT count(*) FROM public.jobs j WHERE j.company_id = c.id AND j.deleted_at IS NULL),
          'revenue', (SELECT COALESCE(SUM(i.paid_amount),0) FROM public.invoices i WHERE i.company_id = c.id AND i.deleted_at IS NULL)
        ) AS x
        FROM public.companies c
      ) s
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END; $$;

REVOKE ALL ON FUNCTION public.platform_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO authenticated;
