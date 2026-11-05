
-- 1) Activity log table
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,           -- e.g. 'quote', 'invoice', 'job', ...
  entity_id uuid,                 -- primary key of the affected row (if any)
  parent_entity text,             -- for line items etc. (e.g. 'quote' for a quote_item)
  parent_id uuid,
  action text NOT NULL,           -- 'create' | 'update' | 'delete'
  summary text,                   -- human-readable summary
  changes jsonb,                  -- {field: {from, to}}
  actor_id uuid,                  -- auth.uid() at time of change
  actor_name text,                -- snapshot of profiles.full_name
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_entity_idx ON public.activity_log (entity, entity_id, created_at DESC);
CREATE INDEX activity_log_parent_idx ON public.activity_log (parent_entity, parent_id, created_at DESC);
CREATE INDEX activity_log_created_idx ON public.activity_log (created_at DESC);

GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read activity log"
  ON public.activity_log FOR SELECT TO authenticated
  USING (public.current_user_is_staff());

-- No INSERT/UPDATE/DELETE policies: only SECURITY DEFINER triggers write.

-- 2) Generic logger trigger function
CREATE OR REPLACE FUNCTION public.tg_write_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity        text := TG_ARGV[0];
  v_parent_entity text := COALESCE(TG_ARGV[1], NULL);
  v_parent_col    text := COALESCE(TG_ARGV[2], NULL);
  v_action        text;
  v_id            uuid;
  v_parent_id     uuid;
  v_actor         uuid := auth.uid();
  v_actor_name    text;
  v_summary       text;
  v_changes       jsonb := '{}'::jsonb;
  v_old           jsonb;
  v_new           jsonb;
  v_key           text;
  v_ignored       text[] := ARRAY['updated_at','created_at','id'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_new := to_jsonb(NEW);
    v_id := (v_new->>'id')::uuid;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id := (v_new->>'id')::uuid;
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key = ANY(v_ignored) THEN CONTINUE; END IF;
      IF (v_old->v_key) IS DISTINCT FROM (v_new->v_key) THEN
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('from', v_old->v_key, 'to', v_new->v_key));
      END IF;
    END LOOP;
    -- Skip no-op updates (e.g. only updated_at changed)
    IF v_changes = '{}'::jsonb THEN
      RETURN NEW;
    END IF;
  ELSE -- DELETE
    v_action := 'delete';
    v_old := to_jsonb(OLD);
    v_id := (v_old->>'id')::uuid;
  END IF;

  IF v_parent_col IS NOT NULL THEN
    v_parent_id := (COALESCE(v_new, v_old)->>v_parent_col)::uuid;
  END IF;

  IF v_actor IS NOT NULL THEN
    SELECT full_name INTO v_actor_name FROM public.profiles WHERE id = v_actor;
  END IF;

  -- Build short summary
  IF v_action = 'create' THEN
    v_summary := 'Created ' || v_entity ||
      COALESCE(' ' || (v_new->>'number'), '') ||
      COALESCE(' — ' || (v_new->>'name'), '') ||
      COALESCE(' (' || (v_new->>'status') || ')', '');
  ELSIF v_action = 'update' THEN
    v_summary := 'Updated ' || v_entity ||
      COALESCE(' ' || (v_new->>'number'), '') ||
      ': ' || array_to_string(ARRAY(SELECT jsonb_object_keys(v_changes)), ', ');
  ELSE
    v_summary := 'Deleted ' || v_entity ||
      COALESCE(' ' || (v_old->>'number'), '') ||
      COALESCE(' — ' || (v_old->>'name'), '');
  END IF;

  INSERT INTO public.activity_log(entity, entity_id, parent_entity, parent_id, action, summary, changes, actor_id, actor_name)
  VALUES (v_entity, v_id, v_parent_entity, v_parent_id, v_action, v_summary, v_changes, v_actor, v_actor_name);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3) Attach triggers to core tables
CREATE TRIGGER trg_activity_customers
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('customer');

CREATE TRIGGER trg_activity_vehicles
  AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('vehicle');

CREATE TRIGGER trg_activity_services
  AFTER INSERT OR UPDATE OR DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('service');

CREATE TRIGGER trg_activity_quotes
  AFTER INSERT OR UPDATE OR DELETE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('quote');

CREATE TRIGGER trg_activity_quote_items
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('quote_item', 'quote', 'quote_id');

CREATE TRIGGER trg_activity_jobs
  AFTER INSERT OR UPDATE OR DELETE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('job');

CREATE TRIGGER trg_activity_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('invoice');

CREATE TRIGGER trg_activity_invoice_items
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('invoice_item', 'invoice', 'invoice_id');

CREATE TRIGGER trg_activity_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('payment', 'invoice', 'invoice_id');
