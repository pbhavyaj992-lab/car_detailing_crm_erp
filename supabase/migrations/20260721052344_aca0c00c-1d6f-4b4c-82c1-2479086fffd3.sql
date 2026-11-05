
CREATE POLICY "staff read vehicle-media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-media' AND public.current_user_is_staff());
CREATE POLICY "staff write vehicle-media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'vehicle-media' AND public.current_user_is_staff());
CREATE POLICY "staff update vehicle-media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'vehicle-media' AND public.current_user_is_staff());
CREATE POLICY "staff delete vehicle-media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'vehicle-media' AND (owner = auth.uid() OR public.current_user_can_admin()));
