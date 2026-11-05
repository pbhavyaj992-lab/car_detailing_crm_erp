-- WARNING 6: Fix search_path for all SECURITY DEFINER functions explicitly

ALTER FUNCTION public.tg_payments_recalc() SET search_path = public;
ALTER FUNCTION public.enforce_single_super_admin() SET search_path = public;
ALTER FUNCTION public.platform_stats() SET search_path = public;
ALTER FUNCTION public.tg_invoices_set_number() SET search_path = public;
ALTER FUNCTION public.tg_set_company_id() SET search_path = public;
ALTER FUNCTION public.tg_jobs_set_number() SET search_path = public;
ALTER FUNCTION public.tg_jobs_log_status() SET search_path = public;
ALTER FUNCTION public.has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION public.in_my_company(uuid) SET search_path = public;
ALTER FUNCTION public.shares_my_company(uuid) SET search_path = public;
ALTER FUNCTION public.current_company_id() SET search_path = public;
ALTER FUNCTION public.current_user_can_admin() SET search_path = public;
ALTER FUNCTION public.merge_customers(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.tg_quotes_set_number() SET search_path = public;
ALTER FUNCTION public.delete_company_completely(uuid) SET search_path = public;
ALTER FUNCTION public.current_user_is_staff() SET search_path = public;
ALTER FUNCTION public.has_any_role(uuid, app_role[]) SET search_path = public;
ALTER FUNCTION public.current_user_can_finance() SET search_path = public;
ALTER FUNCTION public.find_or_create_vehicle(uuid, text, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.check_subscription_active() SET search_path = public;
ALTER FUNCTION public.check_auth_rate_limit(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.next_doc_number(text, text) SET search_path = public;
ALTER FUNCTION public.find_or_create_customer(text, text, text, text, text) SET search_path = public;
ALTER FUNCTION public.current_user_is_super_admin() SET search_path = public;
ALTER FUNCTION public.my_company_subscription() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.tg_write_activity() SET search_path = public;

-- Final cleanup: revoke public execute from ALL objects in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM public;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM public;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM public;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM public;

-- Restore essential permissions for authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Special cases for anon
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(text, integer, integer) TO anon;
GRANT INSERT ON public.inquiries TO anon;
GRANT SELECT ON public.companies TO anon; -- Needed for login screens/branding sometimes
