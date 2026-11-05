-- 1. Ensure the user is in public.user_roles as super_admin for the platform company
INSERT INTO public.user_roles (user_id, role, company_id)
VALUES ('06243e6e-b225-448e-8eb6-849cc39f0408', 'super_admin', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (company_id, user_id, role) DO NOTHING;

-- 2. Ensure a profile exists for the user
INSERT INTO public.profiles (id, company_id, full_name)
VALUES ('06243e6e-b225-448e-8eb6-849cc39f0408', '00000000-0000-0000-0000-000000000001', 'Master Admin')
ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, full_name = EXCLUDED.full_name;

-- 3. Update auth.users metadata to ensure company_id is present for session injection
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{company_id}',
  '"00000000-0000-0000-0000-000000000001"'
)
WHERE id = '06243e6e-b225-448e-8eb6-849cc39f0408';

-- 4. Double check the platform company exists and is active
UPDATE public.companies
SET status = 'active', plan_tier = 'enterprise'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- 5. Verification query to confirm state
SELECT
  (SELECT count(*) FROM public.user_roles WHERE user_id = '06243e6e-b225-448e-8eb6-849cc39f0408' AND role = 'super_admin') as role_count,
  (SELECT count(*) FROM public.profiles WHERE id = '06243e6e-b225-448e-8eb6-849cc39f0408') as profile_count,
  (SELECT status FROM public.companies WHERE id = '00000000-0000-0000-0000-000000000001') as company_status,
  (SELECT public.has_role('06243e6e-b225-448e-8eb6-849cc39f0408', 'super_admin')) as has_role_check;