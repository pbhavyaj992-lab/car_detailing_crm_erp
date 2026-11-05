CREATE TABLE public.platform_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    seats integer NOT NULL DEFAULT 5,
    features text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- GRANT permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_plans TO authenticated;
GRANT ALL ON public.platform_plans TO service_role;

-- Enable RLS
ALTER TABLE public.platform_plans ENABLE ROW LEVEL SECURITY;

-- Policies: only super admins can manage plans, all authenticated users can read them
CREATE POLICY "Super admins can manage platform plans"
ON public.platform_plans
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "All authenticated users can see platform plans"
ON public.platform_plans
FOR SELECT
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_platform_plans_updated
    BEFORE UPDATE ON public.platform_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Seed initial 4 packs
INSERT INTO public.platform_plans (name, price, seats, features) VALUES
('Starter', 999, 5, 'Basic CRM, Invoicing'),
('Growth', 2499, 15, 'Advanced Analytics, Team Roles'),
('Pro', 4999, 50, 'Multi-location, API Access'),
('Enterprise', 9999, 999, 'Custom Branding, Dedicated Support');
