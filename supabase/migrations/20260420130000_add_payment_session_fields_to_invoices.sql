ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_client_secret text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_stripe_account_id text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_publishable_key text;

NOTIFY pgrst, 'reload schema';
