
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_staff() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_finance() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_doc_number(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_finance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_admin() TO authenticated;
ALTER FUNCTION public.tg_set_updated_at() SET search_path = public;
