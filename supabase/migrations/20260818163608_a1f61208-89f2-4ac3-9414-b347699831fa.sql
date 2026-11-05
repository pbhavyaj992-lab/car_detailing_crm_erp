REVOKE ALL ON FUNCTION public.my_company_subscription() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.my_company_subscription() TO authenticated;