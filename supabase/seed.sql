-- Seed script for a fresh Supabase project.
-- Safe to re-run: every insert uses ON CONFLICT DO NOTHING.

-- Default company (matches the id hard-coded in triggers & handle_new_user)
INSERT INTO public.companies (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Company', 'default-company')
ON CONFLICT (id) DO NOTHING;

-- Default business settings
INSERT INTO public.settings (company_id, business_name, currency, default_tax_rate,
                             quote_prefix, job_prefix, invoice_prefix)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Company', 'INR', 18.00, 'Q', 'J', 'INV')
ON CONFLICT (company_id) DO NOTHING;

-- Starter service catalogue (rename per company after onboarding)
INSERT INTO public.services (company_id, name, price, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Standard Service',  999,  10),
  ('00000000-0000-0000-0000-000000000001', 'Premium Service',   2999, 20),
  ('00000000-0000-0000-0000-000000000001', 'Enterprise Service', 9999, 30)
ON CONFLICT DO NOTHING;
