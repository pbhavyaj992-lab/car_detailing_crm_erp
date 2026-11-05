CREATE OR REPLACE FUNCTION public.enforce_single_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _owner_email constant text := 'pbhavyaj992@gmail.com';
BEGIN
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.role = 'super_admin' THEN
    SELECT lower(email) INTO _email FROM auth.users WHERE id = NEW.user_id;
    IF _email IS DISTINCT FROM _owner_email THEN
      RAISE EXCEPTION 'Super admin role is reserved for the platform owner account'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE','DELETE') AND OLD.role = 'super_admin' THEN
    SELECT lower(email) INTO _email FROM auth.users WHERE id = OLD.user_id;
    IF _email = _owner_email AND (TG_OP = 'DELETE' OR NEW.role <> 'super_admin') THEN
      RAISE EXCEPTION 'The platform owner super admin role cannot be removed'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DELETE FROM public.user_roles ur
WHERE ur.role = 'super_admin'
  AND lower((SELECT u.email FROM auth.users u WHERE u.id = ur.user_id)) IS DISTINCT FROM 'pbhavyaj992@gmail.com';

DROP TRIGGER IF EXISTS trg_enforce_single_super_admin ON public.user_roles;
CREATE TRIGGER trg_enforce_single_super_admin
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_super_admin();