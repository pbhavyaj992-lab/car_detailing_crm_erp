
-- profiles: restrict SELECT to staff (users with any role)
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by staff"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.current_user_is_staff() OR auth.uid() = id);

-- services: restrict SELECT to staff
DROP POLICY IF EXISTS "services readable" ON public.services;
CREATE POLICY "services readable by staff"
  ON public.services FOR SELECT
  TO authenticated
  USING (public.current_user_is_staff());

-- settings: restrict SELECT to staff
DROP POLICY IF EXISTS "settings readable" ON public.settings;
CREATE POLICY "settings readable by staff"
  ON public.settings FOR SELECT
  TO authenticated
  USING (public.current_user_is_staff());

-- user_roles: restrict SELECT to admins or own row
DROP POLICY IF EXISTS "user_roles readable by authenticated" ON public.user_roles;
CREATE POLICY "user_roles self or admin read"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.current_user_can_admin());

-- user_roles: only admins can insert/update/delete
CREATE POLICY "user_roles admin insert"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_can_admin());

CREATE POLICY "user_roles admin update"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.current_user_can_admin())
  WITH CHECK (public.current_user_can_admin());

CREATE POLICY "user_roles admin delete"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.current_user_can_admin());
