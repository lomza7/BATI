-- Per-user document numbering
--
-- Historically `quotes.quote_number` and `invoices.invoice_number` had a
-- GLOBAL unique constraint. That was illegal for French accounting rules
-- (each business must have its own gapless sequential numbering) AND it
-- caused the client-side random generator to collide between artisans, so
-- users would see numbers jump (D-2026-001 → D-2026-091 instead of -002).
--
-- This migration:
--   1. Drops the global unique constraints
--   2. Adds per-user unique constraints: (user_id, quote_number) and
--      (user_id, invoice_number). NULL user_id rows (legacy public-form
--      drafts) are ignored by PostgreSQL UNIQUE semantics (NULLs distinct).
--
-- The renumbering of existing rows is done in a separate data migration
-- below so the schema change is idempotent on its own.

-- --- Schema: quotes ----------------------------------------------------
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_quote_number_key;
ALTER TABLE quotes
  ADD CONSTRAINT quotes_user_quote_number_key UNIQUE (user_id, quote_number);

-- --- Schema: invoices --------------------------------------------------
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE invoices
  ADD CONSTRAINT invoices_user_invoice_number_key UNIQUE (user_id, invoice_number);
