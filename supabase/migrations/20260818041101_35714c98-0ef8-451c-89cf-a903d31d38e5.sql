-- Re-applying normalization and hardening logic
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS normalized_phone TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS normalized_registration TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Trigger to normalize phone numbers
CREATE OR REPLACE FUNCTION public.normalize_phone(p text) RETURNS text AS $$
BEGIN
  RETURN regexp_replace(p, '[^0-9]', '', 'g');
END; $$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.tg_customers_normalize() RETURNS trigger AS $$
BEGIN
  NEW.normalized_phone := public.normalize_phone(NEW.phone);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_norm ON public.customers;
CREATE TRIGGER trg_customers_norm BEFORE INSERT OR UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.tg_customers_normalize();

-- Trigger to normalize registration numbers
CREATE OR REPLACE FUNCTION public.normalize_registration(r text) RETURNS text AS $$
BEGIN
  RETURN upper(regexp_replace(r, '[^a-zA-Z0-9]', '', 'g'));
END; $$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.tg_vehicles_normalize() RETURNS trigger AS $$
BEGIN
  NEW.normalized_registration := public.normalize_registration(NEW.number);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicles_norm ON public.vehicles;
CREATE TRIGGER trg_vehicles_norm BEFORE INSERT OR UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.tg_vehicles_normalize();

-- Seed existing data normalization
UPDATE public.customers SET normalized_phone = public.normalize_phone(phone) WHERE normalized_phone IS NULL;
UPDATE public.vehicles SET normalized_registration = public.normalize_registration(number) WHERE normalized_registration IS NULL;

-- Search index update
DROP INDEX IF EXISTS customers_search_idx;
CREATE INDEX customers_search_idx ON public.customers USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(normalized_phone,'')));

DROP INDEX IF EXISTS vehicles_search_idx;
CREATE INDEX vehicles_search_idx ON public.vehicles USING gin (to_tsvector('simple', coalesce(number,'') || ' ' || coalesce(normalized_registration,'')));

-- Add missing columns to invoices if any were lost (build error mentioned adjustment_amount)
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(12,2) DEFAULT 0;
