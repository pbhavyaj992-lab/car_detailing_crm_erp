CREATE TABLE public.activity_log (
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
CREATE INDEX activity_log_entity_idx ON public.activity_log (entity, entity_id, created_at DESC);
CREATE INDEX activity_log_parent_idx ON public.activity_log (parent_entity, parent_id, created_at DESC);
CREATE INDEX activity_log_created_idx ON public.activity_log (created_at DESC);
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read activity log" ON public.activity_log FOR SELECT TO authenticated USING (public.current_user_is_staff());

CREATE TABLE public.user_permissions (
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
CREATE POLICY "Admins can view all permissions" ON public.user_permissions FOR SELECT TO authenticated USING (public.current_user_can_admin() OR user_id = auth.uid());
CREATE POLICY "Admins can insert permissions" ON public.user_permissions FOR INSERT TO authenticated WITH CHECK (public.current_user_can_admin());
CREATE POLICY "Admins can update permissions" ON public.user_permissions FOR UPDATE TO authenticated USING (public.current_user_can_admin()) WITH CHECK (public.current_user_can_admin());
CREATE POLICY "Admins can delete permissions" ON public.user_permissions FOR DELETE TO authenticated USING (public.current_user_can_admin());
CREATE TRIGGER user_permissions_set_updated_at BEFORE UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.expenses (
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
CREATE POLICY "Finance can view expenses" ON public.expenses FOR SELECT TO authenticated USING (public.current_user_can_finance());
CREATE POLICY "Finance can insert expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.current_user_can_finance());
CREATE POLICY "Finance can update expenses" ON public.expenses FOR UPDATE TO authenticated USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());
CREATE POLICY "Finance can delete expenses" ON public.expenses FOR DELETE TO authenticated USING (public.current_user_can_finance());
CREATE INDEX expenses_spent_on_idx ON public.expenses (spent_on DESC);
CREATE INDEX expenses_category_idx ON public.expenses (category);
CREATE TRIGGER expenses_set_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  vehicle text,
  service text,
  message text,
  source text NOT NULL DEFAULT 'website',
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  contacted_at timestamptz,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.inquiries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit an inquiry" ON public.inquiries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff can view inquiries" ON public.inquiries FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE POLICY "Staff can update inquiries" ON public.inquiries FOR UPDATE TO authenticated USING (public.current_user_is_staff()) WITH CHECK (public.current_user_is_staff());
CREATE POLICY "Admins can delete inquiries" ON public.inquiries FOR DELETE TO authenticated USING (public.current_user_can_admin());
CREATE TRIGGER inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan_tier text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  logo_url text,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  notes text,
  seats integer NOT NULL DEFAULT 5,
  trial_ends_at timestamptz,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read companies" ON public.companies FOR SELECT TO authenticated USING (public.current_user_is_staff());
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.companies (id, name, slug) VALUES ('00000000-0000-0000-0000-000000000001', 'Coating Buddies', 'coating-buddies');
