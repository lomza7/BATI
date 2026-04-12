-- Fix enum values to match code (remove accents)
-- The code uses 'creee', 'envoyee', 'payee', 'annulee' etc.
-- but the enums had accented values like 'émise', 'envoyée', 'payée', 'annulée'

ALTER TYPE invoice_status RENAME VALUE 'émise' TO 'creee';
ALTER TYPE invoice_status RENAME VALUE 'envoyée' TO 'envoyee';
ALTER TYPE invoice_status RENAME VALUE 'payée' TO 'payee';
ALTER TYPE invoice_status RENAME VALUE 'annulée' TO 'annulee';

ALTER TYPE quote_status RENAME VALUE 'envoyé' TO 'envoye';
ALTER TYPE quote_status RENAME VALUE 'accepté' TO 'accepte';
ALTER TYPE quote_status RENAME VALUE 'refusé' TO 'refuse';
ALTER TYPE quote_status RENAME VALUE 'expiré' TO 'expire';
ALTER TYPE quote_status RENAME VALUE 'facturé' TO 'facture_done';
