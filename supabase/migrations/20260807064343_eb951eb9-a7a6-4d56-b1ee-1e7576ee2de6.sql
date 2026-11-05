ALTER POLICY "View login events" ON public.login_events USING (
  (user_id = auth.uid()) OR 
  (has_any_role(auth.uid(), ARRAY['owner'::app_role, 'admin'::app_role, 'manager'::app_role]) AND shares_my_company(user_id)) OR 
  current_user_is_super_admin()
);