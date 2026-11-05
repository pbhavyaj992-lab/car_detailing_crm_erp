
-- 1. Correct the unique constraint on user_roles to include company_id
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_company_key UNIQUE (user_id, role, company_id);

-- 2. Link the existing user to the default company with super_admin role
INSERT INTO public.user_roles (user_id, company_id, role)
VALUES (
  '06243e6e-b225-448e-8eb6-849cc39f0408',
  '00000000-0000-0000-0000-000000000001',
  'super_admin'
)
ON CONFLICT (user_id, role, company_id) DO NOTHING;

-- 3. Ensure profile exists
INSERT INTO public.profiles (id, full_name)
VALUES (
  '06243e6e-b225-448e-8eb6-849cc39f0408',
  'Master Admin'
)
ON CONFLICT (id) DO NOTHING;
