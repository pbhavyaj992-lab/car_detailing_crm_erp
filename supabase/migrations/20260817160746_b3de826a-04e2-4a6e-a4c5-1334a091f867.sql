
-- Fix search_path for tg_set_updated_at
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;

-- Revoke execute from authenticated/anon for functions that should only be run by triggers (service_role)
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' 
          AND p.prosecdef = true
          AND (p.proname LIKE 'tg_%') -- Target trigger functions
    LOOP
        -- Triggers run as the user or service_role, but trigger functions themselves
        -- usually don't need to be directly executable by users via RPC.
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated', func_record.nspname, func_record.proname, func_record.args);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', func_record.nspname, func_record.proname, func_record.args);
        -- Ensure service_role can still execute them for system operations
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', func_record.nspname, func_record.proname, func_record.args);
    END LOOP;
END $$;
