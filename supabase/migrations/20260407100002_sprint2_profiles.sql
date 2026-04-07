-- ============================================================
-- Migration: 20260407100002_sprint2_profiles
-- Description: Sprint 2 — Artisan legal fields on profiles
--   - Assurance décennale
--   - Certification RGE
--   - Auto-entrepreneur flag
--   - TVA number (idempotent — may already exist from pappers migration)
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS insurance_decennale_number text,
  ADD COLUMN IF NOT EXISTS insurance_decennale_company text,
  ADD COLUMN IF NOT EXISTS insurance_decennale_expiry date,
  ADD COLUMN IF NOT EXISTS rge_number text,
  ADD COLUMN IF NOT EXISTS rge_valid_until date,
  ADD COLUMN IF NOT EXISTS is_auto_entrepreneur boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tva_number text;
