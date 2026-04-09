-- ============================================================
-- TVA par ligne (multi-taux) — devis & factures
--
-- Objectif : permettre à l'artisan de spécifier un taux de TVA
-- différent par ligne (5,5% rénovation énergétique, 10% travaux
-- de rénovation, 20% standard, 0% franchise en base).
--
-- Changements :
-- 1. quote_lines.tva_rate — taux par ligne
-- 2. invoice_lines.tva_rate — taux par ligne
-- 3. quotes / invoices : total_tva + tva_breakdown (JSONB)
--    tva_breakdown = [{rate, base_ht, tva_amount}] trié par taux
--    quotes.tva_rate / invoices.tva_rate conservés : ils stockent
--    désormais le taux majoritaire (pour backcompat du code existant).
--
-- Migration additive : aucune colonne supprimée, rien ne casse.
-- ============================================================

-- 1. Ajouter les colonnes tva_rate sur les lignes
ALTER TABLE public.quote_lines
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NOT NULL DEFAULT 20;

ALTER TABLE public.invoice_lines
  ADD COLUMN IF NOT EXISTS tva_rate numeric(5,2) NOT NULL DEFAULT 20;

-- 2. Ajouter total_tva et tva_breakdown sur les documents
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS total_tva numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tva_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS total_tva numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tva_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 3. Backfill : lignes existantes héritent du taux du parent
UPDATE public.quote_lines ql
   SET tva_rate = COALESCE(q.tva_rate, 20)
  FROM public.quotes q
 WHERE ql.quote_id = q.id
   AND ql.tva_rate = 20
   AND q.tva_rate IS NOT NULL
   AND q.tva_rate <> 20;

UPDATE public.invoice_lines il
   SET tva_rate = COALESCE(i.tva_rate, 20)
  FROM public.invoices i
 WHERE il.invoice_id = i.id
   AND il.tva_rate = 20
   AND i.tva_rate IS NOT NULL
   AND i.tva_rate <> 20;

-- 4. Backfill total_tva et tva_breakdown sur les devis existants
WITH line_agg AS (
  SELECT
    ql.quote_id,
    ql.tva_rate,
    SUM(ql.total) AS base_ht,
    ROUND((SUM(ql.total) * ql.tva_rate / 100)::numeric, 2) AS tva_amount
  FROM public.quote_lines ql
  GROUP BY ql.quote_id, ql.tva_rate
),
breakdown AS (
  SELECT
    quote_id,
    jsonb_agg(
      jsonb_build_object(
        'rate', tva_rate,
        'base_ht', base_ht,
        'tva_amount', tva_amount
      ) ORDER BY tva_rate
    ) AS tva_breakdown,
    SUM(tva_amount) AS total_tva
  FROM line_agg
  GROUP BY quote_id
)
UPDATE public.quotes q
   SET tva_breakdown = b.tva_breakdown,
       total_tva = b.total_tva
  FROM breakdown b
 WHERE q.id = b.quote_id;

WITH line_agg AS (
  SELECT
    il.invoice_id,
    il.tva_rate,
    SUM(il.total) AS base_ht,
    ROUND((SUM(il.total) * il.tva_rate / 100)::numeric, 2) AS tva_amount
  FROM public.invoice_lines il
  GROUP BY il.invoice_id, il.tva_rate
),
breakdown AS (
  SELECT
    invoice_id,
    jsonb_agg(
      jsonb_build_object(
        'rate', tva_rate,
        'base_ht', base_ht,
        'tva_amount', tva_amount
      ) ORDER BY tva_rate
    ) AS tva_breakdown,
    SUM(tva_amount) AS total_tva
  FROM line_agg
  GROUP BY invoice_id
)
UPDATE public.invoices i
   SET tva_breakdown = b.tva_breakdown,
       total_tva = b.total_tva
  FROM breakdown b
 WHERE i.id = b.invoice_id;
