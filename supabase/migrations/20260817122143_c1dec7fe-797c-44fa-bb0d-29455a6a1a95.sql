-- ============ BATCH 6 (RETRY): MISSING COLUMNS AND FINAL RLS ============

-- 1. FIX INVOICES
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS adjustment_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total numeric(12,2) NOT NULL DEFAULT 0;

-- 2. FIX CUSTOMERS
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS normalized_phone text;

-- 3. FIX VEHICLES
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS normalized_registration text;

-- 4. FIX COMPANY PAYMENTS
ALTER TABLE public.company_payments ADD COLUMN IF NOT EXISTS period_start timestamptz;
ALTER TABLE public.company_payments ADD COLUMN IF NOT EXISTS period_end timestamptz;

-- 5. ENSURE company_id ON inquiries
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 6. TENANT ISOLATION POLICIES (Sequential for safety)
DROP POLICY IF EXISTS "Tenant isolation" ON public.customers;
CREATE POLICY "Tenant isolation" ON public.customers FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Tenant isolation" ON public.vehicles;
CREATE POLICY "Tenant isolation" ON public.vehicles FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Tenant isolation" ON public.quotes;
CREATE POLICY "Tenant isolation" ON public.quotes FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Tenant isolation" ON public.jobs;
CREATE POLICY "Tenant isolation" ON public.jobs FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Tenant isolation" ON public.invoices;
CREATE POLICY "Tenant isolation" ON public.invoices FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Tenant isolation" ON public.inquiries;
CREATE POLICY "Tenant isolation" ON public.inquiries FOR ALL TO authenticated USING (company_id = public.current_company_id()) WITH CHECK (company_id = public.current_company_id());

-- 7. ROLE MAPPING
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
