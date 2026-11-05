-- Migration: Final Production Security Hardening
-- Distinguishes Platform Super Admin from Tenant roles and enforces strict isolation

-- 1. Authorization Helpers
CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  );
$$;

-- Standardize current_user_is_super_admin to use the same logic
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_super_admin();
$$;

-- Helper to check if a user is the owner of their company
CREATE OR REPLACE FUNCTION public.current_user_is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
    AND company_id = public.current_company_id()
  );
$$;

-- 2. Fix delete_company_completely RPC (Authorization & Safety)
CREATE OR REPLACE FUNCTION public.delete_company_completely(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- CRITICAL FIX: Only Platform Super Admin can execute this
    IF NOT public.is_platform_super_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Platform Super Admins can delete companies.' USING ERRCODE = '42501';
    END IF;

    -- Safety check: ensure _company_id is valid
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id) THEN
        RAISE EXCEPTION 'Invalid company ID.' USING ERRCODE = 'P0002';
    END IF;

    -- Cascading deletes
    DELETE FROM public.expenses WHERE company_id = _company_id;
    DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE company_id = _company_id);
    DELETE FROM public.invoices WHERE company_id = _company_id;
    DELETE FROM public.job_status_events WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = _company_id);
    DELETE FROM public.jobs WHERE company_id = _company_id;
    DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE company_id = _company_id);
    DELETE FROM public.quotes WHERE company_id = _company_id;
    DELETE FROM public.inquiries WHERE company_id = _company_id;
    DELETE FROM public.vehicles WHERE customer_id IN (SELECT id FROM public.customers WHERE company_id = _company_id);
    DELETE FROM public.customers WHERE company_id = _company_id;
    DELETE FROM public.media WHERE company_id = _company_id;
    DELETE FROM public.activity_log WHERE company_id = _company_id;
    DELETE FROM public.doc_sequences WHERE company_id = _company_id;
    DELETE FROM public.settings WHERE company_id = _company_id;
    DELETE FROM public.login_events WHERE user_id IN (SELECT id FROM public.profiles p JOIN public.user_roles ur ON p.id = ur.user_id WHERE ur.company_id = _company_id);
    DELETE FROM public.user_roles WHERE company_id = _company_id;
    DELETE FROM public.profiles WHERE id NOT IN (SELECT user_id FROM public.user_roles);
    DELETE FROM public.company_payments WHERE company_id = _company_id;
    DELETE FROM public.companies WHERE id = _company_id;
END;
$$;

-- 3. Storage Security - Strict Isolation with Super Admin Bypass

-- expense-bills
DROP POLICY IF EXISTS "Finance can view expense bills" ON storage.objects;
CREATE POLICY "Finance can view expense bills" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'expense-bills' AND (
        public.is_platform_super_admin() OR (
            public.current_user_can_finance() AND EXISTS (
                SELECT 1 FROM public.expenses e 
                WHERE e.bill_path = name 
                AND e.company_id = public.current_company_id()
            )
        )
    )
);

DROP POLICY IF EXISTS "Finance can upload expense bills" ON storage.objects;
CREATE POLICY "Finance can upload expense bills" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'expense-bills' AND (
        public.is_platform_super_admin() OR 
        public.current_user_can_finance()
    )
);

DROP POLICY IF EXISTS "Finance can update expense bills" ON storage.objects;
CREATE POLICY "Finance can update expense bills" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'expense-bills' AND (
        public.is_platform_super_admin() OR (
            public.current_user_can_finance() AND EXISTS (
                SELECT 1 FROM public.expenses e 
                WHERE e.bill_path = name 
                AND e.company_id = public.current_company_id()
            )
        )
    )
);

DROP POLICY IF EXISTS "Finance can delete expense bills" ON storage.objects;
CREATE POLICY "Finance can delete expense bills" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'expense-bills' AND (
        public.is_platform_super_admin() OR (
            public.current_user_can_finance() AND EXISTS (
                SELECT 1 FROM public.expenses e 
                WHERE e.bill_path = name 
                AND e.company_id = public.current_company_id()
            )
        )
    )
);

