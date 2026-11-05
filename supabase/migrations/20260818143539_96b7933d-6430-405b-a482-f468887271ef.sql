-- 1. Ensure the master user has the super_admin role
INSERT INTO public.user_roles (user_id, role, company_id) 
VALUES ('06243e6e-b225-448e-8eb6-849cc39f0408', 'super_admin', '00000000-0000-0000-0000-000000000001') 
ON CONFLICT (company_id, user_id, role) DO NOTHING;

-- 2. Ensure the profile exists
INSERT INTO public.profiles (id, company_id, full_name) 
VALUES ('06243e6e-b225-448e-8eb6-849cc39f0408', '00000000-0000-0000-0000-000000000001', 'Master Admin') 
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, company_id = EXCLUDED.company_id;

-- 3. Force the company_id into metadata for the session
-- Note: This is an admin operation, I am assuming I have access to the auth schema via the tool's backend permissions or recommending this if it fails
UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(coalesce(raw_user_meta_data, '{}'::jsonb), '{company_id}', '"00000000-0000-0000-0000-000000000001"') 
WHERE id = '06243e6e-b225-448e-8eb6-849cc39f0408';

-- 4. Verify the role function explicitly
SELECT public.has_role('06243e6e-b225-448e-8eb6-849cc39f0408', 'super_admin');