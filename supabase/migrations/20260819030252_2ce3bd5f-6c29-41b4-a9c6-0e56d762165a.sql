CREATE OR REPLACE FUNCTION public.tg_set_inquiry_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cid uuid := public.current_company_id();
BEGIN
  IF _cid IS NOT NULL THEN
    NEW.company_id := _cid;
  ELSIF NEW.company_id IS NULL THEN
    NEW.company_id := (SELECT id FROM public.companies ORDER BY created_at LIMIT 1);
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.tg_set_inquiry_company_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tr_set_inquiries_company_id ON public.inquiries;
CREATE TRIGGER tr_set_inquiries_company_id
BEFORE INSERT ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.tg_set_inquiry_company_id();