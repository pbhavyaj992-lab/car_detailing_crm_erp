-- Update delete_company_completely to cover all missing tables and fix the enquiries/inquiries typo
CREATE OR REPLACE FUNCTION public.delete_company_completely(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Check if the caller is a super admin
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Only super admins can perform this action';
    END IF;

    -- 1. Related Job/Quote data
    DELETE FROM public.expenses WHERE company_id = _company_id;
    DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE company_id = _company_id);
    DELETE FROM public.invoices WHERE company_id = _company_id;
    DELETE FROM public.job_stages WHERE job_id IN (SELECT id FROM public.jobs WHERE company_id = _company_id);
    DELETE FROM public.jobs WHERE company_id = _company_id;
    DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE company_id = _company_id);
    DELETE FROM public.quotes WHERE company_id = _company_id;
    
    -- 2. CRM and Site data (Fixing the enquiries/inquiries table name)
    DELETE FROM public.inquiries WHERE company_id = _company_id;
    DELETE FROM public.leads WHERE company_id = _company_id;
    DELETE FROM public.vehicles WHERE customer_id IN (SELECT id FROM public.customers WHERE company_id = _company_id);
    DELETE FROM public.customers WHERE company_id = _company_id;
    DELETE FROM public.company_sites WHERE company_id = _company_id;
    
    -- 3. System and Logging data
    DELETE FROM public.media WHERE company_id = _company_id;
    DELETE FROM public.activity_log WHERE company_id = _company_id;
    DELETE FROM public.doc_sequences WHERE company_id = _company_id;
    DELETE FROM public.settings WHERE company_id = _company_id;
    
    -- 4. User and Auth related
    DELETE FROM public.login_events WHERE user_id IN (SELECT id FROM public.profiles WHERE company_id = _company_id);
    DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM public.profiles WHERE company_id = _company_id);
    DELETE FROM public.profiles WHERE company_id = _company_id;
    
    -- 5. Financials
    DELETE FROM public.company_payments WHERE company_id = _company_id;

    -- 6. Finally delete the company itself
    DELETE FROM public.companies WHERE id = _company_id;
END;
$$;
