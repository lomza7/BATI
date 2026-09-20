-- Avoirs (factures rectificatives)
--
-- En droit francais un avoir n'est pas une annulation : c'est une facture a
-- part entiere (art. 289 CGI) qui doit porter les mentions obligatoires de
-- l'art. 242 nonies A ann. II CGI, referencer la facture initiale de facon
-- specifique et non equivoque, et prendre un numero dans une sequence
-- chronologique continue. La facture initiale, elle, reste intouchable
-- (art. L.102 B LPF, L.123-22 c. com.) : on ne la modifie jamais, on emet
-- un avoir en face. C'est aussi la seule facon de recuperer la TVA collectee
-- (art. 272-1 et 283-3 CGI).
--
-- Convention de signe retenue : un avoir stocke des montants NEGATIFS
-- (total_ht, total_tva, total_ttc, tva_breakdown, invoice_lines). La quasi
-- totalite des agregats de l'app sont des sommes additives sur total_ttc /
-- total_ht : le signe negatif les rend justes par defaut, au lieu de les
-- rendre faux par defaut. Le FEC, lui, exige des montants positifs et
-- inverse le sens des ecritures — c'est gere dans lib/comptabilite/fec-export.ts.
--
-- Le statut de la facture creditee n'est JAMAIS modifie : la passer a
-- 'annulee' la sortirait des agregats en plus de la deduction portee par
-- l'avoir, donc deduirait deux fois. L'etat « creditee » se derive de
-- l'existence d'avoirs (cf. lib/invoices/credit-notes.ts).
--
-- Note : ce repo de migrations n'est pas la verite de la prod (plusieurs
-- objets y ont ete crees hors migration). Tout est donc ecrit defensivement.

-- ──────────────────────────────────────────────────────────────
-- 1. Colonnes de rattachement
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS credited_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS credit_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_credited_invoice_id_fkey'
  ) THEN
    -- RESTRICT : une facture creditee ne peut pas disparaitre tant que son
    -- avoir existe, sinon l'avoir devient une piece comptable orpheline sans
    -- reference legale (art. 242 nonies A ann. II CGI).
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_credited_invoice_id_fkey
      FOREIGN KEY (credited_invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_credited_invoice_id
  ON public.invoices (credited_invoice_id)
  WHERE credited_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.invoices.credited_invoice_id IS
  'Pour invoice_type = avoir : facture rectifiee par cet avoir (reference legale obligatoire).';
COMMENT ON COLUMN public.invoices.credit_reason IS
  'Motif de l''avoir (geste commercial, erreur de facturation, annulation de commande, retour...).';

-- ──────────────────────────────────────────────────────────────
-- 2. Ouvrir invoice_type au type 'avoir'
-- ──────────────────────────────────────────────────────────────
-- Le CHECK inline pose par 20260418140000 est nomme automatiquement par
-- Postgres. On le retrouve par son contenu plutot que par son nom, au cas ou
-- il aurait ete renomme en prod.
DO $$
DECLARE
  v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.invoices'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%invoice_type%'
    AND pg_get_constraintdef(oid) LIKE '%acompte%'
    AND pg_get_constraintdef(oid) NOT LIKE '%quote_id%'
  LIMIT 1;

  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.invoices DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('standard', 'acompte', 'solde', 'avoir'));

-- ──────────────────────────────────────────────────────────────
-- 3. Un avoir se rattache a une FACTURE, pas a un devis
-- ──────────────────────────────────────────────────────────────
-- La contrainte d'origine etait ecrite en liste noire implicite
-- (« type = standard OU quote_id non nul »), donc tout nouveau type devenait
-- de facto obligatoirement rattache a un devis. Or on avoire aussi bien une
-- facture directe, une facture de contrat recurrent ou une facture importee,
-- qui n'ont aucun devis.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_acompte_solde_requires_quote;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_acompte_solde_requires_quote
  CHECK (invoice_type IN ('standard', 'avoir') OR quote_id IS NOT NULL);

-- ──────────────────────────────────────────────────────────────
-- 4. Coherence interne d'un avoir
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_avoir_requires_credited_invoice;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_avoir_requires_credited_invoice
  CHECK (invoice_type <> 'avoir' OR credited_invoice_id IS NOT NULL);

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_credited_invoice_only_on_avoir;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_credited_invoice_only_on_avoir
  CHECK (credited_invoice_id IS NULL OR invoice_type = 'avoir');

