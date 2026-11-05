-- Enable RLS on all tables
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['companies','customers','vehicles','services','quotes','quote_items','jobs','job_status_events','invoices','invoice_items','payments','media','expenses','inquiries','activity_log','settings','user_roles','profiles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- Companies: readable by their own staff
CREATE POLICY "companies_readable_by_staff" ON public.companies
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND company_id = companies.id)
  );

-- Multi-tenant RLS helper: check if user is staff of the company
CREATE OR REPLACE FUNCTION public.is_company_staff(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND company_id = _company_id);
$$;

-- RLS for content tables
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['customers','vehicles','services','quotes','quote_items','jobs','job_status_events','invoices','invoice_items','payments','media','expenses','inquiries','activity_log','settings','user_roles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON public.%I', t);
    EXECUTE format('CREATE POLICY "tenant_isolation" ON public.%I FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id())', t);
  END LOOP;
END $$;
