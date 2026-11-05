-- Ensure inquiries table has company_id and proper constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inquiries' AND column_name = 'company_id') THEN
        ALTER TABLE public.inquiries ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- Enable RLS
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own company inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Users can insert inquiries for their own company" ON public.inquiries;
DROP POLICY IF EXISTS "Users can update inquiries for their own company" ON public.inquiries;

-- Create policies
CREATE POLICY "Users can view their own company inquiries"
ON public.inquiries FOR SELECT
TO authenticated
USING (company_id = (SELECT public.current_company_id()));

CREATE POLICY "Users can insert inquiries for their own company"
ON public.inquiries FOR INSERT
TO authenticated
WITH CHECK (company_id = (SELECT public.current_company_id()));

CREATE POLICY "Users can update inquiries for their own company"
ON public.inquiries FOR UPDATE
TO authenticated
USING (company_id = (SELECT public.current_company_id()));

-- Attach the company_id trigger
DROP TRIGGER IF EXISTS tr_set_inquiries_company_id ON public.inquiries;
CREATE TRIGGER tr_set_inquiries_company_id
BEFORE INSERT ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.tg_set_company_id();