-- Phase 2.C — Révocation de l'accès direct anon aux tables magic-link.
-- Pré-requis : les pages publiques /d /f /c doivent être déployées et
-- stables depuis 24-48h en utilisant exclusivement les RPC SECURITY
-- DEFINER (get_public_quote_by_token, get_public_invoice_by_token,
-- get_public_catalog_by_token, record_catalog_selection) définies dans
-- 20260422110000_public_token_rpc.sql.
-- Après cette migration, un client anon ne pourra plus faire .select()
-- direct sur ces tables — seule la voie RPC (avec token valide) marche.

-- quote_sends
DROP POLICY IF EXISTS "Public can view quote sends by token" ON quote_sends;
DROP POLICY IF EXISTS "Anon can mark quote send as viewed" ON quote_sends;

-- invoice_sends
DROP POLICY IF EXISTS "anon_view_valid" ON invoice_sends;

-- catalog_sends
DROP POLICY IF EXISTS "Public can view sends by token" ON catalog_sends;

-- catalog_client_selections
DROP POLICY IF EXISTS "Anon can insert selections for valid sends" ON catalog_client_selections;
DROP POLICY IF EXISTS "Anon can view selections for valid sends" ON catalog_client_selections;

-- bank_accounts
DROP POLICY IF EXISTS "Public can view bank_accounts via valid invoice send" ON bank_accounts;
DROP POLICY IF EXISTS "Public can view bank_accounts via valid quote send" ON bank_accounts;

-- Révocation explicite du SELECT anon au cas où des GRANT auraient été
-- posés en dehors des policies (ceinture + bretelles).
REVOKE SELECT ON quote_sends FROM anon;
REVOKE SELECT ON invoice_sends FROM anon;
REVOKE SELECT ON catalog_sends FROM anon;
REVOKE SELECT, INSERT ON catalog_client_selections FROM anon;
REVOKE SELECT ON bank_accounts FROM anon;
REVOKE UPDATE ON quote_sends FROM anon;

NOTIFY pgrst, 'reload schema';
