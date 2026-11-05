
-- 1. Extend customers with lead fields
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS lead_status text NOT NULL DEFAULT 'won',
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz;

-- 2. Signature on invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

-- 3. Follow-up on quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS follow_up_at timestamptz;

-- 4. Inquiries table (public form on the website)
CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  vehicle text,
  service text,
  message text,
  source text NOT NULL DEFAULT 'website',
  status text NOT NULL DEFAULT 'new', -- new, contacted, quote_sent, follow_up, won, lost
  assigned_to uuid,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contacted_at timestamptz,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.inquiries TO anon;  -- Not needed but harmless; overridden by policy
REVOKE SELECT ON public.inquiries FROM anon;
GRANT INSERT ON public.inquiries TO anon;   -- Public form submissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an inquiry"
  ON public.inquiries FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view inquiries"
  ON public.inquiries FOR SELECT TO authenticated
  USING (public.current_user_is_staff());

CREATE POLICY "Staff can update inquiries"
  ON public.inquiries FOR UPDATE TO authenticated
  USING (public.current_user_is_staff())
  WITH CHECK (public.current_user_is_staff());

CREATE POLICY "Admins can delete inquiries"
  ON public.inquiries FOR DELETE TO authenticated
  USING (public.current_user_can_admin());

CREATE TRIGGER inquiries_updated_at BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER inquiries_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('inquiry');

CREATE INDEX IF NOT EXISTS inquiries_status_idx ON public.inquiries(status);
CREATE INDEX IF NOT EXISTS inquiries_created_idx ON public.inquiries(created_at DESC);

-- 5. Signatures storage bucket policies (bucket will be created via tool)
--    We'll add object policies after bucket creation.

-- 6. Merge duplicate customers (admin only)
CREATE OR REPLACE FUNCTION public.merge_customers(_source uuid, _target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.current_user_can_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _source = _target THEN
    RAISE EXCEPTION 'Cannot merge a customer into itself';
  END IF;

  UPDATE public.vehicles   SET customer_id = _target WHERE customer_id = _source;
  UPDATE public.quotes     SET customer_id = _target WHERE customer_id = _source;
  UPDATE public.jobs       SET customer_id = _target WHERE customer_id = _source;
  UPDATE public.invoices   SET customer_id = _target WHERE customer_id = _source;
  UPDATE public.inquiries  SET customer_id = _target WHERE customer_id = _source;

  DELETE FROM public.customers WHERE id = _source;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_customers(uuid,uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid,uuid) TO authenticated;
