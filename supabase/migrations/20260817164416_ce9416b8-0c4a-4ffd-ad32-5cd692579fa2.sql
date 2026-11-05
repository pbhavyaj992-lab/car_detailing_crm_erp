
-- Update the existing user's metadata to include company_id
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"company_id": "00000000-0000-0000-0000-000000000001", "full_name": "Master Admin"}'::jsonb
WHERE email = 'pbhavyaj992@gmail.com';

-- Ensure the super_admin role is present in user_roles
INSERT INTO public.user_roles (user_id, company_id, role)
SELECT id, '00000000-0000-0000-0000-000000000001', 'super_admin'
FROM auth.users
WHERE email = 'pbhavyaj992@gmail.com'
ON CONFLICT (user_id, role, company_id) DO NOTHING;