-- Signe : un avoir porte des montants negatifs (ou nuls pour un brouillon
-- encore vide). Empeche les deux conventions de coexister en base.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_avoir_negative_amounts;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_avoir_negative_amounts
  CHECK (
    invoice_type <> 'avoir'
    OR (
      COALESCE(total_ht, 0) <= 0
      AND COALESCE(total_ttc, 0) <= 0
      AND COALESCE(total_tva, 0) <= 0
    )
  ) NOT VALID;

-- Symetriquement, une facture normale ne peut pas etre negative — sinon on
-- fabriquerait un avoir deguise qui echapperait a toutes les gardes.
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_non_avoir_positive_amounts;
-- NOT VALID : la contrainte s'applique a toute ecriture future mais ne
-- reverifie pas l'existant. L'import Costructor a pu, par le passe, stocker un
-- avoir en facture « annulee » a montant negatif ; sans NOT VALID, une seule
-- ligne de ce type ferait echouer toute la migration en production. Les lignes
-- historiques restent lisibles, et toute mise a jour les soumettra au controle.
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_non_avoir_positive_amounts
  CHECK (
    invoice_type = 'avoir'
    OR (COALESCE(total_ht, 0) >= 0 AND COALESCE(total_ttc, 0) >= 0)
  ) NOT VALID;

-- ──────────────────────────────────────────────────────────────
-- 5. Integrite referentielle qu'un CHECK ne peut pas exprimer
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_credit_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_target record;
  v_deposits numeric := 0;
  v_claimed numeric;
  v_already numeric := 0;
BEGIN
  IF NEW.invoice_type <> 'avoir' THEN
    RETURN NEW;
  END IF;

  IF NEW.credited_invoice_id IS NULL THEN
    RAISE EXCEPTION 'avoir_sans_facture_rectifiee'
      USING ERRCODE = 'check_violation',
            HINT = 'Un avoir doit referencer la facture qu''il rectifie.';
  END IF;

  SELECT id, user_id, invoice_type, status, total_ttc, quote_id
    INTO v_target
  FROM public.invoices
  WHERE id = NEW.credited_invoice_id;

  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'avoir_target_introuvable'
      USING ERRCODE = 'foreign_key_violation',
            HINT = 'La facture a crediter est introuvable.';
  END IF;

  IF v_target.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'avoir_target_autre_utilisateur'
      USING ERRCODE = 'check_violation',
            HINT = 'Un avoir ne peut crediter qu''une facture du meme compte.';
  END IF;

  IF v_target.invoice_type = 'avoir' THEN
    RAISE EXCEPTION 'avoir_sur_avoir'
      USING ERRCODE = 'check_violation',
            HINT = 'Un avoir ne peut pas crediter un autre avoir.';
  END IF;

  -- Un brouillon n'a jamais ete emis : il se corrige directement, l'avoir
  -- n'a pas lieu d'etre (et creerait une piece comptable sans contrepartie).
  IF v_target.status = 'brouillon' THEN
    RAISE EXCEPTION 'avoir_sur_brouillon'
      USING ERRCODE = 'check_violation',
            HINT = 'Une facture en brouillon se modifie directement, sans avoir.';
  END IF;

  -- Plafond : on ne peut pas crediter plus que ce que la facture a reellement
  -- reclame au client. Le garde-fou existe cote UI, mais il doit aussi vivre
  -- ici : les imports, les scripts et les routes serveur ecrivent en direct.
  --
  -- Une facture de SOLDE stocke le total BRUT du devis ; ce qu'elle reclame
  -- est ce total moins les acomptes deja factures, eux-memes nets de leurs
  -- propres avoirs. C'est la meme regle que claimedTtc() cote TypeScript.
  IF v_target.invoice_type = 'solde' AND v_target.quote_id IS NOT NULL THEN
    SELECT COALESCE(SUM(
      GREATEST(
        0,
        d.total_ttc + COALESCE((
          SELECT SUM(a.total_ttc) FROM public.invoices a
          WHERE a.credited_invoice_id = d.id
            AND a.invoice_type = 'avoir'
            AND a.status <> 'brouillon'
        ), 0)
      )
    ), 0)
    INTO v_deposits
    FROM public.invoices d
    WHERE d.quote_id = v_target.quote_id
      AND d.invoice_type = 'acompte'
      AND d.status <> 'annulee';

    v_claimed := GREATEST(0, COALESCE(v_target.total_ttc, 0) - v_deposits);
  ELSE
    v_claimed := COALESCE(v_target.total_ttc, 0);
  END IF;

  -- Avoirs deja emis sur cette facture, en excluant la ligne en cours pour que
  -- la regle soit identique en INSERT et en UPDATE.
  SELECT COALESCE(SUM(a.total_ttc), 0)
    INTO v_already
  FROM public.invoices a
  WHERE a.credited_invoice_id = NEW.credited_invoice_id
    AND a.invoice_type = 'avoir'
    AND a.status <> 'brouillon'
    AND a.id IS DISTINCT FROM NEW.id;

  -- Tolerance d'un centime pour absorber les arrondis de TVA.
  IF NEW.status <> 'brouillon'
     AND (ABS(v_already + COALESCE(NEW.total_ttc, 0)) > v_claimed + 0.01) THEN
    RAISE EXCEPTION 'avoir_depasse_facture'
      USING ERRCODE = 'check_violation',
            HINT = 'Le cumul des avoirs ne peut pas depasser le montant reclame par la facture.';
  END IF;

  RETURN NEW;
