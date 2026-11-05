CREATE TABLE public.platform_thresholds (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  rows_warn integer NOT NULL DEFAULT 8000,
  rows_critical integer NOT NULL DEFAULT 15000,
  files_warn integer NOT NULL DEFAULT 500,
  files_critical integer NOT NULL DEFAULT 1000,
  seats_warn_pct integer NOT NULL DEFAULT 90,
  seats_critical_pct integer NOT NULL DEFAULT 100,
  activity_warn integer NOT NULL DEFAULT 20000,
  activity_critical integer NOT NULL DEFAULT 50000,
  inactive_days integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.platform_thresholds TO authenticated;
GRANT ALL ON public.platform_thresholds TO service_role;

ALTER TABLE public.platform_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admin reads thresholds" ON public.platform_thresholds
  FOR SELECT TO authenticated USING (public.current_user_is_super_admin());
CREATE POLICY "super admin inserts thresholds" ON public.platform_thresholds
  FOR INSERT TO authenticated WITH CHECK (public.current_user_is_super_admin());
CREATE POLICY "super admin updates thresholds" ON public.platform_thresholds
  FOR UPDATE TO authenticated USING (public.current_user_is_super_admin()) WITH CHECK (public.current_user_is_super_admin());

INSERT INTO public.platform_thresholds (id) VALUES (true) ON CONFLICT DO NOTHING;