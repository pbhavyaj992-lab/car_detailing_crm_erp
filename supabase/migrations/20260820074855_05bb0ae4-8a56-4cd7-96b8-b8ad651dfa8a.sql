DELETE FROM public.activity_log
WHERE entity IN ('customers','vehicles','quotes','quote_items','jobs','invoices','invoice_items','payments','inquiries','media')
  AND NOT EXISTS (SELECT 1 FROM public.customers)
  AND NOT EXISTS (SELECT 1 FROM public.invoices);