-- Link recurring contracts to their originating quote
ALTER TABLE recurring_contracts ADD COLUMN IF NOT EXISTS quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_rc_quote_id ON recurring_contracts(quote_id) WHERE quote_id IS NOT NULL;
