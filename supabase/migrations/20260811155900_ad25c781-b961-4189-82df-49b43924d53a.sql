-- Fix check_subscription_active to NOT return true for null company
CREATE OR REPLACE FUNCTION public.check_subscription_active()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _company uuid := public.current_company_id();
  _status text;
  _ends_at timestamptz;
  _grace int;
BEGIN
  -- CRITICAL FIX: Return FALSE if no company context, effectively blocking anon inserts
  IF _company IS NULL THEN 
    RETURN false; 
  END IF;

  -- Super admins can do anything
  IF public.has_role(auth.uid(), 'super_admin') THEN 
    RETURN true; 
  END IF;

  SELECT status, subscription_ends_at, grace_days INTO _status, _ends_at, _grace
  FROM public.companies WHERE id = _company;

  -- Handle case where company record is not found (shouldn't happen for valid users)
  IF NOT FOUND THEN 
    RETURN false; 
  END IF;

  IF _status IN ('suspended', 'cancelled') THEN
    RAISE EXCEPTION 'Your subscription is inactive. Please renew your plan to continue.' USING ERRCODE = '42501';
  END IF;

  IF _ends_at IS NOT NULL AND (now() > (_ends_at + (COALESCE(_grace, 0) || ' days')::interval)) THEN
    RAISE EXCEPTION 'Your subscription has expired. Please renew your plan to continue.' USING ERRCODE = '42501';
  END IF;

  RETURN true;
END;
$$;

-- Restrict subscription_write_enforcement to authenticated users only
ALTER POLICY "subscription_write_enforcement" ON public.expenses TO authenticated;
ALTER POLICY "subscription_write_enforcement" ON public.inquiries TO authenticated;
ALTER POLICY "subscription_write_enforcement" ON public.invoices TO authenticated;
ALTER POLICY "subscription_write_enforcement" ON public.jobs TO authenticated;
ALTER POLICY "subscription_write_enforcement" ON public.payments TO authenticated;
ALTER POLICY "subscription_write_enforcement" ON public.quotes TO authenticated;

-- Fix Storage Policies (Cross-Tenant Isolation)

-- expense-bills
DROP POLICY IF EXISTS "Finance can view expense bills" ON storage.objects;
CREATE POLICY "Finance can view expense bills" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'expense-bills' AND 
  current_user_can_finance() AND
  EXISTS (SELECT 1 FROM public.expenses e WHERE e.bill_path = name AND in_my_company(e.company_id))
);

DROP POLICY IF EXISTS "Finance can upload expense bills" ON storage.objects;
CREATE POLICY "Finance can upload expense bills" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'expense-bills' AND 
  current_user_can_finance()
);

DROP POLICY IF EXISTS "Finance can update expense bills" ON storage.objects;
CREATE POLICY "Finance can update expense bills" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'expense-bills' AND 
  current_user_can_finance() AND
  EXISTS (SELECT 1 FROM public.expenses e WHERE e.bill_path = name AND in_my_company(e.company_id))
);

DROP POLICY IF EXISTS "Finance can delete expense bills" ON storage.objects;
CREATE POLICY "Finance can delete expense bills" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'expense-bills' AND 
  current_user_can_finance() AND
  EXISTS (SELECT 1 FROM public.expenses e WHERE e.bill_path = name AND in_my_company(e.company_id))
);

-- vehicle-media
DROP POLICY IF EXISTS "staff read vehicle-media" ON storage.objects;
DROP POLICY IF EXISTS "staff read vehicle-media-isolation" ON storage.objects;
CREATE POLICY "staff read vehicle-media" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-media' AND 
  current_user_is_staff() AND
  EXISTS (SELECT 1 FROM public.media m WHERE m.storage_path = name AND in_my_company(m.company_id))
);

DROP POLICY IF EXISTS "staff write vehicle-media" ON storage.objects;
CREATE POLICY "staff write vehicle-media" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-media' AND 
  current_user_is_staff()
);

DROP POLICY IF EXISTS "staff update vehicle-media" ON storage.objects;
CREATE POLICY "staff update vehicle-media" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicle-media' AND 
  current_user_is_staff() AND
  EXISTS (SELECT 1 FROM public.media m WHERE m.storage_path = name AND in_my_company(m.company_id))
);

DROP POLICY IF EXISTS "staff delete vehicle-media" ON storage.objects;
CREATE POLICY "staff delete vehicle-media" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-media' AND 
  (current_user_can_admin() OR owner = auth.uid()) AND
  EXISTS (SELECT 1 FROM public.media m WHERE m.storage_path = name AND in_my_company(m.company_id))
);

-- company-logos
DROP POLICY IF EXISTS "staff read company-logos" ON storage.objects;
CREATE POLICY "staff read company-logos" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'company-logos' AND 
  (current_user_is_super_admin() OR current_user_is_staff())
);

DROP POLICY IF EXISTS "admin upload company-logos" ON storage.objects;
CREATE POLICY "admin upload company-logos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' AND 
  (current_user_can_admin() OR current_user_is_super_admin())
);

DROP POLICY IF EXISTS "admin update company-logos" ON storage.objects;
CREATE POLICY "admin update company-logos" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-logos' AND 
  (current_user_can_admin() OR current_user_is_super_admin())
);

DROP POLICY IF EXISTS "admin delete company-logos" ON storage.objects;
CREATE POLICY "admin delete company-logos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'company-logos' AND 
  (current_user_can_admin() OR current_user_is_super_admin())
);

-- WARNING 4, 5, 6: Revoke public execute, fix search_path

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM public;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(text, integer, integer) TO anon;

-- Ensure RLS on doc_sequences
ALTER TABLE public.doc_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read sequences" ON public.doc_sequences;
CREATE POLICY "staff read sequences" ON public.doc_sequences FOR SELECT TO authenticated USING (in_my_company(company_id));
DROP POLICY IF EXISTS "staff write sequences" ON public.doc_sequences;
CREATE POLICY "staff write sequences" ON public.doc_sequences FOR ALL TO authenticated USING (in_my_company(company_id));
