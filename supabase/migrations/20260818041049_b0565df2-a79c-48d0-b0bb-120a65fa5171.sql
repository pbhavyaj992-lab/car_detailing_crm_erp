-- Drop existing doc_sequences numbering trigger and replace with multi-tenant one
DROP TRIGGER IF EXISTS trg_quotes_number ON public.quotes;
DROP TRIGGER IF EXISTS trg_jobs_number ON public.jobs;
DROP TRIGGER IF EXISTS trg_invoices_number ON public.invoices;

CREATE OR REPLACE FUNCTION public.tg_quotes_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT quote_prefix INTO _prefix FROM public.settings WHERE company_id = NEW.company_id;
    NEW.number := public.next_doc_number('quote', COALESCE(_prefix,'Q'));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_jobs_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT job_prefix INTO _prefix FROM public.settings WHERE company_id = NEW.company_id;
    NEW.number := public.next_doc_number('job', COALESCE(_prefix,'J'));
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tg_invoices_set_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _prefix text;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT invoice_prefix INTO _prefix FROM public.settings WHERE company_id = NEW.company_id;
    NEW.number := public.next_doc_number('invoice', COALESCE(_prefix,'INV'));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_quotes_number BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.tg_quotes_set_number();
CREATE TRIGGER trg_jobs_number BEFORE INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.tg_jobs_set_number();
CREATE TRIGGER trg_invoices_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_invoices_set_number();

-- Seed some basic data for the default company
INSERT INTO public.services(company_id, name, price, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Exterior Wash', 500, 1),
  ('00000000-0000-0000-0000-000000000001', 'Interior Cleaning', 800, 2),
  ('00000000-0000-0000-0000-000000000001', 'Wax Polish', 1500, 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.settings(company_id, business_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Coating Buddies')
ON CONFLICT (company_id) DO NOTHING;
