CREATE OR REPLACE FUNCTION public.can_manage_company_logo(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.current_user_is_super_admin()
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.companies c ON c.id = ur.company_id
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin', 'owner')
          AND split_part(_object_name, '/', 1) = c.slug
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_company_logo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_company_logo(text) TO authenticated, service_role;

DROP POLICY IF EXISTS company_logos_insert ON storage.objects;
DROP POLICY IF EXISTS company_logos_update ON storage.objects;
DROP POLICY IF EXISTS company_logos_delete ON storage.objects;

CREATE POLICY company_logos_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND public.can_manage_company_logo(name)
);

CREATE POLICY company_logos_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND public.can_manage_company_logo(name)
)
WITH CHECK (
  bucket_id = 'company-logos'
  AND public.can_manage_company_logo(name)
);

CREATE POLICY company_logos_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND public.can_manage_company_logo(name)
);