-- 1. CLEANUP: Remove any conflicting or orphaned role/profile entries for this email
-- This ensures we don't have multiple records causing ambiguity
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    -- Get the actual UID from auth.users (the only source of truth for identity)
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'pbhavyaj992@gmail.com';

    IF v_user_id IS NOT NULL THEN
        -- Delete any roles NOT associated with this specific UID for this email
        DELETE FROM public.user_roles WHERE user_id != v_user_id AND user_id IN (
            SELECT id FROM auth.users WHERE email = 'pbhavyaj992@gmail.com'
        );
        
        -- Delete any profiles NOT associated with this specific UID
        DELETE FROM public.profiles WHERE id != v_user_id AND id IN (
            SELECT id FROM auth.users WHERE email = 'pbhavyaj992@gmail.com'
        );
    END IF;
END $$;

-- 2. HARDENING: Re-apply the master records to the current verified UID
DO $$
DECLARE
    v_user_id uuid;
    v_comp_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'pbhavyaj992@gmail.com';

    IF v_user_id IS NOT NULL THEN
        -- Force Profile
        INSERT INTO public.profiles (id, company_id, full_name)
        VALUES (v_user_id, v_comp_id, 'Master Admin')
        ON CONFLICT (id) DO UPDATE SET company_id = v_comp_id;

        -- Force Role (Super Admin)
        INSERT INTO public.user_roles (company_id, user_id, role)
        VALUES (v_comp_id, v_user_id, 'super_admin')
        ON CONFLICT (company_id, user_id, role) DO NOTHING;

        -- Force Platform Company Status
        UPDATE public.companies 
        SET status = 'active', plan_tier = 'enterprise', subscription_ends_at = NULL 
        WHERE id = v_comp_id;
        
        -- Sync Auth Metadata
        UPDATE auth.users 
        SET raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{company_id}',
            to_jsonb(v_comp_id::text)
        )
        WHERE id = v_user_id;
    END IF;
END $$;

-- 3. DIAGNOSTIC: Show exactly what is currently in the DB for this user
SELECT 
    au.email, 
    au.id as auth_uid,
    p.company_id as profile_cid,
    ur.role as assigned_role,
    c.status as company_status,
    (SELECT is_active FROM public.my_company_subscription() LIMIT 1) as subscription_active
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE au.email = 'pbhavyaj992@gmail.com';