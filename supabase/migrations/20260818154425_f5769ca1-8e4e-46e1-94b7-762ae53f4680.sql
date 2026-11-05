-- 1. Ensure the platform company is robustly active
UPDATE public.companies 
SET 
    status = 'active', 
    plan_tier = 'enterprise',
    subscription_ends_at = NULL, -- Lifetime/No expiry for platform
    grace_days = 365
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 2. Force the correct role and metadata for the master admin
DO $$
DECLARE
    v_user_id uuid := '06243e6e-b225-448e-8eb6-849cc39f0408';
    v_comp_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Ensure Profile exists
    INSERT INTO public.profiles (id, company_id, full_name)
    VALUES (v_user_id, v_comp_id, 'Master Admin')
    ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;

    -- Ensure Role is super_admin
    DELETE FROM public.user_roles WHERE user_id = v_user_id AND role != 'super_admin';
    INSERT INTO public.user_roles (company_id, user_id, role)
    VALUES (v_comp_id, v_user_id, 'super_admin')
    ON CONFLICT (company_id, user_id, role) DO NOTHING;

    -- Inject Auth Metadata (Crucial for TanStack session stability)
    UPDATE auth.users 
    SET raw_user_meta_data = raw_user_meta_data || '{"company_id": "00000000-0000-0000-0000-000000000001"}'::jsonb
    WHERE id = v_user_id;
END $$;

-- 3. Redefine the subscription check function (Drop first because return type changes)
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
BEGIN
    RETURN QUERY
    SELECT 
        c.plan_tier, 
        c.status, 
        c.seats, 
        c.subscription_ends_at,
        c.name,
        (
            c.status = 'active' AND 
            (c.subscription_ends_at IS NULL OR c.subscription_ends_at + (c.grace_days || ' days')::interval >= now())
        ) as is_active
    FROM public.companies c 
    WHERE c.id = (
        -- Directly look up the user's company to avoid dependency on current_company_id() if it's lagging
        SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1
    );
END; $$;

-- 4. Re-grant execute (since we dropped it)
GRANT EXECUTE ON FUNCTION public.my_company_subscription() TO authenticated, service_role;

-- 5. Final verification output
SELECT 
    (SELECT count(*) FROM public.user_roles WHERE user_id = '06243e6e-b225-448e-8eb6-849cc39f0408' AND role = 'super_admin') as is_super_admin,
    (SELECT is_active FROM public.my_company_subscription() LIMIT 1) as sub_active,
    (SELECT status FROM public.companies WHERE id = '00000000-0000-0000-0000-000000000001') as comp_status;