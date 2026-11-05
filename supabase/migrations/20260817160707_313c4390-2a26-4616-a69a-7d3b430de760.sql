
-- 1. Fix RLS Disabled in Public
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_logs ENABLE ROW LEVEL SECURITY;

-- 2. Add policies for tables with RLS enabled but no policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own company') THEN
        CREATE POLICY "Users can view their own company" ON public.companies
            FOR SELECT TO authenticated USING (id = public.current_company_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Restrict doc_sequences to authenticated') THEN
        CREATE POLICY "Restrict doc_sequences to authenticated" ON public.doc_sequences
            FOR ALL TO authenticated USING (false);
    END IF;

    -- auth_attempts
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Restrict auth_attempts to service_role') THEN
        CREATE POLICY "Restrict auth_attempts to service_role" ON public.auth_attempts
            FOR ALL TO service_role USING (true);
    END IF;

    -- trigger_logs
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can view trigger logs') THEN
        CREATE POLICY "Admins can view trigger logs" ON public.trigger_logs
            FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
    END IF;
END $$;

-- 3. Fix SECURITY DEFINER execution permissions
-- Revoke PUBLIC execute and grant back to authenticated/service_role
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.prosecdef = true
    LOOP
        EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC', func_record.nspname, func_record.proname, func_record.args);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', func_record.nspname, func_record.proname, func_record.args);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', func_record.nspname, func_record.proname, func_record.args);
    END LOOP;
END $$;
