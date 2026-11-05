
CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  ip_address text,
  user_agent text,
  device_type text,
  browser text,
  os text,
  country text,
  region text,
  city text,
  latitude numeric,
  longitude numeric,
  event_type text NOT NULL DEFAULT 'sign_in',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own login events
CREATE POLICY "Users insert own login events" ON public.login_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can see their own events; admins/owners/managers see all
CREATE POLICY "View login events" ON public.login_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['super_admin','owner','manager']::app_role[])
  );

CREATE INDEX login_events_created_at_idx ON public.login_events (created_at DESC);
CREATE INDEX login_events_user_id_idx ON public.login_events (user_id);
