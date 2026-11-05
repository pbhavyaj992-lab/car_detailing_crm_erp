
-- Update the existing user's password to match the one provided by the user
-- Supabase uses bcrypt for passwords.
UPDATE auth.users 
SET 
  encrypted_password = crypt('kAKADADA#@1', gen_salt('bf')),
  email_confirmed_at = now(),
  raw_user_meta_data = raw_user_meta_data || '{"company_id": "00000000-0000-0000-0000-000000000001"}'::jsonb,
  updated_at = now()
WHERE email = 'pbhavyaj992@gmail.com';

-- Verify the identity exists (Supabase requires an identity for email/password signin)
INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id)
SELECT gen_random_uuid(), id, jsonb_build_object('sub', id, 'email', email), 'email', now(), now(), now(), email
FROM auth.users
WHERE email = 'pbhavyaj992@gmail.com'
ON CONFLICT (provider, provider_id) DO NOTHING;
