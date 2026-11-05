-- 1. Consolidate policies for inquiries to prevent conflicts
DROP POLICY IF EXISTS "Users can view their own company inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can insert inquiries for their own company" ON public.inquiries;
DROP POLICY IF EXISTS "Users can update inquiries for their own company" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries read own company" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries update own company" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries public submit" ON public.inquiries;
DROP POLICY IF EXISTS "inquiries admin delete" ON public.inquiries;
DROP POLICY IF EXISTS "Anyone can submit an inquiry" ON public.inquiries;
DROP POLICY IF EXISTS "Staff can view inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Staff can update inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Admins can delete inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Tenant isolation" ON public.inquiries;

-- 2. Create clean, isolated policies
-- Allow everyone to submit a lead (even anonymously from a website)
CREATE POLICY "inquiries_insert_policy" ON public.inquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Allow authenticated users to view only their own company's leads
CREATE POLICY "inquiries_select_policy" ON public.inquiries
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.current_company_id()));

-- Allow authenticated users to update only their own company's leads
CREATE POLICY "inquiries_update_policy" ON public.inquiries
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT public.current_company_id()))
  WITH CHECK (company_id = (SELECT public.current_company_id()));

-- Allow admins to delete leads from their own company
CREATE POLICY "inquiries_delete_policy" ON public.inquiries
  FOR DELETE TO authenticated
  USING (company_id = (SELECT public.current_company_id()) AND (SELECT public.current_user_can_admin()));

-- 3. Ensure the company_id trigger is active and correct
DROP TRIGGER IF EXISTS tr_set_inquiries_company_id ON public.inquiries;
CREATE TRIGGER tr_set_inquiries_company_id
BEFORE INSERT ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();
