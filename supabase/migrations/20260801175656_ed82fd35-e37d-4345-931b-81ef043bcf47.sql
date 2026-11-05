CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles(id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'pbhavyaj992@gmail.com' THEN
    INSERT INTO public.user_roles(company_id, user_id, role)
    VALUES (_company, NEW.id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;