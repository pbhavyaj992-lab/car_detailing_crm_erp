-- SECURITY HARDENING: RATE LIMITING & STORAGE POLICIES

-- 1. Rate Limiting Support for Auth (Server-side tracking)
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier text NOT NULL,
    ip_address text,
    created_at timestamptz DEFAULT now()
);

-- Index for efficient cleanup and lookup
CREATE INDEX IF NOT EXISTS idx_auth_attempts_identifier_created ON public.auth_attempts(identifier, created_at);

-- Grant access for the has_role security-definer function usage (called via server functions)
GRANT INSERT, SELECT ON public.auth_attempts TO authenticated;
GRANT ALL ON public.auth_attempts TO service_role;

-- Function to check rate limit
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(_identifier text, _max_attempts int DEFAULT 5, _window_minutes int DEFAULT 15)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _count int;
BEGIN
    INSERT INTO public.auth_attempts (identifier) VALUES (_identifier);
    
    SELECT count(*) INTO _count
    FROM public.auth_attempts
    WHERE identifier = _identifier
      AND created_at > (now() - (_window_minutes || ' minutes')::interval);
      
    IF _count > _max_attempts THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$;

-- 2. Reinforce Profile Security
-- Ensure only relevant staff can see profile data
DROP POLICY IF EXISTS "profiles readable by same company" ON public.profiles;
CREATE POLICY "profiles readable by same company" ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id 
    OR (
      public.current_user_is_staff() 
      AND (
        public.shares_my_company(id) 
        OR public.has_role(auth.uid(), 'super_admin')
      )
    )
  );

-- 3. Storage Security Hardening
-- bucket vehicle-media should only be accessible by relevant staff
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'vehicle-media') THEN
    DROP POLICY IF EXISTS "staff read vehicle-media-isolation" ON storage.objects;
    CREATE POLICY "staff read vehicle-media-isolation" ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'vehicle-media' 
        AND (
          public.has_role(auth.uid(), 'super_admin')
          OR public.current_user_is_staff() -- Simplified check for now, can be further refined if folder structure is strictly [vehicle_id]/file
        )
      );
  END IF;
END $$;