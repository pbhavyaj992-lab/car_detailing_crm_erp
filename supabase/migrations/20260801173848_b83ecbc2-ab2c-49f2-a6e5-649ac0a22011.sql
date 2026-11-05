
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_phone_key;
DROP INDEX IF EXISTS public.customers_phone_key;
DROP INDEX IF EXISTS public.customers_phone_unique;

ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_number_key;
DROP INDEX IF EXISTS public.vehicles_number_key;
DROP INDEX IF EXISTS public.vehicles_number_unique;
