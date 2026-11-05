
-- 1. Fix check_auth_rate_limit
ALTER FUNCTION public.check_auth_rate_limit(text) SET search_path = public;

-- 2. Fix other critical SECURITY DEFINER functions found in previous linter warnings
-- Enforce search_path on all functions where it might be missing
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE p.prosecdef = true AND n.nspname = 'public'
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', 
                       func_record.schema, func_record.name, func_record.args);
    END LOOP;
END $$;
