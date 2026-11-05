-- 1. PAYMENT VALIDATION -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_payments_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _inv public.invoices;
  _paid numeric;
  _due numeric;
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero' USING ERRCODE = '22023';
  END IF;

  -- Lock the invoice so concurrent payments cannot overshoot the total.
  SELECT * INTO _inv FROM public.invoices WHERE id = NEW.invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found' USING ERRCODE = '22023';
  END IF;
  IF _inv.status = 'cancelled' THEN
    RAISE EXCEPTION 'This invoice is cancelled and cannot accept payments' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO _paid
  FROM public.payments p
  WHERE p.invoice_id = NEW.invoice_id
    AND (TG_OP = 'INSERT' OR p.id <> NEW.id);

  _due := ROUND(COALESCE(_inv.total,0) - _paid - COALESCE(_inv.adjustment_amount,0), 2);

  IF _due <= 0 THEN
    RAISE EXCEPTION 'This invoice is already settled — no balance remaining' USING ERRCODE = '22023';
  END IF;

  IF ROUND(NEW.amount, 2) > _due + 0.009 THEN
    RAISE EXCEPTION 'Payment exceeds the remaining balance of %', to_char(_due, 'FM999999990.00')
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_validate ON public.payments;
CREATE TRIGGER trg_payments_validate
BEFORE INSERT OR UPDATE OF amount, invoice_id ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.tg_payments_validate();

-- 2. SUSPENDED BUSINESS ENFORCEMENT -----------------------------------------
CREATE OR REPLACE FUNCTION public.is_company_active(_cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = _cid
      AND c.status IN ('active','trial')
      AND (
        COALESCE(c.subscription_ends_at, c.trial_ends_at) IS NULL
        OR COALESCE(c.subscription_ends_at, c.trial_ends_at)
             + (COALESCE(c.grace_days,3) || ' days')::interval >= now()
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.tg_require_active_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cid uuid;
BEGIN
  IF public.current_user_is_super_admin() THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  _cid := COALESCE(public.current_company_id(),
                   CASE WHEN TG_OP = 'DELETE' THEN OLD.company_id ELSE NEW.company_id END);
  IF _cid IS NOT NULL AND NOT public.is_company_active(_cid) THEN
    RAISE EXCEPTION 'Your business subscription is inactive. Contact the platform administrator to restore access.'
      USING ERRCODE = '42501';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','vehicles','inquiries','quotes','quote_items','jobs',
                           'invoices','invoice_items','payments','expenses','services','media','settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_active_company ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_active_company BEFORE INSERT OR UPDATE OR DELETE ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.tg_require_active_company()', t);
  END LOOP;
END $$;

-- 3. ACTIVITY LOG: tenant read access ---------------------------------------
DROP POLICY IF EXISTS "Staff read own company activity" ON public.activity_log;
CREATE POLICY "Staff read own company activity" ON public.activity_log
FOR SELECT TO authenticated
USING (public.current_user_is_super_admin() OR public.in_my_company(company_id));

-- 4. ACTIVITY LOGGING TRIGGERS ----------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_write_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entity text := TG_TABLE_NAME;
  _row jsonb;
  _old jsonb;
  _changes jsonb := '{}'::jsonb;
  _action text;
  _actor text;
  _k text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _row := to_jsonb(OLD); _action := 'delete';
  ELSIF TG_OP = 'INSERT' THEN
    _row := to_jsonb(NEW); _action := 'create';
  ELSE
    _row := to_jsonb(NEW); _old := to_jsonb(OLD); _action := 'update';
    FOR _k IN SELECT jsonb_object_keys(_row) LOOP
      IF _k NOT IN ('updated_at','created_at')
         AND _row->_k IS DISTINCT FROM _old->_k THEN
        _changes := _changes || jsonb_build_object(_k, jsonb_build_object('from', _old->_k, 'to', _row->_k));
      END IF;
    END LOOP;
    IF _changes = '{}'::jsonb THEN RETURN NEW; END IF;
  END IF;

  SELECT full_name INTO _actor FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.activity_log(company_id, entity, entity_id, action, summary, changes, actor_id, actor_name)
  VALUES (
    (_row->>'company_id')::uuid,
    _entity,
    NULLIF(_row->>'id','')::uuid,
    _action,
    initcap(_action) || ' ' || _entity,
    CASE WHEN _action = 'update' THEN _changes ELSE NULL END,
    auth.uid(),
    _actor
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['customers','vehicles','inquiries','quotes','jobs','invoices','payments','expenses','services']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_activity ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER trg_%1$s_activity AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity()', t);
  END LOOP;
END $$;

-- 5. PLATFORM STATS CONTRACT -------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v json;
BEGIN
  IF NOT public.current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'companies_total', (SELECT count(*) FROM public.companies),
    'companies_active', (SELECT count(*) FROM public.companies c WHERE public.is_company_active(c.id)),
    'companies_suspended', (SELECT count(*) FROM public.companies WHERE status IN ('suspended','cancelled')),
    'users_total', (SELECT count(DISTINCT user_id) FROM public.user_roles),
    'customers_total', (SELECT count(*) FROM public.customers WHERE deleted_at IS NULL),
    'jobs_total', (SELECT count(*) FROM public.jobs WHERE deleted_at IS NULL),
    'jobs_open', (SELECT count(*) FROM public.jobs WHERE deleted_at IS NULL AND status <> 'delivered'),
    'invoices_total', (SELECT count(*) FROM public.invoices WHERE deleted_at IS NULL),
    'revenue_total', (SELECT COALESCE(SUM(amount),0) FROM public.payments),
    'signups_30d', (SELECT count(*) FROM public.companies WHERE created_at >= now() - interval '30 days'),
    'per_company', COALESCE((
      SELECT json_agg(x ORDER BY x.name)
      FROM (
        SELECT c.id, c.name,
          (SELECT count(DISTINCT ur.user_id) FROM public.user_roles ur WHERE ur.company_id = c.id) AS users,
          (SELECT count(*) FROM public.customers cu WHERE cu.company_id = c.id AND cu.deleted_at IS NULL) AS customers,
          (SELECT count(*) FROM public.jobs j WHERE j.company_id = c.id AND j.deleted_at IS NULL) AS jobs,
          (SELECT COALESCE(SUM(p.amount),0) FROM public.payments p WHERE p.company_id = c.id) AS revenue
        FROM public.companies c
      ) x
    ), '[]'::json)
  ) INTO v;
  RETURN v;
END;
$$;