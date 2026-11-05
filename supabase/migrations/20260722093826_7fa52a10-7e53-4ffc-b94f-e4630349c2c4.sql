CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all permissions"
  ON public.user_permissions FOR SELECT TO authenticated
  USING (public.current_user_can_admin() OR user_id = auth.uid());

CREATE POLICY "Admins can insert permissions"
  ON public.user_permissions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_admin());

CREATE POLICY "Admins can update permissions"
  ON public.user_permissions FOR UPDATE TO authenticated
  USING (public.current_user_can_admin())
  WITH CHECK (public.current_user_can_admin());

CREATE POLICY "Admins can delete permissions"
  ON public.user_permissions FOR DELETE TO authenticated
  USING (public.current_user_can_admin());

CREATE TRIGGER user_permissions_set_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();