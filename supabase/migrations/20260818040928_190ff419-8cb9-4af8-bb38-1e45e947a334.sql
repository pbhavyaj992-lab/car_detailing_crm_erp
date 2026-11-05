DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['job_status_events','invoices','invoice_items','payments','media'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT', t);
    EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT %L', t, '00000000-0000-0000-0000-000000000001');
  END LOOP;
END $$;
