-- Ensure RLS is enabled on all critical tables
DO $$ 
DECLARE 
    tbl RECORD;
BEGIN 
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('companies', 'inquiries', 'inventory', 'expenses', 'activity_log', 'customers', 'vehicles', 'user_roles')
    LOOP 
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl.tablename);
    END LOOP;
END $$;

-- Drop existing role check function to ensure it's up to date
DROP FUNCTION IF EXISTS public.has_role(_user_id uuid, _role app_role);

-- Re-create the security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    from public.user_roles
    where user_id = _user_id
      AND role = _role
  )
$$;

-- Grant access to user_roles
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- Example of tightening a policy: Ensure only super_admins can see all companies
DROP POLICY IF EXISTS "Super admins can manage all companies" ON public.companies;
CREATE POLICY "Super admins can manage all companies"
ON public.companies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'));
