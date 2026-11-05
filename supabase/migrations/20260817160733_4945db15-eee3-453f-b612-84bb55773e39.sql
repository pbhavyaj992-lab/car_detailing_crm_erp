
-- Manually revoke execute from PUBLIC for problematic functions
-- Supabase linter flags these because PUBLIC includes 'anon'

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
          AND has_function_privilege('anon', p.oid, 'execute') = true
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', func_record.nspname, func_record.proname, func_record.args);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', func_record.nspname, func_record.proname, func_record.args);
        
        -- Keep authenticated access if it's meant to be used by the app
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', func_record.nspname, func_record.proname, func_record.args);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', func_record.nspname, func_record.proname, func_record.args);
    END LOOP;
END $$;