END;
$$;

-- La liste des colonnes surveillees inclut total_ttc et status : sans elles,
-- on pourrait gonfler le montant d'un avoir deja en base, ou sortir un avoir
-- du brouillon, sans repasser par le plafond.
DROP TRIGGER IF EXISTS trg_validate_credit_note ON public.invoices;
CREATE TRIGGER trg_validate_credit_note
BEFORE INSERT OR UPDATE OF invoice_type, credited_invoice_id, user_id, total_ttc, status
ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.validate_credit_note();

-- ──────────────────────────────────────────────────────────────
-- 6. Paywall : un avoir ne consomme jamais de quota
-- ──────────────────────────────────────────────────────────────
-- Emettre un avoir est une obligation de rectification, pas un acte
-- commercial : un artisan Free bloque a 5 factures/mois doit pouvoir
-- corriger une erreur de facturation. L'exemption doit etre faite cote SQL
-- (le QuotaMeter ne fait que relire usage_counters, deja agrege par Postgres).
CREATE OR REPLACE FUNCTION public.enforce_quote_invoice_quota()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_feature text := TG_ARGV[0];
BEGIN
  -- IF imbriques, et non « TG_TABLE_NAME = 'invoices' AND NEW.invoice_type ... » :
  -- PL/pgSQL compile une condition entiere comme UNE expression SQL, donc
  -- NEW.invoice_type serait resolu meme sur quotes (qui n'a pas cette colonne)
  -- et leverait « record "new" has no field "invoice_type" » a chaque creation
  -- de devis. Le IF interne, lui, n'est planifie que s'il est atteint.
  IF TG_TABLE_NAME = 'invoices' THEN
    IF NEW.invoice_type = 'avoir' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NOT can_create_quote_or_invoice(NEW.user_id, v_feature) THEN
    RAISE EXCEPTION 'quota_reached_%', v_feature
      USING ERRCODE = 'check_violation',
            HINT   = 'Vous avez atteint la limite mensuelle du plan Gratuit (5). Passez en Pro pour un usage illimité.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_doc_usage()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_feature text := TG_ARGV[0];
BEGIN
  -- Meme precaution que dans enforce_quote_invoice_quota : IF imbriques.
  IF TG_TABLE_NAME = 'invoices' THEN
    IF NEW.invoice_type = 'avoir' THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO usage_counters (user_id, period, feature, count)
  VALUES (NEW.user_id, to_char(now(),'YYYY-MM'), v_feature, 1)
  ON CONFLICT (user_id, period, feature)
  DO UPDATE SET count = usage_counters.count + 1, updated_at = now();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 7. Un avoir n'est jamais encaissable
-- ──────────────────────────────────────────────────────────────
-- mark_invoice_paid est appelee par le webhook Stripe : c'est le dernier
-- rempart cote base, apres les gardes applicatives des routes de paiement.
CREATE OR REPLACE FUNCTION public.mark_invoice_paid(
  p_invoice_id uuid,
  p_payment_intent_id text,
  p_checkout_session_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE invoices SET
    status = 'payee',
    paid_at = now(),
    stripe_payment_intent_id = p_payment_intent_id,
    stripe_checkout_session_id = p_checkout_session_id,
    payment_method = 'stripe'
  WHERE id = p_invoice_id
    AND status <> 'payee'
    AND invoice_type <> 'avoir';

  UPDATE invoice_sends SET paid_at = now()
  WHERE invoice_id = p_invoice_id
    AND paid_at IS NULL
    AND EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = p_invoice_id AND i.invoice_type <> 'avoir'
    );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 8. Vue publique : exposer la facture rectifiee
-- ──────────────────────────────────────────────────────────────
-- La RPC renvoie deja `to_jsonb(i)`, donc credited_invoice_id et
-- credit_reason remontent automatiquement. Mais le client doit lire le
-- NUMERO et la DATE de la facture rectifiee (mention legale obligatoire) —
-- il n'a aucun acces a la ligne creditee.
CREATE OR REPLACE FUNCTION public.get_public_invoice_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_send record;
  v_invoice jsonb;
  v_lines jsonb;
  v_artisan jsonb;
  v_bank jsonb;
  v_linked_quote_number text;
  v_linked_deposits jsonb := '[]'::jsonb;
  v_credited jsonb;
  v_credit_notes jsonb := '[]'::jsonb;
  v_stripe_enabled boolean := false;
  v_is_avoir boolean := false;
BEGIN
  SELECT * INTO v_send
  FROM invoice_sends
  WHERE token = p_token
    AND expires_at > now()
  LIMIT 1;

  IF v_send.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE invoice_sends
  SET viewed_at = now()
  WHERE id = v_send.id AND viewed_at IS NULL;

  SELECT to_jsonb(i) - 'user_id' || jsonb_build_object(
    'clients', (
      SELECT to_jsonb(c) - 'user_id' - 'notes' - 'source' - 'contact_type' - 'created_at' - 'updated_at' - 'deleted_at'
      FROM clients c
      WHERE c.id = i.client_id
    )
  )
  INTO v_invoice
  FROM invoices i
  WHERE i.id = v_send.invoice_id;

  IF v_invoice IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_avoir := (v_invoice->>'invoice_type') = 'avoir';

  SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.position), '[]'::jsonb)
  INTO v_lines
  FROM invoice_lines l
  WHERE l.invoice_id = v_send.invoice_id;

  SELECT to_jsonb(p) - 'email' - 'phone'
  INTO v_artisan
  FROM (
    SELECT company_name, full_name, siret, tva_number, company_address,
           company_postal_code, company_city, company_phone, logo_url,
           insurance_company, insurance_address, insurance_coverage_zone,
           insurance_contract_number, insurance_warranty_type, document_config
    FROM profiles
    WHERE id = v_send.user_id
  ) p;

  -- Pas de RIB sur un avoir : il n'y a rien a virer a l'artisan.
  IF (v_invoice->>'bank_account_id') IS NOT NULL AND NOT v_is_avoir THEN
    SELECT to_jsonb(b)
    INTO v_bank
    FROM (
      SELECT label, bank_name, account_holder, iban, bic
      FROM bank_accounts
      WHERE id = (v_invoice->>'bank_account_id')::uuid
        AND user_id = v_send.user_id
        AND deleted_at IS NULL
    ) b;
  END IF;

  -- Devis source (pour factures d'acompte/solde)
  IF (v_invoice->>'quote_id') IS NOT NULL THEN
    SELECT quote_number INTO v_linked_quote_number
    FROM quotes
    WHERE id = (v_invoice->>'quote_id')::uuid;

    -- Acomptes liés (pour factures de solde), nets de leurs avoirs
    IF (v_invoice->>'invoice_type') = 'solde' THEN
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'invoice_number', d.invoice_number,
          'total_ttc', d.total_ttc + coalesce((
            SELECT sum(a.total_ttc) FROM invoices a
            WHERE a.credited_invoice_id = d.id AND a.invoice_type = 'avoir'
              AND a.status <> 'brouillon'
          ), 0),
          'issued_at', d.issued_at,
          'created_at', d.created_at,
          'status', d.status,
          'deposit_percentage', d.deposit_percentage
        ) ORDER BY d.issued_at NULLS LAST, d.created_at
      ), '[]'::jsonb)
      INTO v_linked_deposits
      FROM invoices d
      WHERE d.quote_id = (v_invoice->>'quote_id')::uuid
        AND d.invoice_type = 'acompte'
        AND d.status <> 'annulee';
    END IF;
  END IF;

  -- Facture rectifiee (mention legale obligatoire sur un avoir)
  IF (v_invoice->>'credited_invoice_id') IS NOT NULL THEN
    SELECT jsonb_build_object(
      'id', c.id,
      'invoice_number', c.invoice_number,
      'title', c.title,
      'issued_at', c.issued_at,
      'created_at', c.created_at,
      'total_ttc', c.total_ttc
    )
    INTO v_credited
    FROM invoices c
    WHERE c.id = (v_invoice->>'credited_invoice_id')::uuid;
  END IF;

  -- Avoirs deja emis sur cette facture (pour afficher le net restant du)
  IF NOT v_is_avoir THEN
    SELECT coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'invoice_number', a.invoice_number,
        'total_ttc', a.total_ttc,
        'issued_at', a.issued_at,
        'created_at', a.created_at
      ) ORDER BY a.issued_at NULLS LAST, a.created_at
    ), '[]'::jsonb)
    INTO v_credit_notes
    FROM invoices a
    WHERE a.credited_invoice_id = v_send.invoice_id
      AND a.invoice_type = 'avoir'
      AND a.status <> 'brouillon';
  END IF;

  -- Stripe payment status — jamais de paiement sur un avoir
  IF NOT v_is_avoir THEN
    SELECT charges_enabled INTO v_stripe_enabled
    FROM stripe_connections
    WHERE user_id = v_send.user_id
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'send', jsonb_build_object(
      'id', v_send.id,
      'invoice_id', v_send.invoice_id,
      'client_name', v_send.client_name,
      'expires_at', v_send.expires_at,
      'viewed_at', v_send.viewed_at,
      'paid_at', v_send.paid_at,
      'enable_stripe_payment', v_send.enable_stripe_payment AND NOT v_is_avoir
    ),
    'invoice', v_invoice,
    'lines', v_lines,
    'artisan', v_artisan,
    'bank_account', v_bank,
    'linked_quote_number', v_linked_quote_number,
    'linked_deposits', v_linked_deposits,
    'credited_invoice', v_credited,
    'credit_notes', v_credit_notes,
    'stripe_charges_enabled', coalesce(v_stripe_enabled, false)
  );
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- 9. Donnees de demo : ne pas casser le nettoyage
-- ──────────────────────────────────────────────────────────────
-- Scenario : l'artisan teste sur les factures de demo, emet un VRAI avoir
-- sur l'une d'elles, puis efface les donnees de demo. La FK RESTRICT ferait
-- echouer le DELETE et casserait tout le nettoyage. On promeut donc en
-- donnee reelle toute facture de demo creditee par un avoir non-demo.
DO $$
DECLARE
  v_src text;
  v_anchor text := '    -- Promote demo team_members referenced by a non-demo planning_event';
  v_patch text;
  v_new text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'clear_demo_data_for_user' LIMIT 1;

  IF v_src IS NULL THEN
    RAISE WARNING 'clear_demo_data_for_user absente : promotion des factures creditees non installee';
    RETURN;
  END IF;

  IF position('credited_invoice_id' in v_src) > 0 THEN
    RAISE NOTICE 'clear_demo_data_for_user deja patchee, rien a faire';
    RETURN;
  END IF;

  -- L'ancre vise la PREMIERE promotion A L'INTERIEUR de la boucle « FOR i IN
  -- 1..3 LOOP ». Il faut y etre : la promotion d'une facture de demo doit
  -- pouvoir entrainer, aux passes suivantes, celle de son client, de son devis
  -- et de son chantier. Placee apres END LOOP, la chaine ne se resoudrait pas
  -- et le DELETE des clients de demo echouerait sur la FK.
  --
  -- L'alias est « inv » et non « i » : « i » est la variable de boucle de la
  -- fonction, la reutiliser comme alias de table rendrait « i.id » ambigu.
  v_patch :=
    '    -- Promote demo invoices credited by a non-demo avoir (FK RESTRICT) :' || E'\n' ||
    '    -- sans ca, un artisan qui emet un vrai avoir sur une facture de demo' || E'\n' ||
    '    -- ne peut plus jamais effacer ses donnees de demonstration.' || E'\n' ||
    '    UPDATE public.invoices inv' || E'\n' ||
    '    SET is_demo = false' || E'\n' ||
    '    WHERE inv.user_id = p_user_id' || E'\n' ||
    '      AND inv.is_demo = true' || E'\n' ||
    '      AND EXISTS (' || E'\n' ||
    '        SELECT 1 FROM public.invoices a' || E'\n' ||
    '        WHERE a.credited_invoice_id = inv.id AND a.is_demo = false' || E'\n' ||
    '      );' || E'\n\n' ||
    v_anchor;

  IF position(v_anchor in v_src) = 0 THEN
    RAISE WARNING
      'clear_demo_data_for_user : ancre de promotion introuvable, patch avoirs NON applique. '
      'Effacer les donnees de demo echouera si un avoir porte sur une facture de demo.';
    RETURN;
  END IF;

  v_new := replace(v_src, v_anchor, v_patch);

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.clear_demo_data_for_user(p_user_id uuid) '
    'RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''public'' AS %L',
    v_new
  );

  -- Verification : on relit ce que Postgres a reellement enregistre.
  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'clear_demo_data_for_user' LIMIT 1;
  IF position('credited_invoice_id' in coalesce(v_src, '')) = 0 THEN
    RAISE EXCEPTION 'clear_demo_data_for_user : le patch avoirs n''a pas ete applique';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
