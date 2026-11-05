-- 1. DELETE ALL USERS (Except current if needed, but we want a clean slate)
-- This will cascade to profiles and user_roles because of the FK constraints.
DELETE FROM auth.users WHERE email <> 'pbhavyaj992@gmail.com' OR email IS NULL;

-- 2. RESET THE MASTER ADMIN DATA for pbhavyaj992@gmail.com
-- Ensure the platform company is definitely active first
UPDATE public.companies 
SET status = 'active', plan_tier = 'enterprise' 
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Ensure the role is assigned
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT id, 'super_admin', '00000000-0000-0000-0000-000000000001'
FROM auth.users
WHERE email = 'pbhavyaj992@gmail.com'
ON CONFLICT (company_id, user_id, role) DO NOTHING;

-- Ensure the profile is assigned
INSERT INTO public.profiles (id, company_id, full_name)
SELECT id, '00000000-0000-0000-0000-000000000001', 'Master Admin'
FROM auth.users
WHERE email = 'pbhavyaj992@gmail.com'
ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;

-- 3. HARDEN THE TRIGGER to prevent this email from ever being a normal user
-- We'll modify handle_new_user and enforce_single_super_admin triggers to be even stricter.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  default_cid uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Always create a profile
  INSERT INTO public.profiles(id, company_id, full_name, phone)
  VALUES (NEW.id, default_cid, 
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id;

  -- FORCED ROLE ASSIGNMENT: If this is the owner email, ALWAYS make super_admin
  IF lower(NEW.email) = 'pbhavyaj992@gmail.com' THEN
    INSERT INTO public.user_roles(company_id, user_id, role)
    VALUES (default_cid, NEW.id, 'super_admin')
    ON CONFLICT (company_id, user_id, role) DO NOTHING;
    
    -- Also inject metadata directly into the user record to ensure the JWT is always correct
    UPDATE auth.users 
    SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{company_id}', '"00000000-0000-0000-0000-000000000001"')
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END; $$;

-- 4. FINAL CLEANUP: Remove any other roles for the owner that aren't super_admin
DELETE FROM public.user_roles 
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'pbhavyaj992@gmail.com')
AND role <> 'super_admin';

-- 5. Verification
SELECT email, (SELECT count(*) FROM public.user_roles WHERE user_id = auth.users.id) as role_count 
FROM auth.users;