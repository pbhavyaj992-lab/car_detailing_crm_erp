
-- Finalizing the auth trigger for reliable login
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_first boolean;
  default_company_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Ensure default company exists
  INSERT INTO public.companies (id, name, slug)
  VALUES (default_company_id, 'Default Detailing', 'default')
  ON CONFLICT (id) DO NOTHING;

  -- 1. Create Profile
  INSERT INTO public.profiles(id, full_name, phone, company_id)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), 
    NEW.raw_user_meta_data->>'phone',
    default_company_id
  )
  ON CONFLICT (id) DO UPDATE SET
    company_id = EXCLUDED.company_id
    WHERE profiles.company_id IS NULL;

  -- 2. Assign Super Admin Role if it's the first user or explicitly requested
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first OR NEW.email = 'pbhavyaj992@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role, company_id) 
    VALUES (NEW.id, 'super_admin', default_company_id)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger is active
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
