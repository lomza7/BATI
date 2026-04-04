-- Flag services as recurring with a billing frequency
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'mensuel';
