
CREATE OR REPLACE FUNCTION public.merge_customers(_source uuid, _target uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _moved jsonb := '{}'::jsonb;
  _n int;
  _company uuid;
  _src_company uuid;
BEGIN
  IF NOT public.current_user_can_admin() THEN
    RAISE EXCEPTION 'Only admins can merge customers' USING ERRCODE = '42501';
  END IF;
  IF _source = _target THEN RAISE EXCEPTION 'Source and target must be different'; END IF;

  SELECT company_id INTO _company FROM public.customers WHERE id = _target;
  SELECT company_id INTO _src_company FROM public.customers WHERE id = _source;
  IF _company IS NULL OR _src_company IS NULL THEN RAISE EXCEPTION 'Customer not found'; END IF;
  IF _company <> _src_company THEN
    RAISE EXCEPTION 'Cannot merge customers from different businesses' USING ERRCODE = '42501';
  END IF;
  IF NOT public.in_my_company(_company) THEN
    RAISE EXCEPTION 'Not authorized for this business' USING ERRCODE = '42501';
  END IF;

  UPDATE public.vehicles  SET customer_id = _target WHERE customer_id = _source;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('vehicles', _n);
  UPDATE public.quotes    SET customer_id = _target WHERE customer_id = _source;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('quotes', _n);
  UPDATE public.jobs      SET customer_id = _target WHERE customer_id = _source;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('jobs', _n);
  UPDATE public.invoices  SET customer_id = _target WHERE customer_id = _source;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('invoices', _n);
  UPDATE public.inquiries SET customer_id = _target WHERE customer_id = _source;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('inquiries', _n);
  UPDATE public.media     SET customer_id = _target WHERE customer_id = _source;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('media', _n);
  UPDATE public.activity_log SET entity_id = _target
    WHERE entity = 'customer' AND entity_id = _source;
  GET DIAGNOSTICS _n = ROW_COUNT; _moved := _moved || jsonb_build_object('activity', _n);

  UPDATE public.customers SET deleted_at = now(),
    normalized_phone = normalized_phone || '_merged' || extract(epoch from now())::bigint
    WHERE id = _source;

  INSERT INTO public.activity_log(company_id, entity, entity_id, action, summary, changes, actor_id)
  VALUES (_company, 'customer', _target, 'merge',
    'Merged duplicate customer into this record',
    jsonb_build_object('source', _source, 'target', _target, 'moved', _moved),
    auth.uid());

  RETURN _moved;
END; $function$;

-- Lock down direct RPC access for anonymous callers
REVOKE EXECUTE ON FUNCTION public.merge_customers(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_or_create_customer(text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_or_create_vehicle(uuid, text, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.platform_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_company_subscription() FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_doc_number(text, text) FROM anon;
