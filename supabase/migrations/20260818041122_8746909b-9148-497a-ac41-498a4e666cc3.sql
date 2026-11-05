-- 1. Create company_payments table and related subscription logic
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS plan_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_days integer NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  paid_on date NOT NULL DEFAULT current_date,
  method text,
  reference text,
  period_start date,
  period_end date,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_payments TO authenticated;
GRANT ALL ON public.company_payments TO service_role;
ALTER TABLE public.company_payments ENABLE ROW LEVEL SECURITY;

-- Helper for super admin role checks
CREATE OR REPLACE FUNCTION public.current_user_is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  );
$$;

DROP POLICY IF EXISTS "Super admins manage company payments" ON public.company_payments;
CREATE POLICY "Super admins manage company payments"
  ON public.company_payments FOR ALL TO authenticated
  USING (public.current_user_is_super_admin())
  WITH CHECK (public.current_user_is_super_admin());

DROP TRIGGER IF EXISTS trg_company_payments_updated_at ON public.company_payments;
CREATE TRIGGER trg_company_payments_updated_at
  BEFORE UPDATE ON public.company_payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_company_payments_company ON public.company_payments(company_id, paid_on DESC);

-- 2. Advanced hardening triggers and RPCs
CREATE OR REPLACE FUNCTION public.delete_company_completely(_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Only super admins can delete companies';
  END IF;

  DELETE FROM public.company_payments WHERE company_id = _company_id;
  DELETE FROM public.activity_log WHERE company_id = _company_id;
  DELETE FROM public.expenses WHERE company_id = _company_id;
  DELETE FROM public.inquiries WHERE company_id = _company_id;
  DELETE FROM public.job_status_events WHERE company_id = _company_id;
  DELETE FROM public.payments WHERE company_id = _company_id;
  DELETE FROM public.invoice_items WHERE company_id = _company_id;
  DELETE FROM public.invoices WHERE company_id = _company_id;
  DELETE FROM public.media WHERE company_id = _company_id;
  DELETE FROM public.jobs WHERE company_id = _company_id;
  DELETE FROM public.quote_items WHERE company_id = _company_id;
  DELETE FROM public.quotes WHERE company_id = _company_id;
  DELETE FROM public.vehicles WHERE company_id = _company_id;
  DELETE FROM public.customers WHERE company_id = _company_id;
  DELETE FROM public.services WHERE company_id = _company_id;
  DELETE FROM public.settings WHERE company_id = _company_id;
  DELETE FROM public.user_roles WHERE company_id = _company_id;
  DELETE FROM public.doc_sequences WHERE company_id = _company_id;
  DELETE FROM public.companies WHERE id = _company_id;
END; $$;

-- 3. Final Security Hardening
-- Revoke all on functions to prevent direct execution by anon
DO $$
DECLARE
  func_record RECORD;
BEGIN
  FOR func_record IN
    SELECT n.nspname as schema, p.proname as name
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I FROM public', func_record.name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO authenticated', func_record.name);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I TO service_role', func_record.name);
  END LOOP;
END $$;
