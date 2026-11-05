CREATE TABLE public.company_sites (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  business_name text NOT NULL,
  logo_url text,
  tagline text,
  hero_headline text,
  hero_subtext text,
  about text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  state text,
  map_url text,
  opening_hours text,
  seo_title text,
  seo_description text,
  seo_keywords text,
  custom_domain text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.company_sites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_sites TO authenticated;
GRANT ALL ON public.company_sites TO service_role;

ALTER TABLE public.company_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view enabled sites"
  ON public.company_sites FOR SELECT
  TO anon, authenticated
  USING (enabled = true);

CREATE POLICY "Staff can view their own site"
  ON public.company_sites FOR SELECT
  TO authenticated
  USING (public.in_my_company(company_id));

CREATE POLICY "Admins can create their own site"
  ON public.company_sites FOR INSERT
  TO authenticated
  WITH CHECK (public.in_my_company(company_id) AND (public.current_user_can_admin() OR public.current_user_is_super_admin()));

CREATE POLICY "Admins can update their own site"
  ON public.company_sites FOR UPDATE
  TO authenticated
  USING (public.in_my_company(company_id) AND (public.current_user_can_admin() OR public.current_user_is_super_admin()))
  WITH CHECK (public.in_my_company(company_id) AND (public.current_user_can_admin() OR public.current_user_is_super_admin()));

CREATE POLICY "Super admin can delete sites"
  ON public.company_sites FOR DELETE
  TO authenticated
  USING (public.current_user_is_super_admin());

CREATE TRIGGER trg_company_sites_updated_at
  BEFORE UPDATE ON public.company_sites
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Backfill one website record per existing business.
INSERT INTO public.company_sites (
  company_id, slug, enabled, business_name, logo_url, phone, email, address
)
SELECT
  c.id,
  c.slug,
  true,
  COALESCE(s.business_name, c.name),
  c.logo_url,
  COALESCE(s.phone, c.contact_phone),
  COALESCE(s.email, c.contact_email),
  COALESCE(s.address, c.address)
FROM public.companies c
LEFT JOIN public.settings s ON s.company_id = c.id
ON CONFLICT (company_id) DO NOTHING;

-- Visitors may read the price list of a business whose website is live.
GRANT SELECT ON public.services TO anon;

CREATE POLICY "Public can view services of live sites"
  ON public.services FOR SELECT
  TO anon
  USING (
    active = true
    AND EXISTS (
      SELECT 1 FROM public.company_sites cs
      WHERE cs.company_id = services.company_id AND cs.enabled = true
    )
  );