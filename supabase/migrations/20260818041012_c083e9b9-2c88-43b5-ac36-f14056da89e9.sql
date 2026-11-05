DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['customers','vehicles','services','quotes','quote_items','jobs','job_status_events','invoices','invoice_items','payments','media','expenses','inquiries','activity_log'];
BEGIN
  -- 1. Ensure company_id exists and is seeded on all content tables
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT', t);
    EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT %L', t, '00000000-0000-0000-0000-000000000001');
  END LOOP;

  -- 2. Update doc_sequences to multi-tenant
  -- Drop existing primary key if it exists
  ALTER TABLE public.doc_sequences DROP CONSTRAINT IF EXISTS doc_sequences_pkey;
  ALTER TABLE public.doc_sequences ADD COLUMN IF NOT EXISTS company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.companies(id);
  ALTER TABLE public.doc_sequences ADD PRIMARY KEY (company_id, kind, year);

  -- 3. Update settings to multi-tenant
  ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
  ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.companies(id);
  ALTER TABLE public.settings ADD PRIMARY KEY (company_id);
  -- Remove the singleton constraint since it's now per-company
  ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_id_check;

  -- 4. Update user_roles to multi-tenant
  ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS company_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001' REFERENCES public.companies(id);
  ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_user_role_key UNIQUE (company_id, user_id, role);

  -- 5. Multi-tenant unique indexes for numbering
  CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_company_number   ON public.quotes   (company_id, number);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_company_number     ON public.jobs     (company_id, number);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_company_number ON public.invoices (company_id, number);

END $$;

-- 6. Multi-tenant helpers
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.next_doc_number(_kind text, _prefix text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year int := extract(year from now())::int;
  _n int;
  _company uuid := COALESCE(public.current_company_id(), '00000000-0000-0000-0000-000000000001');
BEGIN
  INSERT INTO public.doc_sequences(company_id, kind, year, last_no)
  VALUES (_company, _kind, _year, 1)
  ON CONFLICT (company_id, kind, year) DO UPDATE SET last_no = public.doc_sequences.last_no + 1
  RETURNING last_no INTO _n;
  RETURN _prefix || '-' || _year || '-' || lpad(_n::text, 4, '0');
END; $$;

-- 7. Auto-set company_id trigger
CREATE OR REPLACE FUNCTION public.tg_set_company_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  RETURN NEW;
END; $$;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['customers','vehicles','services','quotes','quote_items','jobs','job_status_events','invoices','invoice_items','payments','media','expenses','inquiries','activity_log','settings','user_roles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_company_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_company_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id()', t);
  END LOOP;
END $$;
