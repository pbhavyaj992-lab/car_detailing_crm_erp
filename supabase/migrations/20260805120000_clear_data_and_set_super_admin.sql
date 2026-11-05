-- Disable triggers to avoid isolation/audit log issues during wipe
SET session_replication_role = 'replica';

-- Truncate tables (order doesn't strictly matter with cascade but good practice)
TRUNCATE TABLE public.activity_log CASCADE;
TRUNCATE TABLE public.company_payments CASCADE;
TRUNCATE TABLE public.company_sites CASCADE;
TRUNCATE TABLE public.customer_vehicles CASCADE;
TRUNCATE TABLE public.follow_up_logs CASCADE;
TRUNCATE TABLE public.invoices CASCADE;
TRUNCATE TABLE public.inquiry_history CASCADE;
TRUNCATE TABLE public.inquiries CASCADE;
TRUNCATE TABLE public.job_activities CASCADE;
TRUNCATE TABLE public.job_costs CASCADE;
TRUNCATE TABLE public.job_services CASCADE;
TRUNCATE TABLE public.jobs CASCADE;
TRUNCATE TABLE public.services CASCADE;
TRUNCATE TABLE public.settings CASCADE;
TRUNCATE TABLE public.platform_thresholds CASCADE;
TRUNCATE TABLE public.usage_snapshots CASCADE;
TRUNCATE TABLE public.user_roles CASCADE;
TRUNCATE TABLE public.customers CASCADE;
TRUNCATE TABLE public.companies CASCADE;
-- Note: 'profiles' will be cleaned up by auth user deletion or manually if orphaned

-- Re-enable triggers
SET session_replication_role = 'origin';

-- Ensure the specific super admin user is correctly set up in the database.
-- We can't insert into auth.users directly via SQL safely in every environment, 
-- but we can ensure the public.user_roles reflects the target.
-- The actual auth user creation/password reset happens via server function.
