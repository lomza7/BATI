-- ============================================================
-- Demo data seed system
--
-- Goal: every new signup gets a small, self-contained set of demo
-- data spread across every major module (contacts, chantiers,
-- devis, factures, prestations, calendrier, taches, planning,
-- equipe, documents). A banner on the dashboard lets the user
-- dismiss the demo at any time.
--
-- Design:
--   1. Tag demo rows with is_demo = true so cleanup is trivial.
--   2. profiles.demo_active tracks whether the demo is still on.
--   3. profiles.demo_intro_seen tracks whether the welcome modal
--      has been closed (so we switch from modal → persistent banner).
--   4. seed_demo_data_for_user() is called from handle_new_user().
--   5. clear_demo_data_for_user() deletes every is_demo row owned
--      by the user. The welcome PDF file (stored in the documents
--      bucket) is cleaned up by the /api/demo/clear route before
--      calling this function.
-- ============================================================

-- 1. Flag columns on profiles ----------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demo_intro_seen boolean NOT NULL DEFAULT false;

-- 2. is_demo column on every table we seed ---------------------
ALTER TABLE public.clients           ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects          ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.quotes            ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.quote_lines       ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoices          ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.invoice_lines     ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.services          ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.calendar_events   ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.todos             ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.team_members      ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.planning_events   ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.document_folders  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.document_files    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 3. Seed function ---------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_demo_data_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- contacts
  v_client1 uuid; v_client2 uuid; v_prospect uuid; v_prestataire uuid;
  -- projects
  v_project1 uuid; v_project2 uuid; v_project3 uuid; v_project4 uuid;
  -- team
  v_team1 uuid; v_team2 uuid;
  -- quotes/invoices
  v_quote1 uuid; v_quote2 uuid;
  v_invoice1 uuid; v_invoice2 uuid;
  -- reference dates
  v_today date := CURRENT_DATE;
  -- Per-user suffix so quote/invoice numbers are globally unique
  -- (quotes.quote_number and invoices.invoice_number are UNIQUE across the whole table).
  v_suffix text := substr(replace(p_user_id::text, '-', ''), 1, 8);
  v_year text := to_char(now(), 'YYYY');
