CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

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
    'invoices','invoice_items','payments','media','expenses','inquiries','activity_log','services','user_roles','user_permissions','settings','doc_sequences','profiles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_set_company ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_set_company BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id()', t, t);
  END LOOP;
END $$;