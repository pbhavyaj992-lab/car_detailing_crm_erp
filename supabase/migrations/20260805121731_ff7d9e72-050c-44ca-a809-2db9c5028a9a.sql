-- 1. Truncate all data tables with CASCADE to handle foreign keys
TRUNCATE TABLE 
    public.login_events,
    public.doc_sequences,
    public.quote_items,
    public.quotes,
    public.vehicles,
    public.customers,
    public.job_status_events,
    public.jobs,
    public.invoice_items,
    public.invoices,
    public.payments,
    public.expenses,
    public.activity_log,
    public.services,
    public.media,
    public.inquiries,
    public.company_sites,
    public.company_payments,
    public.settings,
    public.companies,
    public.user_roles,
    public.profiles,
    public.user_permissions
CASCADE;

-- 2. Create a System/Platform placeholder company to satisfy the user_roles foreign key
-- This is used for platform-level roles like Super Admin
INSERT INTO public.companies (id, name, slug, status, plan_tier)
VALUES ('00000000-0000-0000-0000-000000000000', 'Platform Administration', 'platform-admin', 'active', 'enterprise');

-- 3. Re-establish the Super Admin profile
-- UUID: c9319558-91d2-479c-8024-37116ecec7eb
INSERT INTO public.profiles (id, full_name)
VALUES ('c9319558-91d2-479c-8024-37116ecec7eb', 'Super Admin');

-- 4. Assign the Super Admin role linked to the platform company
INSERT INTO public.user_roles (user_id, role, company_id) 
VALUES ('c9319558-91d2-479c-8024-37116ecec7eb', 'super_admin', '00000000-0000-0000-0000-000000000000');
