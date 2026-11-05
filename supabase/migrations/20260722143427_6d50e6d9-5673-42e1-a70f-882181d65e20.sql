
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spent_on date NOT NULL DEFAULT current_date,
  category text NOT NULL,
  vendor text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text,
  notes text,
  bill_path text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance can view expenses" ON public.expenses
  FOR SELECT TO authenticated USING (public.current_user_can_finance());
CREATE POLICY "Finance can insert expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.current_user_can_finance());
CREATE POLICY "Finance can update expenses" ON public.expenses
  FOR UPDATE TO authenticated USING (public.current_user_can_finance()) WITH CHECK (public.current_user_can_finance());
CREATE POLICY "Finance can delete expenses" ON public.expenses
  FOR DELETE TO authenticated USING (public.current_user_can_finance());

CREATE INDEX expenses_spent_on_idx ON public.expenses (spent_on DESC);
CREATE INDEX expenses_category_idx ON public.expenses (category);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER expenses_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.tg_write_activity('expense');

-- Storage policies for expense-bills bucket (finance-only)
CREATE POLICY "Finance can view expense bills" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'expense-bills' AND public.current_user_can_finance());
CREATE POLICY "Finance can upload expense bills" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-bills' AND public.current_user_can_finance());
CREATE POLICY "Finance can update expense bills" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-bills' AND public.current_user_can_finance());
CREATE POLICY "Finance can delete expense bills" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'expense-bills' AND public.current_user_can_finance());
