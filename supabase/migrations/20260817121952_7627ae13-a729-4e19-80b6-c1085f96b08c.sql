-- ============ BATCH 2: CORE MODULES (MEDIA, ACTIVITY, PERMISSIONS, EXPENSES) ============

-- 1. MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  stage public.media_stage NOT NULL,
  kind public.media_kind NOT NULL DEFAULT 'photo',
  storage_path text NOT NULL,
  mime text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_vehicle ON public.media (vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media TO authenticated;
GRANT ALL ON public.media TO service_role;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff read media" ON public.media; CREATE POLICY "staff read media" ON public.media FOR SELECT TO authenticated USING (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff write media" ON public.media; CREATE POLICY "staff write media" ON public.media FOR INSERT TO authenticated WITH CHECK (public.current_user_is_staff());
DROP POLICY IF EXISTS "staff delete own media" ON public.media; CREATE POLICY "staff delete own media" ON public.media FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.current_user_can_admin());

-- 2. ACTIVITY LOG
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL,
  entity_id uuid,
  parent_entity text,
  parent_id uuid,
  action text NOT NULL,
  summary text,
  changes jsonb,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log (entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_parent_idx ON public.activity_log (parent_entity, parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_created_idx ON public.activity_log (created_at DESC);
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Staff can read activity log" ON public.activity_log; CREATE POLICY "Staff can read activity log" ON public.activity_log FOR SELECT TO authenticated USING (public.current_user_is_staff());

-- 3. ACTIVITY TRIGGER FUNCTION
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
    IF v_changes = '{}'::jsonb THEN RETURN NEW; END IF;
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

  IF v_action = 'create' THEN
    v_summary := 'Created ' || v_entity || COALESCE(' ' || (v_new->>'number'), '') || COALESCE(' — ' || (v_new->>'name'), '');
  ELSIF v_action = 'update' THEN
    v_summary := 'Updated ' || v_entity || COALESCE(' ' || (v_new->>'number'), '') || ': ' || array_to_string(ARRAY(SELECT jsonb_object_keys(v_changes)), ', ');
  ELSE
    v_summary := 'Deleted ' || v_entity || COALESCE(' ' || (v_old->>'number'), '') || COALESCE(' — ' || (v_old->>'name'), '');
  END IF;

  INSERT INTO public.activity_log(entity, entity_id, parent_entity, parent_id, action, summary, changes, actor_id, actor_name)
  VALUES (v_entity, v_id, v_parent_entity, v_parent_id, v_action, v_summary, v_changes, v_actor, v_actor_name);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ATTACH ACTIVITY TRIGGERS
DROP TRIGGER IF EXISTS trg_activity_customers ON public.customers;
CREATE TRIGGER trg_activity_customers AFTER INSERT OR UPDATE OR DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('customer');
DROP TRIGGER IF EXISTS trg_activity_vehicles ON public.vehicles;
CREATE TRIGGER trg_activity_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('vehicle');

-- 4. USER PERMISSIONS
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all permissions" ON public.user_permissions; CREATE POLICY "Admins can view all permissions" ON public.user_permissions FOR SELECT TO authenticated USING (public.current_user_can_admin() OR user_id = auth.uid());
DROP POLICY IF EXISTS "Admins can insert permissions" ON public.user_permissions; CREATE POLICY "Admins can insert permissions" ON public.user_permissions FOR INSERT TO authenticated WITH CHECK (public.current_user_can_admin());
DROP POLICY IF EXISTS "Admins can update permissions" ON public.user_permissions; CREATE POLICY "Admins can update permissions" ON public.user_permissions FOR UPDATE TO authenticated USING (public.current_user_can_admin()) WITH CHECK (public.current_user_can_admin());
DROP POLICY IF EXISTS "Admins can delete permissions" ON public.user_permissions; CREATE POLICY "Admins can delete permissions" ON public.user_permissions FOR DELETE TO authenticated USING (public.current_user_can_admin());
DROP TRIGGER IF EXISTS user_permissions_set_updated_at ON public.user_permissions;
CREATE TRIGGER user_permissions_set_updated_at BEFORE UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 5. EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spent_on date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  vendor text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  notes text,
  bill_path text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Finance can view expenses" ON public.expenses; CREATE POLICY "Finance can view expenses" ON public.expenses FOR SELECT TO authenticated USING (public.current_user_can_finance());
DROP POLICY IF EXISTS "Finance can insert expenses" ON public.expenses; CREATE POLICY "Finance can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.current_user_can_finance());
DROP POLICY IF EXISTS "Finance can update expenses" ON public.expenses; CREATE POLICY "Finance can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());
DROP POLICY IF EXISTS "Finance can delete expenses" ON public.expenses; CREATE POLICY "Finance can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (public.current_user_can_finance());
DROP TRIGGER IF EXISTS expenses_set_updated_at ON public.expenses;
CREATE TRIGGER expenses_set_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS expenses_activity ON public.expenses;
CREATE TRIGGER expenses_activity AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('expense');
