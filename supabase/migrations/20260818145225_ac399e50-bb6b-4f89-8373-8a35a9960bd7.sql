DROP FUNCTION IF EXISTS public.my_company_subscription();

CREATE OR REPLACE FUNCTION public.my_company_subscription()
RETURNS TABLE (
  company_id uuid,
  name text,
  plan_tier text, 
  status text, 
  seats integer, 
  subscription_ends_at timestamptz,
  grace_days integer,
  is_active boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    c.id,
    c.name,
    c.plan_tier, 
    c.status, 
    c.seats, 
    c.subscription_ends_at,
    c.grace_days,
    (
      c.status = 'active' AND 
      (c.subscription_ends_at IS NULL OR c.subscription_ends_at + (c.grace_days || ' days')::interval > now())
    ) as is_active
  FROM public.companies c 
  WHERE c.id = public.current_company_id();
$$;

GRANT EXECUTE ON FUNCTION public.my_company_subscription() TO authenticated, service_role;

UPDATE public.companies
SET status = 'active', 
    plan_tier = 'enterprise',
    subscription_ends_at = NULL,
    grace_days = 365
WHERE id = '00000000-0000-0000-0000-000000000001';