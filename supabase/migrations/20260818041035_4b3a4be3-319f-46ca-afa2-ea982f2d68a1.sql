-- Ensure profile exists
INSERT INTO public.profiles (id, full_name)
VALUES ('06243e6e-b225-448e-8eb6-849cc39f0408', 'Master Admin')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Ensure super_admin role in default company
INSERT INTO public.user_roles (company_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', '06243e6e-b225-448e-8eb6-849cc39f0408', 'super_admin')
ON CONFLICT (company_id, user_id, role) DO NOTHING;

-- Also update the handle_new_user trigger to be multi-tenant aware if it isn't already
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first boolean;
  default_cid uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    INSERT INTO public.user_roles(company_id, user_id, role) VALUES (default_cid, NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END; $$;
