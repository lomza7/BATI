-- ============================================================
-- Migration: 20260407000002_sprint2_clients
-- Description: Enrich clients table for Sprint 2 CRM features
-- ============================================================

-- Add new columns to clients table
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'particulier'
    CHECK (client_type IN ('particulier', 'professionnel')),
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS siret text,
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS billing_city text,
  ADD COLUMN IF NOT EXISTS billing_postal_code text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Full-text search index (French dictionary)
CREATE INDEX IF NOT EXISTS idx_clients_search ON public.clients
  USING gin(
    to_tsvector(
      'french',
      coalesce(name, '') || ' ' ||
      coalesce(company_name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(phone, '') || ' ' ||
      coalesce(siret, '')
    )
  );

-- Partial index for non-deleted clients
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at
  ON public.clients(deleted_at)
  WHERE deleted_at IS NULL;

-- Unique SIRET per user (excluding deleted)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_siret
  ON public.clients(user_id, siret)
  WHERE siret IS NOT NULL AND deleted_at IS NULL;
