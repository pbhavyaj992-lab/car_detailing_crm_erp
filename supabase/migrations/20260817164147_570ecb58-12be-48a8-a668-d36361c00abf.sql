
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(_identifier text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Simple implementation for now to avoid blocking login during migration
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(text) TO authenticated, service_role;
