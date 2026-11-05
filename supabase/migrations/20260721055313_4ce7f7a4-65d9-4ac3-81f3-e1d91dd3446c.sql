ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE public.job_status_events ALTER COLUMN status DROP NOT NULL;