BEGIN
  -- Idempotency: skip if user already has demo data
  IF EXISTS (SELECT 1 FROM public.clients WHERE user_id = p_user_id AND is_demo = true) THEN
    RETURN;
  END IF;

  -- ---- CONTACTS (4) ----
  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES
    (p_user_id, 'Dupont Martin', 'martin.dupont@exemple.fr', '06 12 34 56 78', '15 rue de la Republique', 'Paris', '75011', 'client', 'Renovation complete appartement 3 pieces', 'bouche_a_oreille', true, now() - interval '20 days')
  RETURNING id INTO v_client1;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES
    (p_user_id, 'Garcia Sophie', 'sophie.garcia@exemple.fr', '06 23 45 67 89', '42 avenue Jean Jaures', 'Lyon', '69007', 'client', 'Amenagement cuisine ouverte', 'site_web', true, now() - interval '12 days')
  RETURNING id INTO v_client2;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES
    (p_user_id, 'Leroy Thomas', 'thomas.leroy@exemple.fr', '06 34 56 78 90', '8 boulevard Gambetta', 'Marseille', '13001', 'prospect', 'Demande de devis pour refection toiture', 'google', true, now() - interval '5 days')
  RETURNING id INTO v_prospect;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES
    (p_user_id, 'ElectroPro SARL', 'contact@electropro.fr', '04 91 22 33 44', '120 rue des Artisans', 'Bordeaux', '33000', 'prestataire', 'Electricien partenaire, disponible sur chantiers complexes', '', true, now() - interval '30 days')
  RETURNING id INTO v_prestataire;

  -- ---- EQUIPE (2 salaries) ----
  INSERT INTO public.team_members (user_id, name, role, type, status, phone, email, specialty, hourly_rate, weekly_hours, color, is_demo, created_at)
  VALUES
    (p_user_id, 'Karim Belkacem', 'Chef de chantier', 'salarie', 'actif', '06 45 67 89 01', 'karim.b@exemple.fr', 'Maconnerie', 22, 39, '#E97F2A', true, now() - interval '45 days')
  RETURNING id INTO v_team1;

  INSERT INTO public.team_members (user_id, name, role, type, status, phone, email, specialty, hourly_rate, weekly_hours, color, is_demo, created_at)
  VALUES
    (p_user_id, 'Lucas Moreau', 'Ouvrier polyvalent', 'salarie', 'actif', '06 56 78 90 12', 'lucas.m@exemple.fr', 'Peinture', 16, 35, '#2563eb', true, now() - interval '40 days')
  RETURNING id INTO v_team2;

  -- ---- PRESTATIONS (6) ----
  INSERT INTO public.services (user_id, name, description, unit, unit_price, category, tva_rate, is_active, is_demo, created_at) VALUES
    (p_user_id, 'Pose de carrelage', 'Fourniture et pose de carrelage sol/mur, joints compris', 'm2', 55, 'Carrelage', 10, true, true, now() - interval '60 days'),
    (p_user_id, 'Peinture murs et plafonds', 'Preparation, sous-couche et 2 couches de peinture acrylique', 'm2', 28, 'Peinture', 10, true, true, now() - interval '60 days'),
    (p_user_id, 'Installation plomberie SDB', 'Pose evier, douche, WC, raccordements', 'forfait', 1450, 'Plomberie', 10, true, true, now() - interval '60 days'),
    (p_user_id, 'Mise aux normes electriques', 'Tableau, prises, interrupteurs selon NF C 15-100', 'forfait', 2800, 'Electricite', 10, true, true, now() - interval '60 days'),
    (p_user_id, 'Pose cloison placo', 'Cloison 72 mm avec isolation laine de roche', 'm2', 62, 'Platrerie', 10, true, true, now() - interval '60 days'),
    (p_user_id, 'Renovation complete SDB', 'Demolition, plomberie, carrelage, peinture et accessoires', 'forfait', 8500, 'Renovation', 10, true, true, now() - interval '60 days');

  -- ---- CHANTIERS (4 avec geolocalisation) ----
  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES
    (p_user_id, 'Renovation appartement Dupont', v_client1, '15 rue de la Republique', 'Paris', '75011', 48.8612, 2.3820, 'en_cours', 45, v_today - interval '15 days', v_today + interval '20 days', 18500, 'Chantier en cours, phase peinture', true, now() - interval '18 days')
  RETURNING id INTO v_project1;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES
    (p_user_id, 'Cuisine Garcia', v_client2, '42 avenue Jean Jaures', 'Lyon', '69007', 45.7416, 4.8395, 'a_planifier', 10, v_today + interval '7 days', v_today + interval '30 days', 12400, 'Demarrage prevu la semaine prochaine', true, now() - interval '10 days')
  RETURNING id INTO v_project2;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES
    (p_user_id, 'Toiture Leroy', v_prospect, '8 boulevard Gambetta', 'Marseille', '13001', 43.2965, 5.3698, 'a_planifier', 0, v_today + interval '21 days', v_today + interval '45 days', 7200, 'En attente de validation du devis', true, now() - interval '4 days')
  RETURNING id INTO v_project3;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES
    (p_user_id, 'SDB ElectroPro', v_prestataire, '120 rue des Artisans', 'Bordeaux', '33000', 44.8378, -0.5792, 'termine', 100, v_today - interval '60 days', v_today - interval '20 days', 6800, 'Livre et receptionne', true, now() - interval '65 days')
  RETURNING id INTO v_project4;

  -- Mark auto-created project document folders as demo
  UPDATE public.document_folders
  SET is_demo = true
  WHERE project_id IN (v_project1, v_project2, v_project3, v_project4)
    AND source = 'project';

  -- ---- DEVIS (2) ----
  -- Devis 1: accepte, lie au chantier Dupont
  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES
    (p_user_id, 'D-' || v_year || '-' || v_suffix || '-01', v_client1, v_project1, 'Renovation appartement 3 pieces', 'Renovation complete appartement : peinture, carrelage, plomberie', 'accepte',
     16818, 10, 18500, v_today + interval '15 days', now() - interval '16 days', true, now() - interval '22 days')
  RETURNING id INTO v_quote1;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_quote1, 'Peinture murs et plafonds - 3 pieces', 85, 'm2', 28, 2380, 0, true),
    (p_user_id, v_quote1, 'Pose carrelage sejour et cuisine', 42, 'm2', 55, 2310, 1, true),
    (p_user_id, v_quote1, 'Renovation complete SDB', 1, 'forfait', 8500, 8500, 2, true),
    (p_user_id, v_quote1, 'Mise aux normes electriques', 1, 'forfait', 2800, 2800, 3, true),
    (p_user_id, v_quote1, 'Demolition et evacuation', 1, 'forfait', 828, 828, 4, true);

  -- Devis 2: envoye, lie au chantier Garcia
  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, is_demo, created_at)
  VALUES
    (p_user_id, 'D-' || v_year || '-' || v_suffix || '-02', v_client2, v_project2, 'Amenagement cuisine ouverte', 'Creation cuisine ouverte avec ilot central', 'envoye',
     11273, 10, 12400, v_today + interval '20 days', true, now() - interval '8 days')
  RETURNING id INTO v_quote2;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_quote2, 'Pose cloison placo separation', 18, 'm2', 62, 1116, 0, true),
    (p_user_id, v_quote2, 'Installation plomberie evier et lave-vaisselle', 1, 'forfait', 1450, 1450, 1, true),
    (p_user_id, v_quote2, 'Electricite : plaque, four, hotte, prises', 1, 'forfait', 2800, 2800, 2, true),
    (p_user_id, v_quote2, 'Carrelage sol cuisine', 22, 'm2', 55, 1210, 3, true),
    (p_user_id, v_quote2, 'Peinture finition', 55, 'm2', 28, 1540, 4, true),
    (p_user_id, v_quote2, 'Pose meubles cuisine et ilot', 1, 'forfait', 3157, 3157, 5, true);

  -- ---- FACTURES (2) ----
  -- Facture 1: payee, suite du devis 1
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES
    (p_user_id, 'F-' || v_year || '-' || v_suffix || '-01', v_quote1, v_client1, v_project1, 'Acompte chantier Dupont', 'payee',
     4545.45, 10, 5000, v_today - interval '5 days', now() - interval '3 days', 'virement', now() - interval '14 days', true, now() - interval '14 days')
  RETURNING id INTO v_invoice1;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_invoice1, 'Acompte 30% chantier Dupont', 1, 'forfait', 4545.45, 4545.45, 0, true);

  -- Facture 2: envoyee, chantier SDB termine
  INSERT INTO public.invoices (user_id, invoice_number, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, issued_at, is_demo, created_at)
  VALUES
    (p_user_id, 'F-' || v_year || '-' || v_suffix || '-02', v_prestataire, v_project4, 'Solde SDB ElectroPro', 'envoyee',
     6181.82, 10, 6800, v_today + interval '10 days', now() - interval '18 days', true, now() - interval '18 days')
  RETURNING id INTO v_invoice2;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_invoice2, 'Renovation complete SDB', 1, 'forfait', 6181.82, 6181.82, 0, true);

  -- ---- CALENDRIER (5 evenements) ----
  -- Categories must match EVENT_CATEGORIES in app/(app)/calendrier/page.tsx
  INSERT INTO public.calendar_events (user_id, title, description, category, start_date, end_date, start_time, end_time, color, client_id, is_demo) VALUES
    (p_user_id, 'Rdv metré appartement Dupont', 'Visite pour prise de mesures complementaires', 'rdv_client', v_today - interval '2 days', v_today - interval '2 days', '10:00', '11:30', '#3b82f6', v_client1, true),
    (p_user_id, 'Visite chantier Garcia', 'Point avant demarrage travaux', 'visite_chantier', v_today + interval '3 days', v_today + interval '3 days', '14:00', '15:30', '#f59e0b', v_client2, true),
    (p_user_id, 'Rdv prospect Leroy', 'Presentation devis toiture', 'commercial', v_today + interval '5 days', v_today + interval '5 days', '09:30', '10:30', '#10b981', v_prospect, true),
    (p_user_id, 'Livraison materiel chantier Dupont', 'Reception carrelage et peinture', 'rdv_fournisseur', v_today + interval '1 day', v_today + interval '1 day', '08:00', '09:00', '#8b5cf6', v_client1, true),
    (p_user_id, 'Reunion equipe hebdo', 'Point avancement chantiers', 'administratif', v_today + interval '7 days', v_today + interval '7 days', '08:00', '09:00', '#6b7280', NULL, true);

  -- ---- TACHES (5) ----
  INSERT INTO public.todos (user_id, title, description, priority, category, due_date, completed, completed_at, position, client_id, is_demo, created_at) VALUES
    (p_user_id, 'Commander le carrelage pour Dupont', 'Verifier stock et delai de livraison', 'haute', 'achat', v_today + interval '1 day', false, NULL, 0, v_client1, true, now() - interval '3 days'),
    (p_user_id, 'Relancer Garcia pour signature devis', 'Devis envoye il y a 8 jours', 'moyenne', 'client', v_today + interval '2 days', false, NULL, 1, v_client2, true, now() - interval '2 days'),
    (p_user_id, 'Preparer devis toiture Leroy', 'Calculer surface et materiaux', 'haute', 'administratif', v_today + interval '3 days', false, NULL, 2, v_prospect, true, now() - interval '1 day'),
    (p_user_id, 'Envoyer facture acompte Dupont', 'Facture payee', 'moyenne', 'administratif', v_today - interval '14 days', true, now() - interval '14 days', 3, v_client1, true, now() - interval '15 days'),
    (p_user_id, 'Verifier reception chantier ElectroPro', 'Controle final avant livraison', 'basse', 'chantier', v_today - interval '20 days', true, now() - interval '20 days', 4, v_prestataire, true, now() - interval '25 days');

  -- ---- PLANNING (4 evenements equipe) ----
  INSERT INTO public.planning_events (user_id, title, project_id, team_member_id, event_type, start_date, end_date, all_day, notes, is_demo) VALUES
    (p_user_id, 'Chantier Dupont - peinture', v_project1, v_team2, 'chantier', v_today, v_today + interval '3 days', true, 'Peinture salon et chambres', true),
    (p_user_id, 'Chantier Dupont - carrelage', v_project1, v_team1, 'chantier', v_today + interval '4 days', v_today + interval '7 days', true, 'Pose carrelage sejour', true),
    (p_user_id, 'Demarrage Garcia', v_project2, v_team1, 'chantier', v_today + interval '8 days', v_today + interval '12 days', true, 'Demolition et cloisons', true),
    (p_user_id, 'RDV prospect Leroy', v_project3, v_team1, 'autre', v_today + interval '5 days', v_today + interval '5 days', true, 'Metré et devis', true);

  -- ---- DOCUMENTS: root folder "Bienvenue" ----
  -- The PDF file row is created by the /api/demo/bootstrap-documents route,
  -- which also copies the shared welcome PDF into the user's storage folder.
  INSERT INTO public.document_folders (user_id, parent_id, project_id, source, visibility, name, is_demo)
  VALUES (p_user_id, NULL, NULL, 'manual', 'private', 'Bienvenue', true)
  ON CONFLICT DO NOTHING;

  -- ---- Mark demo as active on profile ----
  UPDATE public.profiles
  SET demo_active = true,
      demo_intro_seen = false
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_data_for_user(uuid) TO service_role;

