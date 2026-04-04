-- Add TVA rate column to recurring_contracts (default 20%)
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS tva_rate numeric DEFAULT 20;
