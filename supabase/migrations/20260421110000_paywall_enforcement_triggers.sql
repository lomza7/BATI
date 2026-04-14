-- Paywall Hellobat — Phase 2: enforcement par triggers
--
-- Les tables Pro-only ont un double chemin d'accès (policies "Users can insert own X"
-- ET "workspace_insert"). RLS étant OR-ed, on ne peut pas fiabiliser le gating
-- juste en remplaçant une des deux. On passe donc par des triggers BEFORE INSERT
-- qui lèvent une exception si l'owner n'a pas l'accès Pro.
--
-- Pour quotes/invoices: limite dure à 5/mois en Free (erreur explicite côté client).
-- AFTER INSERT: bump du compteur mensuel pour l'affichage QuotaMeter.

-- ──────────────────────────────────────────────────────────────
-- Trigger fn: bloque INSERT sur table Pro-only si owner pas Pro actif
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_pro_access()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT has_pro_access(NEW.user_id) THEN
    RAISE EXCEPTION 'pro_required'
      USING ERRCODE = 'check_violation',
            HINT   = 'Cette fonctionnalité nécessite un abonnement Pro actif.';
  END IF;
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Trigger fn: bloque INSERT quote/invoice si Free et quota 5/mois atteint
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_quote_invoice_quota()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_feature text := TG_ARGV[0];  -- 'quote' ou 'invoice'
BEGIN
  IF NOT can_create_quote_or_invoice(NEW.user_id, v_feature) THEN
    RAISE EXCEPTION 'quota_reached_%', v_feature
      USING ERRCODE = 'check_violation',
            HINT   = 'Vous avez atteint la limite mensuelle du plan Gratuit (5). Passez en Pro pour un usage illimité.';
  END IF;
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Trigger fn: AFTER INSERT quote/invoice → bump usage_counters
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bump_doc_usage()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_feature text := TG_ARGV[0];
BEGIN
  INSERT INTO usage_counters (user_id, period, feature, count)
  VALUES (NEW.user_id, to_char(now(),'YYYY-MM'), v_feature, 1)
  ON CONFLICT (user_id, period, feature)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- Tables Pro-only: trigger de gating
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
  pro_tables text[] := ARRAY[
    'team_members',
    'planning_events',
    'catalogs',
    'catalog_collections',
    'catalog_products',
    'catalog_sends',
    'leads',
    'lead_sources',
    'lead_stages',
    'recurring_contracts',
    'ai_conversations',
    'ai_messages',
    'ai_agents',
    'artisan_sites'
  ];
BEGIN
  FOREACH t IN ARRAY pro_tables LOOP
    -- skip si la table n'existe pas
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t AND table_schema = 'public') THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_pro_required ON %I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_pro_required BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION enforce_pro_access()',
        t
      );
    END IF;
  END LOOP;
END$$;

-- ──────────────────────────────────────────────────────────────
-- Quotes: quota Free + bump
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_quote_quota ON quotes;
CREATE TRIGGER trg_quote_quota
BEFORE INSERT ON quotes
FOR EACH ROW EXECUTE FUNCTION enforce_quote_invoice_quota('quote');

DROP TRIGGER IF EXISTS trg_quote_bump ON quotes;
CREATE TRIGGER trg_quote_bump
AFTER INSERT ON quotes
FOR EACH ROW EXECUTE FUNCTION bump_doc_usage('quote');

-- ──────────────────────────────────────────────────────────────
-- Invoices: quota Free + bump
-- ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_invoice_quota ON invoices;
CREATE TRIGGER trg_invoice_quota
BEFORE INSERT ON invoices
FOR EACH ROW EXECUTE FUNCTION enforce_quote_invoice_quota('invoice');

DROP TRIGGER IF EXISTS trg_invoice_bump ON invoices;
CREATE TRIGGER trg_invoice_bump
AFTER INSERT ON invoices
FOR EACH ROW EXECUTE FUNCTION bump_doc_usage('invoice');

NOTIFY pgrst, 'reload schema';