-- 4. Clear function --------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_demo_data_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Order matters only for FK-cascade clarity; most FKs have ON DELETE CASCADE.
  DELETE FROM public.planning_events  WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.calendar_events  WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.todos            WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.invoice_lines    WHERE is_demo = true AND invoice_id IN (SELECT id FROM public.invoices WHERE user_id = p_user_id AND is_demo = true);
  DELETE FROM public.invoices         WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.quote_lines      WHERE is_demo = true AND quote_id IN (SELECT id FROM public.quotes WHERE user_id = p_user_id AND is_demo = true);
  DELETE FROM public.quotes           WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.document_files   WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.document_folders WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.projects         WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.services         WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.team_members     WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.clients          WHERE user_id = p_user_id AND is_demo = true;

  UPDATE public.profiles
  SET demo_active = false,
      demo_intro_seen = true
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_demo_data_for_user(uuid) TO service_role;

-- 5. Hook into handle_new_user --------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited_email text := lower(coalesce(NEW.email, ''));
  has_pending_invite boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_memberships wm
    WHERE wm.invited_email = v_invited_email
      AND wm.member_user_id IS NULL
      AND wm.status = 'pending'
  )
  INTO has_pending_invite;

  INSERT INTO public.profiles (id, onboarding_completed)
  VALUES (NEW.id, has_pending_invite)
  ON CONFLICT (id) DO UPDATE
    SET onboarding_completed = public.profiles.onboarding_completed OR EXCLUDED.onboarding_completed;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_reminder_settings') THEN
    EXECUTE 'INSERT INTO public.business_reminder_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING' USING NEW.id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_ai_agents_for_user') THEN
    EXECUTE 'SELECT public.seed_ai_agents_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_lead_sources_for_user') THEN
    EXECUTE 'SELECT public.seed_default_lead_sources_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_default_lead_stages_for_user') THEN
    EXECUTE 'SELECT public.seed_default_lead_stages_for_user($1)' USING NEW.id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'seed_expense_categories_for_user') THEN
    EXECUTE 'SELECT public.seed_expense_categories_for_user($1)' USING NEW.id;
  END IF;

  UPDATE public.workspace_memberships
  SET member_user_id = NEW.id,
      status = 'active',
      accepted_at = now(),
      updated_at = now()
  WHERE invited_email = v_invited_email
    AND member_user_id IS NULL
    AND status = 'pending';

  -- Seed demo data only if the user has NOT joined via an existing workspace invite
  IF NOT has_pending_invite THEN
    BEGIN
      PERFORM public.seed_demo_data_for_user(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      -- Never let demo seeding break the signup flow
      RAISE WARNING 'seed_demo_data_for_user failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 6. Storage read policy for the shared demo PDF ---------------
-- The /api/demo/bootstrap-documents route copies this file into
-- each user's own folder, so the shared original only needs to be
-- readable by the service role. No extra policy needed here.
