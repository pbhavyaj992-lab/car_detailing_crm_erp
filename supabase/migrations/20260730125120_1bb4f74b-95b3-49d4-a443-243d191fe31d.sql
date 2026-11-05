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

-- Subscription state for the current user's company (used to lock out expired tenants)
CREATE OR REPLACE FUNCTION public.my_company_subscription()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'company_id', c.id,
    'name', c.name,
    'status', c.status,
    'plan_tier', c.plan_tier,
    'billing_cycle', c.billing_cycle,
    'subscription_ends_at', c.subscription_ends_at,
    'grace_days', c.grace_days,
    'is_active', (
      c.status IN ('active','trial')
      AND (
        c.subscription_ends_at IS NULL
        OR c.subscription_ends_at + make_interval(days => c.grace_days) > now()
      )
    )
  )
  FROM public.companies c
  WHERE c.id = public.current_company_id();
$$;