-- vehicle-media
DROP POLICY IF EXISTS "staff read vehicle-media" ON storage.objects;
CREATE POLICY "staff read vehicle-media" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'vehicle-media' AND (
        public.is_platform_super_admin() OR (
            public.current_user_is_staff() AND EXISTS (
                SELECT 1 FROM public.media m 
                WHERE m.storage_path = name 
                AND m.company_id = public.current_company_id()
            )
        )
    )
);

DROP POLICY IF EXISTS "staff write vehicle-media" ON storage.objects;
CREATE POLICY "staff write vehicle-media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'vehicle-media' AND (
        public.is_platform_super_admin() OR 
        public.current_user_is_staff()
    )
);

DROP POLICY IF EXISTS "staff update vehicle-media" ON storage.objects;
CREATE POLICY "staff update vehicle-media" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'vehicle-media' AND (
        public.is_platform_super_admin() OR (
            public.current_user_is_staff() AND EXISTS (
                SELECT 1 FROM public.media m 
                WHERE m.storage_path = name 
                AND m.company_id = public.current_company_id()
            )
        )
    )
);

DROP POLICY IF EXISTS "staff delete vehicle-media" ON storage.objects;
CREATE POLICY "staff delete vehicle-media" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'vehicle-media' AND (
        public.is_platform_super_admin() OR (
            (public.current_user_can_admin() OR (owner = auth.uid())) AND EXISTS (
                SELECT 1 FROM public.media m 
                WHERE m.storage_path = name 
                AND m.company_id = public.current_company_id()
            )
        )
    )
);

-- company-logos
DROP POLICY IF EXISTS "staff read company-logos" ON storage.objects;
CREATE POLICY "staff read company-logos" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'company-logos' AND (
        public.is_platform_super_admin() OR (
            public.current_user_is_staff() AND (
                name LIKE (public.current_company_id()::text || '/%')
                OR 
                EXISTS (SELECT 1 FROM public.companies WHERE (logo_url LIKE ('%' || name) OR logo_url = name) AND id = public.current_company_id())
            )
        )
    )
);

DROP POLICY IF EXISTS "admin upload company-logos" ON storage.objects;
CREATE POLICY "admin upload company-logos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'company-logos' AND (
        public.is_platform_super_admin() OR 
        public.current_user_can_admin()
    )
);

DROP POLICY IF EXISTS "admin update company-logos" ON storage.objects;
CREATE POLICY "admin update company-logos" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'company-logos' AND (
        public.is_platform_super_admin() OR (
            public.current_user_can_admin() AND (
                name LIKE (public.current_company_id()::text || '/%')
                OR 
                EXISTS (SELECT 1 FROM public.companies WHERE (logo_url LIKE ('%' || name) OR logo_url = name) AND id = public.current_company_id())
            )
        )
    )
);

DROP POLICY IF EXISTS "admin delete company-logos" ON storage.objects;
CREATE POLICY "admin delete company-logos" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'company-logos' AND (
        public.is_platform_super_admin() OR (
            public.current_user_can_admin() AND (
                name LIKE (public.current_company_id()::text || '/%')
                OR 
                EXISTS (SELECT 1 FROM public.companies WHERE (logo_url LIKE ('%' || name) OR logo_url = name) AND id = public.current_company_id())
            )
        )
    )
);

-- 4. Fix subscription_write_enforcement (Allow Super Admin)
DO $$
DECLARE
    tbl_name text;
BEGIN
    FOR tbl_name IN SELECT unnest(ARRAY['quotes', 'jobs', 'invoices', 'payments', 'expenses'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS subscription_write_enforcement ON public.%I', tbl_name);
        EXECUTE format('CREATE POLICY subscription_write_enforcement ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin() OR public.check_subscription_active())', tbl_name);
    END LOOP;
END $$;

-- 5. Final Search Path Verification
ALTER FUNCTION public.is_platform_super_admin() SET search_path = public;
ALTER FUNCTION public.current_user_is_owner() SET search_path = public;
