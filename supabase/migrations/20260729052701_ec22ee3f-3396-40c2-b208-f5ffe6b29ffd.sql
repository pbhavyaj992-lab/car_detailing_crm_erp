-- 1. Companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read companies" ON public.companies FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "admin write companies" ON public.companies FOR ALL TO authenticated USING (public.current_user_can_admin()) WITH CHECK (public.current_user_can_admin());
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.companies (id, name, slug) VALUES ('00000000-0000-0000-0000-000000000001', 'Coating Buddies', 'coating-buddies');

-- 2. Add company_id everywhere
DO $$
DECLARE
  t TEXT;
  has_created BOOLEAN;
  tables TEXT[] := ARRAY['customers','vehicles','quotes','quote_items','jobs','job_status_events',
    'invoices','invoice_items','payments','media','expenses','inquiries','activity_log',
    'services','user_roles','user_permissions','settings','doc_sequences'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE RESTRICT', t);
    EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN company_id SET DEFAULT %L', t, '00000000-0000-0000-0000-000000000001');

    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='created_at') INTO has_created;
    IF has_created THEN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id, created_at DESC)',
        'idx_'||t||'_company_created', t);
    ELSE
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)',
        'idx_'||t||'_company', t);
    END IF;
  END LOOP;
END $$;

-- 3. Composite uniques scoped by company
ALTER TABLE public.doc_sequences DROP CONSTRAINT IF EXISTS doc_sequences_pkey;
ALTER TABLE public.doc_sequences DROP CONSTRAINT IF EXISTS doc_sequences_kind_year_key;
ALTER TABLE public.doc_sequences ADD PRIMARY KEY (company_id, kind, year);

ALTER TABLE public.quotes   DROP CONSTRAINT IF EXISTS quotes_number_key;
ALTER TABLE public.jobs     DROP CONSTRAINT IF EXISTS jobs_number_key;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_quotes_company_number   ON public.quotes   (company_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_company_number     ON public.jobs     (company_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_company_number ON public.invoices (company_id, number);

ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE public.settings ADD PRIMARY KEY (company_id);
ALTER TABLE public.settings ALTER COLUMN id DROP NOT NULL;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_company_user_role_key UNIQUE (company_id, user_id, role);

-- 4. Company helper
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 5. Per-company doc numbers
CREATE OR REPLACE FUNCTION public.next_doc_number(_kind text, _prefix text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _year int := extract(year from now())::int;
  _company uuid := COALESCE(public.current_company_id(), '00000000-0000-0000-0000-000000000001');
  _n int;
BEGIN
  INSERT INTO public.doc_sequences(company_id, kind, year, last_no)
  VALUES (_company, _kind, _year, 1)
  ON CONFLICT (company_id, kind, year)
  DO UPDATE SET last_no = public.doc_sequences.last_no + 1
  RETURNING last_no INTO _n;
  RETURN _prefix || '-' || _year || '-' || lpad(_n::text, 4, '0');
END; $$;

-- 6. Auto-set company_id on insert
CREATE OR REPLACE FUNCTION public.tg_set_company_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(public.current_company_id(), '00000000-0000-0000-0000-000000000001');
  END IF;
  RETURN NEW;
END; $$;

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['customers','vehicles','quotes','quote_items','jobs','job_status_events',
    'invoices','invoice_items','payments','media','expenses','inquiries','activity_log','services'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_set_company ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_set_company BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id()', t, t);
  END LOOP;
END $$;

-- 7. handle_new_user attaches role to default company
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
  _company uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles(company_id, user_id, role) VALUES (_company, NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END; $$;