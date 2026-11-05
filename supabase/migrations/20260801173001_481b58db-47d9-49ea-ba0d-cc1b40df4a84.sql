
-- Tenant scope helper
CREATE OR REPLACE FUNCTION public.in_my_company(_cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_is_super_admin() OR (_cid IS NOT NULL AND _cid = public.current_company_id());
$$;

CREATE OR REPLACE FUNCTION public.shares_my_company(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_is_super_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.company_id = public.current_company_id()
  );
$$;

-- COMPANIES
DROP POLICY IF EXISTS "staff read companies" ON public.companies;
CREATE POLICY "staff read own company" ON public.companies FOR SELECT TO authenticated
  USING (public.current_user_is_super_admin() OR id = public.current_company_id());
DROP POLICY IF EXISTS "admin write companies" ON public.companies;
CREATE POLICY "admin write own company" ON public.companies FOR UPDATE TO authenticated
  USING (public.current_user_can_admin() AND id = public.current_company_id())
  WITH CHECK (public.current_user_can_admin() AND id = public.current_company_id());

-- CUSTOMERS
DROP POLICY IF EXISTS "staff read customers" ON public.customers;
CREATE POLICY "staff read customers" ON public.customers FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff write customers" ON public.customers;
CREATE POLICY "staff write customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff update customers" ON public.customers;
CREATE POLICY "staff update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "admin delete customers" ON public.customers;
CREATE POLICY "admin delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id));

-- VEHICLES
DROP POLICY IF EXISTS "staff read vehicles" ON public.vehicles;
CREATE POLICY "staff read vehicles" ON public.vehicles FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff write vehicles" ON public.vehicles;
CREATE POLICY "staff write vehicles" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff update vehicles" ON public.vehicles;
CREATE POLICY "staff update vehicles" ON public.vehicles FOR UPDATE TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "admin delete vehicles" ON public.vehicles;
CREATE POLICY "admin delete vehicles" ON public.vehicles FOR DELETE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id));

-- QUOTES
DROP POLICY IF EXISTS "staff read quotes" ON public.quotes;
CREATE POLICY "staff read quotes" ON public.quotes FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff write quotes" ON public.quotes;
CREATE POLICY "staff write quotes" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff update quotes" ON public.quotes;
CREATE POLICY "staff update quotes" ON public.quotes FOR UPDATE TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "admin delete quotes" ON public.quotes;
CREATE POLICY "admin delete quotes" ON public.quotes FOR DELETE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id));

-- QUOTE ITEMS
DROP POLICY IF EXISTS "staff read quote_items" ON public.quote_items;
CREATE POLICY "staff read quote_items" ON public.quote_items FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff write quote_items" ON public.quote_items;
CREATE POLICY "staff write quote_items" ON public.quote_items FOR ALL TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));

-- JOBS
DROP POLICY IF EXISTS "staff read jobs" ON public.jobs;
CREATE POLICY "staff read jobs" ON public.jobs FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "reception+ write jobs" ON public.jobs;
CREATE POLICY "reception+ write jobs" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "reception+ update jobs" ON public.jobs;
CREATE POLICY "reception+ update jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (public.in_my_company(company_id) AND (public.current_user_can_finance() OR auth.uid() = ANY (assigned_to)))
  WITH CHECK (public.in_my_company(company_id) AND (public.current_user_can_finance() OR auth.uid() = ANY (assigned_to)));
DROP POLICY IF EXISTS "admin delete jobs" ON public.jobs;
CREATE POLICY "admin delete jobs" ON public.jobs FOR DELETE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id));

-- JOB STATUS EVENTS
DROP POLICY IF EXISTS "staff read job events" ON public.job_status_events;
CREATE POLICY "staff read job events" ON public.job_status_events FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff insert job events" ON public.job_status_events;
CREATE POLICY "staff insert job events" ON public.job_status_events FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));

-- INVOICES
DROP POLICY IF EXISTS "finance read invoices" ON public.invoices;
CREATE POLICY "finance read invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "finance write invoices" ON public.invoices;
CREATE POLICY "finance write invoices" ON public.invoices FOR ALL TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));

-- INVOICE ITEMS
DROP POLICY IF EXISTS "finance rw invoice_items" ON public.invoice_items;
CREATE POLICY "finance rw invoice_items" ON public.invoice_items FOR ALL TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));

-- PAYMENTS
DROP POLICY IF EXISTS "finance rw payments" ON public.payments;
CREATE POLICY "finance rw payments" ON public.payments FOR ALL TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));

