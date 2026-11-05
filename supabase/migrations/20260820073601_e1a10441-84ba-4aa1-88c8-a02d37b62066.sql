REVOKE ALL ON FUNCTION public.tg_payments_validate() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_require_active_company() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_write_activity() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_company_active(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_company_active(uuid) TO authenticated;