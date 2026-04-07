-- ============================================================
-- Migration: 20260407100006_sprint2_rls
-- Description: Sprint 2 — RLS policies for new Sprint 2 tables
--   - quote_lots
--   - invoice_lots
--   - invoice_situations
--   - reference_counters
-- All policies enforce user_id = auth.uid() (directly or via parent join).
-- ============================================================

-- ------------------------------------------------------------
-- quote_lots
-- ------------------------------------------------------------
ALTER TABLE public.quote_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage lots of their own quotes" ON public.quote_lots;
CREATE POLICY "Users can manage lots of their own quotes"
  ON public.quote_lots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_lots.quote_id
        AND q.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- invoice_lots
-- ------------------------------------------------------------
ALTER TABLE public.invoice_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage lots of their own invoices" ON public.invoice_lots;
CREATE POLICY "Users can manage lots of their own invoices"
  ON public.invoice_lots FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_lots.invoice_id
        AND i.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- invoice_situations
-- ------------------------------------------------------------
ALTER TABLE public.invoice_situations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their invoice_situations" ON public.invoice_situations;
CREATE POLICY "Users can manage their invoice_situations"
  ON public.invoice_situations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_situations.parent_invoice_id
        AND i.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- reference_counters
-- ------------------------------------------------------------
ALTER TABLE public.reference_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own counters" ON public.reference_counters;
CREATE POLICY "Users can manage their own counters"
  ON public.reference_counters FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);
