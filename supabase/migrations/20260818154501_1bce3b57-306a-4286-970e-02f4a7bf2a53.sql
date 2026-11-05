-- 1. Redefine current_company_id to be more stable
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- First try user metadata for maximum speed and session stability
  -- Then fallback to database lookup
  SELECT COALESCE(
    (NULLIF(current_setting('request.jwt.claims', true)::jsonb->'user_metadata'->>'company_id', '')::uuid),
    (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
  );
$$;

-- 2. Redefine my_company_subscription to be bulletproof
DROP FUNCTION IF EXISTS public.my_company_subscription();

CREATE OR REPLACE FUNCTION public.my_company_subscription()
RETURNS TABLE (
    plan_tier text, 
    status text, 
    seats integer, 
    subscription_ends_at timestamptz,
    name text,
    is_active boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_company_id uuid;
BEGIN
    -- Get company ID directly from roles if metadata is missing
    SELECT ur.company_id INTO v_company_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    LIMIT 1;

    -- If still no company found (e.g. new user), return defaults that won't block super admin
    IF v_company_id IS NULL THEN
        RETURN QUERY SELECT 
            'starter'::text, 
            'active'::text, 
            5, 
            NULL::timestamptz, 
            'New Business'::text, 
            true;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        c.plan_tier, 
        c.status, 
        c.seats, 
        c.subscription_ends_at,
        c.name,
        (
            c.status = 'active' AND 
            (c.subscription_ends_at IS NULL OR c.subscription_ends_at + (COALESCE(c.grace_days, 3) || ' days')::interval >= now())
        ) as is_active
    FROM public.companies c 
    WHERE c.id = v_company_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.my_company_subscription() TO authenticated, service_role;

-- 3. Final verification for the account
SELECT 
    au.email,
    au.id as uid,
    (SELECT role FROM public.user_roles WHERE user_id = au.id LIMIT 1) as confirmed_role,
    (SELECT is_active FROM public.my_company_subscription() LIMIT 1) as live_sub_status
FROM auth.users au
WHERE au.email = 'pbhavyaj992@gmail.com';