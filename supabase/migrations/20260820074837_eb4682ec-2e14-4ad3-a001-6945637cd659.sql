DO $$
DECLARE
  v_cust uuid;
BEGIN
  SELECT id INTO v_cust FROM public.customers WHERE normalized_phone = '9998887771' LIMIT 1;
  IF v_cust IS NOT NULL THEN
    DELETE FROM public.payments WHERE invoice_id IN (SELECT id FROM public.invoices WHERE customer_id = v_cust);
    DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM public.invoices WHERE customer_id = v_cust);
    DELETE FROM public.activity_log WHERE entity_id IN (SELECT id FROM public.invoices WHERE customer_id = v_cust)
      OR parent_id IN (SELECT id FROM public.invoices WHERE customer_id = v_cust);
    DELETE FROM public.invoices WHERE customer_id = v_cust;
    DELETE FROM public.job_status_events WHERE job_id IN (SELECT id FROM public.jobs WHERE customer_id = v_cust);
    DELETE FROM public.activity_log WHERE entity_id IN (SELECT id FROM public.jobs WHERE customer_id = v_cust)
      OR parent_id IN (SELECT id FROM public.jobs WHERE customer_id = v_cust);
    DELETE FROM public.jobs WHERE customer_id = v_cust;
    DELETE FROM public.quote_items WHERE quote_id IN (SELECT id FROM public.quotes WHERE customer_id = v_cust);
    DELETE FROM public.activity_log WHERE entity_id IN (SELECT id FROM public.quotes WHERE customer_id = v_cust)
      OR parent_id IN (SELECT id FROM public.quotes WHERE customer_id = v_cust);
    DELETE FROM public.quotes WHERE customer_id = v_cust;
    DELETE FROM public.media WHERE customer_id = v_cust;
    DELETE FROM public.activity_log WHERE entity_id IN (SELECT id FROM public.vehicles WHERE customer_id = v_cust);
    DELETE FROM public.vehicles WHERE customer_id = v_cust;
    DELETE FROM public.activity_log WHERE entity_id = v_cust;
    DELETE FROM public.customers WHERE id = v_cust;
  END IF;
END $$;

DELETE FROM public.activity_log
WHERE entity = 'inquiries'
  AND entity_id IN (SELECT id FROM public.inquiries WHERE name ILIKE 'Automated Test Lead%' OR name ILIKE 'QA Test Lead%');

DELETE FROM public.inquiries
WHERE name ILIKE 'Automated Test Lead%' OR name ILIKE 'QA Test Lead%';