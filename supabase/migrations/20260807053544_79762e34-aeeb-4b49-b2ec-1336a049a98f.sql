-- Add feature flag to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS public_site_enabled BOOLEAN DEFAULT FALSE;

-- Grant access to authenticated users (so admins can see it)
GRANT SELECT, UPDATE ON public.companies TO authenticated;

-- Function to check if a site is public
CREATE OR REPLACE FUNCTION public.is_site_public(company_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT public_site_enabled 
  FROM public.companies 
  WHERE slug = company_slug 
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_site_public(TEXT) TO anon, authenticated;