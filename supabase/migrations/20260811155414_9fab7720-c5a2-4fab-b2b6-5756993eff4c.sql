-- SECURITY AUDIT: FIXING LINTER FINDINGS

-- 1. Enable RLS on auth_attempts (found missing in linter)
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
-- No user should be able to see or edit auth_attempts directly via API
-- Only service_role needs access which is granted by default to admin functions

-- 2. Secure SECURITY DEFINER functions (Revoke public access & set search_path)

-- check_auth_rate_limit
REVOKE EXECUTE ON FUNCTION public.check_auth_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(text, int, int) TO authenticated, service_role;

-- has_role (already exists but ensuring it is secure)
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- check_subscription_active
ALTER FUNCTION public.check_subscription_active() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.check_subscription_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_subscription_active() TO authenticated, service_role;

-- find_or_create_customer
ALTER FUNCTION public.find_or_create_customer(text, text, text, text, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.find_or_create_customer(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_customer(text, text, text, text, text) TO authenticated, service_role;

-- find_or_create_vehicle
ALTER FUNCTION public.find_or_create_vehicle(uuid, text, text, text, text, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.find_or_create_vehicle(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_vehicle(uuid, text, text, text, text, text) TO authenticated, service_role;

-- 3. Cleanup old auth_attempts (Optional housekeeping trigger)
CREATE OR REPLACE FUNCTION public.cleanup_old_auth_attempts()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.auth_attempts WHERE created_at < now() - interval '24 hours';
END;
$$;
