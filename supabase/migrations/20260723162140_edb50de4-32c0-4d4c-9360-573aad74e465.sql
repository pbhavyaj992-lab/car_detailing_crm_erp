
-- Idempotent policy re-apply for inquiries
DROP POLICY IF EXISTS "Anyone can submit an inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "Staff can view inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Staff can update inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Admins can delete inquiries" ON public.inquiries;

CREATE POLICY "Anyone can submit an inquiry"
  ON public.inquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff can view inquiries"
  ON public.inquiries FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "Staff can update inquiries"
  ON public.inquiries FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
CREATE POLICY "Admins can delete inquiries"
  ON public.inquiries FOR DELETE TO authenticated USING (public.current_user_can_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT INSERT ON public.inquiries TO anon;
GRANT ALL ON public.inquiries TO service_role;

-- Customer lead fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'won' CHECK (lead_status IN ('new','contacted','quote_sent','follow_up','won','lost')),
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

-- Normalise phone
UPDATE public.customers
SET phone = right(regexp_replace(phone, '\D', '', 'g'), 10)
WHERE phone IS NOT NULL
  AND phone <> right(regexp_replace(phone, '\D', '', 'g'), 10);

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON public.customers(phone) WHERE phone IS NOT NULL AND length(phone) = 10;

-- Normalise vehicle numbers
UPDATE public.vehicles
SET number = upper(regexp_replace(number, '[^A-Za-z0-9]', '', 'g'))
WHERE number IS NOT NULL
  AND number <> upper(regexp_replace(number, '[^A-Za-z0-9]', '', 'g'));

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_number_unique ON public.vehicles(number) WHERE number IS NOT NULL;

-- Merge customers RPC
CREATE OR REPLACE FUNCTION public.merge_customers(_source uuid, _target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_can_admin() THEN
    RAISE EXCEPTION 'Only admins can merge customers';
  END IF;
  IF _source = _target THEN
    RAISE EXCEPTION 'Source and target must be different';
  END IF;

  UPDATE public.vehicles  SET customer_id = _target WHERE customer_id = _source;
  UPDATE public.quotes    SET customer_id = _target WHERE customer_id = _source;
  UPDATE public.jobs      SET customer_id = _target WHERE customer_id = _source;
  UPDATE public.invoices  SET customer_id = _target WHERE customer_id = _source;
  UPDATE public.inquiries SET customer_id = _target WHERE customer_id = _source;

  DELETE FROM public.customers WHERE id = _source;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_customers(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid) TO authenticated;
