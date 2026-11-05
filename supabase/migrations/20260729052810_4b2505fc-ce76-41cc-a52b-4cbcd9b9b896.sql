-- Enable trigram extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. NORMALIZATION FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_phone(_p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _p IS NULL THEN NULL
    ELSE (
      WITH d AS (SELECT regexp_replace(_p, '\D', '', 'g') AS digits),
      s1 AS (SELECT CASE WHEN length(digits)=12 AND left(digits,2)='91' THEN substr(digits,3)
                        WHEN length(digits)=11 AND left(digits,1)='0' THEN substr(digits,2)
                        WHEN length(digits)>10 THEN right(digits,10)
                        ELSE digits END AS d FROM d)
      SELECT CASE WHEN length(d)=10 THEN d ELSE NULL END FROM s1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_vehicle_reg(_r text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _r IS NULL THEN NULL
              ELSE regexp_replace(upper(_r), '[^A-Z0-9]', '', 'g') END;
$$;

-- ============================================================
-- 2. NORMALIZED COLUMNS + BACKFILL
-- ============================================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS normalized_phone TEXT;
ALTER TABLE public.vehicles  ADD COLUMN IF NOT EXISTS normalized_registration TEXT;

UPDATE public.customers SET normalized_phone = public.normalize_phone(phone) WHERE normalized_phone IS NULL;
UPDATE public.vehicles  SET normalized_registration = public.normalize_vehicle_reg(number) WHERE normalized_registration IS NULL;

-- Trigger to keep them in sync
CREATE OR REPLACE FUNCTION public.tg_customers_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.normalized_phone := public.normalize_phone(NEW.phone);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_customers_normalize ON public.customers;
CREATE TRIGGER trg_customers_normalize BEFORE INSERT OR UPDATE OF phone ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_customers_normalize();

CREATE OR REPLACE FUNCTION public.tg_vehicles_normalize()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.normalized_registration := public.normalize_vehicle_reg(NEW.number);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_vehicles_normalize ON public.vehicles;
CREATE TRIGGER trg_vehicles_normalize BEFORE INSERT OR UPDATE OF number ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tg_vehicles_normalize();

-- Deduplicate any existing rows that would collide before adding UNIQUE
-- Keep the oldest per (company, normalized_phone); rename phone on later dupes to avoid data loss.
WITH dupes AS (
  SELECT id, company_id, normalized_phone,
         row_number() OVER (PARTITION BY company_id, normalized_phone ORDER BY created_at) AS rn
  FROM public.customers WHERE normalized_phone IS NOT NULL
)
UPDATE public.customers c SET normalized_phone = c.normalized_phone || '_dup' || d.rn
FROM dupes d WHERE d.id = c.id AND d.rn > 1;

WITH dupes AS (
  SELECT id, company_id, normalized_registration,
         row_number() OVER (PARTITION BY company_id, normalized_registration ORDER BY created_at) AS rn
  FROM public.vehicles WHERE normalized_registration IS NOT NULL
)
UPDATE public.vehicles v SET normalized_registration = v.normalized_registration || '_DUP' || d.rn
FROM dupes d WHERE d.id = v.id AND d.rn > 1;

-- Unique + check constraints
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_company_phone
  ON public.customers (company_id, normalized_phone) WHERE normalized_phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_company_reg
  ON public.vehicles (company_id, normalized_registration) WHERE normalized_registration IS NOT NULL;

-- ============================================================
-- 3. SOFT DELETES
-- ============================================================
DO $$
DECLARE t TEXT;
  tables TEXT[] := ARRAY['customers','vehicles','quotes','jobs','invoices','payments','expenses','media','inquiries'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id) WHERE deleted_at IS NULL',
      'idx_'||t||'_active', t);
  END LOOP;
END $$;

-- ============================================================
-- 4. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_customers_norm_phone ON public.customers (normalized_phone);
CREATE INDEX IF NOT EXISTS idx_vehicles_norm_reg    ON public.vehicles  (normalized_registration);
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm  ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicles_number_trgm ON public.vehicles  USING gin (number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_vehicles_customer   ON public.vehicles  (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer     ON public.quotes    (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_vehicle      ON public.quotes    (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status       ON public.quotes    (company_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer       ON public.jobs      (customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_vehicle        ON public.jobs      (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status         ON public.jobs      (company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer   ON public.invoices  (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job        ON public.invoices  (job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON public.invoices  (company_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice    ON public.payments  (invoice_id);
CREATE INDEX IF NOT EXISTS idx_media_vehicle       ON public.media     (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_media_job           ON public.media     (job_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote   ON public.quote_items (quote_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date       ON public.expenses  (company_id, spent_on DESC);
CREATE INDEX IF NOT EXISTS idx_customers_followup  ON public.customers (company_id, follow_up_at) WHERE follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_entity     ON public.activity_log (entity, entity_id, created_at DESC);

-- ============================================================
-- 5. FIND-OR-CREATE HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  _phone text, _name text, _email text DEFAULT NULL, _address text DEFAULT NULL, _source text DEFAULT NULL
) RETURNS public.customers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _norm text := public.normalize_phone(_phone);
  _company uuid := COALESCE(public.current_company_id(), '00000000-0000-0000-0000-000000000001');
  _row public.customers;
BEGIN
  IF _norm IS NULL THEN RAISE EXCEPTION 'Invalid phone number: %', _phone USING ERRCODE = '22023'; END IF;
  IF NOT public.current_user_is_staff() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _row FROM public.customers
   WHERE company_id = _company AND normalized_phone = _norm AND deleted_at IS NULL
   LIMIT 1;
  IF FOUND THEN RETURN _row; END IF;

  INSERT INTO public.customers(company_id, phone, name, email, address, source, created_by)
  VALUES (_company, _phone, _name, _email, _address, COALESCE(_source,'walk_in'), auth.uid())
  ON CONFLICT (company_id, normalized_phone) WHERE normalized_phone IS NOT NULL
  DO UPDATE SET name = EXCLUDED.name  -- race: another tx inserted; still return row
  RETURNING * INTO _row;
  RETURN _row;
END; $$;

CREATE OR REPLACE FUNCTION public.find_or_create_vehicle(
  _customer_id uuid, _number text, _brand text DEFAULT NULL, _model text DEFAULT NULL,
  _color text DEFAULT NULL, _fuel_type text DEFAULT NULL
) RETURNS public.vehicles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _norm text := public.normalize_vehicle_reg(_number);
  _company uuid := COALESCE(public.current_company_id(), '00000000-0000-0000-0000-000000000001');
  _row public.vehicles;
BEGIN
  IF _norm IS NULL OR length(_norm) < 4 THEN RAISE EXCEPTION 'Invalid registration: %', _number USING ERRCODE = '22023'; END IF;
  IF NOT public.current_user_is_staff() THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;

  SELECT * INTO _row FROM public.vehicles
   WHERE company_id = _company AND normalized_registration = _norm AND deleted_at IS NULL
   LIMIT 1;
  IF FOUND THEN RETURN _row; END IF;

  INSERT INTO public.vehicles(company_id, customer_id, number, brand, model, color, fuel_type)
  VALUES (_company, _customer_id, _number, _brand, _model, _color, _fuel_type)
  ON CONFLICT (company_id, normalized_registration) WHERE normalized_registration IS NOT NULL
  DO UPDATE SET brand = COALESCE(EXCLUDED.brand, public.vehicles.brand)
  RETURNING * INTO _row;
  RETURN _row;
END; $$;

-- ============================================================
-- 6. MERGE v2 (soft-delete source, full move, activity log)
-- ============================================================
DROP FUNCTION IF EXISTS public.merge_customers(uuid, uuid);
CREATE OR REPLACE FUNCTION public.merge_customers(_source uuid, _target uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _moved jsonb := '{}'::jsonb;
  _n int;
  _company uuid;
BEGIN
  IF NOT public.current_user_can_admin() THEN
    RAISE EXCEPTION 'Only admins can merge customers' USING ERRCODE = '42501';
  END IF;
  IF _source = _target THEN RAISE EXCEPTION 'Source and target must be different'; END IF;

  SELECT company_id INTO _company FROM public.customers WHERE id = _target;
  IF _company IS NULL THEN RAISE EXCEPTION 'Target customer not found'; END IF;

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
END; $$;