-- EXPENSES
DROP POLICY IF EXISTS "Finance can view expenses" ON public.expenses;
CREATE POLICY "Finance can view expenses" ON public.expenses FOR SELECT TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "Finance can insert expenses" ON public.expenses;
CREATE POLICY "Finance can insert expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "Finance can update expenses" ON public.expenses;
CREATE POLICY "Finance can update expenses" ON public.expenses FOR UPDATE TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_finance() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "Finance can delete expenses" ON public.expenses;
CREATE POLICY "Finance can delete expenses" ON public.expenses FOR DELETE TO authenticated
  USING (public.current_user_can_finance() AND public.in_my_company(company_id));

-- INQUIRIES
DROP POLICY IF EXISTS "Staff can view inquiries" ON public.inquiries;
CREATE POLICY "Staff can view inquiries" ON public.inquiries FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "Staff can update inquiries" ON public.inquiries;
CREATE POLICY "Staff can update inquiries" ON public.inquiries FOR UPDATE TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "Admins can delete inquiries" ON public.inquiries;
CREATE POLICY "Admins can delete inquiries" ON public.inquiries FOR DELETE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id));

-- MEDIA
DROP POLICY IF EXISTS "staff read media" ON public.media;
CREATE POLICY "staff read media" ON public.media FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff write media" ON public.media;
CREATE POLICY "staff write media" ON public.media FOR INSERT TO authenticated
  WITH CHECK (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "staff delete own media" ON public.media;
CREATE POLICY "staff delete own media" ON public.media FOR DELETE TO authenticated
  USING (public.in_my_company(company_id) AND (uploaded_by = auth.uid() OR public.current_user_can_admin()));

-- SERVICES
DROP POLICY IF EXISTS "services readable by staff" ON public.services;
CREATE POLICY "services readable by staff" ON public.services FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "services admin write" ON public.services;
CREATE POLICY "services admin write" ON public.services FOR ALL TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_admin() AND public.in_my_company(company_id));

-- SETTINGS
DROP POLICY IF EXISTS "settings readable by staff" ON public.settings;
CREATE POLICY "settings readable by staff" ON public.settings FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "settings admin write" ON public.settings;
CREATE POLICY "settings admin write" ON public.settings FOR ALL TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_admin() AND public.in_my_company(company_id));

-- ACTIVITY LOG
DROP POLICY IF EXISTS "Staff can read activity log" ON public.activity_log;
CREATE POLICY "Staff can read activity log" ON public.activity_log FOR SELECT TO authenticated
  USING (public.current_user_is_staff() AND public.in_my_company(company_id));

-- USER ROLES
DROP POLICY IF EXISTS "user_roles self or admin read" ON public.user_roles;
CREATE POLICY "user_roles self or admin read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.current_user_can_admin() AND public.in_my_company(company_id)) OR public.current_user_is_super_admin());
DROP POLICY IF EXISTS "user_roles admin insert" ON public.user_roles;
CREATE POLICY "user_roles admin insert" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_admin() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "user_roles admin update" ON public.user_roles;
CREATE POLICY "user_roles admin update" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_admin() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "user_roles admin delete" ON public.user_roles;
CREATE POLICY "user_roles admin delete" ON public.user_roles FOR DELETE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id));

-- USER PERMISSIONS
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_permissions;
CREATE POLICY "Admins can view all permissions" ON public.user_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.current_user_can_admin() AND public.in_my_company(company_id)));
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.user_permissions;
CREATE POLICY "Admins can insert permissions" ON public.user_permissions FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_admin() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "Admins can update permissions" ON public.user_permissions;
CREATE POLICY "Admins can update permissions" ON public.user_permissions FOR UPDATE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id))
  WITH CHECK (public.current_user_can_admin() AND public.in_my_company(company_id));
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.user_permissions;
CREATE POLICY "Admins can delete permissions" ON public.user_permissions FOR DELETE TO authenticated
  USING (public.current_user_can_admin() AND public.in_my_company(company_id));

-- PROFILES (only co-workers in the same company)
DROP POLICY IF EXISTS "profiles readable by staff" ON public.profiles;
CREATE POLICY "profiles readable by same company" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR (public.current_user_is_staff() AND public.shares_my_company(id)));

-- LOGIN EVENTS
DROP POLICY IF EXISTS "View login events" ON public.login_events;
CREATE POLICY "View login events" ON public.login_events FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (public.has_any_role(auth.uid(), ARRAY['owner'::app_role,'manager'::app_role]) AND public.shares_my_company(user_id)) OR public.current_user_is_super_admin());
