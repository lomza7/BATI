-- ============================================================
-- Demo seed v2: historical 4-month dataset
--
-- Rewrites seed_demo_data_for_user so that new signups get data
-- spread across the last 4 calendar months (M-3 .. current month).
-- The goal is to have a populated dashboard with a visible trend
-- on all charts (revenue, devis, factures, depenses).
--
-- Also marks `expenses` with is_demo so clear_demo_data_for_user
-- can clean them up with the rest.
-- ============================================================

-- 0. Add is_demo column to expenses ---------------------------
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 1. Rewrite seed function ------------------------------------
CREATE OR REPLACE FUNCTION public.seed_demo_data_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- contacts
  v_c1 uuid; v_c2 uuid; v_c3 uuid; v_c4 uuid; v_c5 uuid;
  v_c6 uuid; v_c7 uuid; v_c8 uuid; v_c9 uuid; v_c10 uuid;
  v_prospect uuid; v_prestataire uuid;
  -- projects
  v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid; v_p5 uuid;
  v_p6 uuid; v_p7 uuid; v_p8 uuid; v_p9 uuid; v_p10 uuid;
  -- team
  v_team1 uuid; v_team2 uuid;
  -- quotes
  v_q1 uuid; v_q2 uuid; v_q3 uuid; v_q4 uuid; v_q5 uuid;
  v_q6 uuid; v_q7 uuid; v_q8 uuid; v_q9 uuid; v_q10 uuid;
  -- invoices
  v_inv1 uuid; v_inv2 uuid; v_inv3 uuid; v_inv4 uuid; v_inv5 uuid;
  v_inv6 uuid; v_inv7 uuid; v_inv8 uuid; v_inv9 uuid; v_inv10 uuid;
  -- expense categories
  v_cat_materiaux uuid; v_cat_carburant uuid; v_cat_outillage uuid;
  v_cat_assurances uuid; v_cat_telephone uuid; v_cat_vehicule uuid;
  v_cat_loyer uuid; v_cat_sous_traitance uuid;
  -- reference dates — first day of each of the last 4 calendar months
  v_m1 timestamptz := date_trunc('month', now()) - interval '3 months'; -- e.g. Jan 1
  v_m2 timestamptz := date_trunc('month', now()) - interval '2 months'; -- e.g. Feb 1
  v_m3 timestamptz := date_trunc('month', now()) - interval '1 month';  -- e.g. Mar 1
  v_m4 timestamptz := date_trunc('month', now());                        -- e.g. Apr 1
  v_today date := CURRENT_DATE;
  -- Per-user suffix so quote/invoice numbers are globally unique
  v_suffix text := substr(replace(p_user_id::text, '-', ''), 1, 8);
  v_year text := to_char(now(), 'YYYY');
BEGIN
  -- Idempotency: skip if the user already has demo data
  IF EXISTS (SELECT 1 FROM public.clients WHERE user_id = p_user_id AND is_demo = true) THEN
    RETURN;
  END IF;

  -- ============================================================
  -- CONTACTS (10 clients + 1 prospect + 1 prestataire)
  -- Creation dates are distributed across the 4 months.
  -- ============================================================
  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Dupont Martin', 'martin.dupont@exemple.fr', '06 12 34 56 78', '15 rue de la Republique', 'Paris', '75011', 'client', 'Renovation appartement 3 pieces', 'bouche_a_oreille', true, v_m1 + interval '2 days')
  RETURNING id INTO v_c1;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Bernard Claire', 'claire.bernard@exemple.fr', '06 23 45 67 89', '12 rue Victor Hugo', 'Lyon', '69003', 'client', 'Refection salle de bain', 'google', true, v_m1 + interval '10 days')
  RETURNING id INTO v_c2;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Martinez Paulo', 'paulo.martinez@exemple.fr', '06 34 56 78 90', '8 rue Saint-Ferreol', 'Marseille', '13001', 'client', 'Peinture interieure maison', 'site_web', true, v_m1 + interval '22 days')
  RETURNING id INTO v_c3;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Garcia Sophie', 'sophie.garcia@exemple.fr', '06 45 67 89 01', '42 avenue Jean Jaures', 'Lyon', '69007', 'client', 'Amenagement cuisine ouverte', 'site_web', true, v_m2 + interval '3 days')
  RETURNING id INTO v_c4;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Petit Emilie', 'emilie.petit@exemple.fr', '06 56 78 90 12', '27 rue Crebillon', 'Nantes', '44000', 'client', 'Extension veranda', 'facebook', true, v_m2 + interval '12 days')
  RETURNING id INTO v_c5;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Roux Olivier', 'olivier.roux@exemple.fr', '06 67 89 01 23', '5 allee des Soupirs', 'Toulouse', '31000', 'client', 'Renovation toiture et zinguerie', 'bouche_a_oreille', true, v_m2 + interval '20 days')
  RETURNING id INTO v_c6;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Moreau Julien', 'julien.moreau@exemple.fr', '06 78 90 12 34', '120 cours de l Intendance', 'Bordeaux', '33000', 'client', 'Isolation combles perdus', 'google', true, v_m3 + interval '4 days')
  RETURNING id INTO v_c7;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Fabre Isabelle', 'isabelle.fabre@exemple.fr', '06 89 01 23 45', '18 promenade des Anglais', 'Nice', '06000', 'client', 'Renovation complete T4', 'site_web', true, v_m3 + interval '14 days')
  RETURNING id INTO v_c8;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Simon Nadia', 'nadia.simon@exemple.fr', '06 90 12 34 56', '33 rue du Dome', 'Strasbourg', '67000', 'client', 'Carrelage sol rez-de-chaussee', 'google', true, v_m3 + interval '24 days')
  RETURNING id INTO v_c9;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Lopez Carlos', 'carlos.lopez@exemple.fr', '06 01 23 45 67', '7 place du Parlement', 'Rennes', '35000', 'client', 'Amenagement bureau a domicile', 'bouche_a_oreille', true, v_m4 + interval '2 days')
  RETURNING id INTO v_c10;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'Leroy Thomas', 'thomas.leroy@exemple.fr', '06 11 22 33 44', '8 boulevard Gambetta', 'Marseille', '13005', 'prospect', 'Demande de devis pour refection toiture', 'google', true, v_m4 + interval '4 days')
  RETURNING id INTO v_prospect;

  INSERT INTO public.clients (user_id, name, email, phone, address, city, postal_code, contact_type, notes, source, is_demo, created_at)
  VALUES (p_user_id, 'ElectroPro SARL', 'contact@electropro.fr', '04 91 22 33 44', '120 rue des Artisans', 'Bordeaux', '33000', 'prestataire', 'Electricien partenaire', '', true, v_m1 - interval '5 days')
  RETURNING id INTO v_prestataire;

  -- ============================================================
  -- EQUIPE (2 salaries)
  -- ============================================================
  INSERT INTO public.team_members (user_id, name, role, type, status, phone, email, specialty, hourly_rate, weekly_hours, color, is_demo, created_at)
  VALUES (p_user_id, 'Karim Belkacem', 'Chef de chantier', 'salarie', 'actif', '06 45 67 89 01', 'karim.b@exemple.fr', 'Maconnerie', 22, 39, '#E97F2A', true, v_m1 - interval '10 days')
  RETURNING id INTO v_team1;

  INSERT INTO public.team_members (user_id, name, role, type, status, phone, email, specialty, hourly_rate, weekly_hours, color, is_demo, created_at)
  VALUES (p_user_id, 'Lucas Moreau', 'Ouvrier polyvalent', 'salarie', 'actif', '06 56 78 90 12', 'lucas.m@exemple.fr', 'Peinture', 16, 35, '#2563eb', true, v_m1 - interval '8 days')
  RETURNING id INTO v_team2;

  -- ============================================================
  -- PRESTATIONS (8)
  -- ============================================================
  INSERT INTO public.services (user_id, name, description, unit, unit_price, category, tva_rate, is_active, is_demo, created_at) VALUES
    (p_user_id, 'Pose de carrelage', 'Fourniture et pose de carrelage sol/mur, joints compris', 'm2', 55, 'Carrelage', 10, true, true, v_m1 - interval '15 days'),
    (p_user_id, 'Peinture murs et plafonds', 'Preparation, sous-couche et 2 couches', 'm2', 28, 'Peinture', 10, true, true, v_m1 - interval '15 days'),
    (p_user_id, 'Installation plomberie SDB', 'Pose evier, douche, WC, raccordements', 'forfait', 1450, 'Plomberie', 10, true, true, v_m1 - interval '15 days'),
    (p_user_id, 'Mise aux normes electriques', 'Tableau, prises, interrupteurs NF C 15-100', 'forfait', 2800, 'Electricite', 10, true, true, v_m1 - interval '15 days'),
    (p_user_id, 'Pose cloison placo', 'Cloison 72 mm avec isolation laine de roche', 'm2', 62, 'Platrerie', 10, true, true, v_m1 - interval '15 days'),
    (p_user_id, 'Renovation complete SDB', 'Demolition, plomberie, carrelage, peinture, accessoires', 'forfait', 8500, 'Renovation', 10, true, true, v_m1 - interval '15 days'),
    (p_user_id, 'Isolation combles', 'Laine de verre soufflee 30 cm', 'm2', 42, 'Isolation', 10, true, true, v_m1 - interval '15 days'),
    (p_user_id, 'Refection toiture', 'Depose et pose tuiles + ecran sous-toiture', 'm2', 85, 'Toiture', 10, true, true, v_m1 - interval '15 days');

  -- ============================================================
  -- CHANTIERS (10) — distributed across 4 months
  -- ============================================================
  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Renovation appartement Dupont', v_c1, '15 rue de la Republique', 'Paris', '75011', 48.8612, 2.3820, 'termine', 100, (v_m1 + interval '5 days')::date, (v_m1 + interval '28 days')::date, 5500, 'Chantier livre et receptionne', true, v_m1 + interval '3 days')
  RETURNING id INTO v_p1;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'SDB Bernard', v_c2, '12 rue Victor Hugo', 'Lyon', '69003', 45.7597, 4.8422, 'termine', 100, (v_m1 + interval '15 days')::date, (v_m2 + interval '5 days')::date, 4800, 'Salle de bain refaite a neuf', true, v_m1 + interval '12 days')
  RETURNING id INTO v_p2;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Peinture Martinez', v_c3, '8 rue Saint-Ferreol', 'Marseille', '13001', 43.2965, 5.3698, 'termine', 100, (v_m1 + interval '24 days')::date, (v_m2 + interval '14 days')::date, 6200, 'Interieur complet maison', true, v_m1 + interval '23 days')
  RETURNING id INTO v_p3;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Cuisine Garcia', v_c4, '42 avenue Jean Jaures', 'Lyon', '69007', 45.7416, 4.8395, 'termine', 100, (v_m2 + interval '5 days')::date, (v_m2 + interval '26 days')::date, 3800, 'Cuisine ouverte installee', true, v_m2 + interval '4 days')
  RETURNING id INTO v_p4;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Veranda Petit', v_c5, '27 rue Crebillon', 'Nantes', '44000', 47.2173, -1.5534, 'en_cours', 65, (v_m2 + interval '14 days')::date, (v_m4 + interval '10 days')::date, 5400, 'Extension veranda en cours', true, v_m2 + interval '13 days')
  RETURNING id INTO v_p5;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Toiture Roux', v_c6, '5 allee des Soupirs', 'Toulouse', '31000', 43.6047, 1.4442, 'termine', 100, (v_m2 + interval '22 days')::date, (v_m3 + interval '12 days')::date, 4900, 'Refection toiture complete', true, v_m2 + interval '21 days')
  RETURNING id INTO v_p6;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Isolation Moreau', v_c7, '120 cours de l Intendance', 'Bordeaux', '33000', 44.8378, -0.5792, 'en_cours', 45, (v_m3 + interval '6 days')::date, (v_m4 + interval '5 days')::date, 5200, 'Isolation combles en cours', true, v_m3 + interval '5 days')
  RETURNING id INTO v_p7;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Renovation T4 Fabre', v_c8, '18 promenade des Anglais', 'Nice', '06000', 43.6947, 7.2657, 'en_cours', 80, (v_m3 + interval '16 days')::date, (v_m4 + interval '3 days')::date, 8100, 'Renovation complete en phase finale', true, v_m3 + interval '15 days')
  RETURNING id INTO v_p8;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Carrelage Simon', v_c9, '33 rue du Dome', 'Strasbourg', '67000', 48.5816, 7.7507, 'en_cours', 30, (v_m3 + interval '26 days')::date, (v_m4 + interval '15 days')::date, 6300, 'Pose carrelage rez-de-chaussee', true, v_m3 + interval '25 days')
  RETURNING id INTO v_p9;

  INSERT INTO public.projects (user_id, name, client_id, address, city, postal_code, lat, lng, status, progress, start_date, end_date, budget, notes, is_demo, created_at)
  VALUES (p_user_id, 'Bureau Lopez', v_c10, '7 place du Parlement', 'Rennes', '35000', 48.1113, -1.6800, 'a_planifier', 10, (v_m4 + interval '12 days')::date, (v_m4 + interval '30 days')::date, 4500, 'Amenagement bureau a domicile', true, v_m4 + interval '3 days')
  RETURNING id INTO v_p10;

  -- Mark auto-created project document folders as demo
  UPDATE public.document_folders
  SET is_demo = true
  WHERE project_id IN (v_p1, v_p2, v_p3, v_p4, v_p5, v_p6, v_p7, v_p8, v_p9, v_p10)
    AND source = 'project';

  -- ============================================================
  -- DEVIS (10) — distributed across 4 months
  -- ============================================================
  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-01', v_c1, v_p1, 'Renovation appartement 3 pieces', 'Peinture, carrelage et plomberie', 'accepte',
    5000, 10, 5500, (v_m1 + interval '32 days')::date, v_m1 + interval '4 days', true, v_m1 + interval '2 days')
  RETURNING id INTO v_q1;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q1, 'Peinture murs et plafonds', 50, 'm2', 28, 1400, 0, true),
    (p_user_id, v_q1, 'Pose carrelage sejour', 25, 'm2', 55, 1375, 1, true),
    (p_user_id, v_q1, 'Installation plomberie SDB', 1, 'forfait', 1450, 1450, 2, true),
    (p_user_id, v_q1, 'Petits travaux divers', 1, 'forfait', 775, 775, 3, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-02', v_c2, v_p2, 'Refection salle de bain', 'SDB complete', 'accepte',
    4364, 10, 4800, (v_m2 + interval '10 days')::date, v_m1 + interval '14 days', true, v_m1 + interval '11 days')
  RETURNING id INTO v_q2;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q2, 'Renovation complete SDB', 1, 'forfait', 4364, 4364, 0, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-03', v_c3, v_p3, 'Peinture interieure maison', 'Peinture complete', 'accepte',
    5636, 10, 6200, (v_m2 + interval '20 days')::date, v_m1 + interval '25 days', true, v_m1 + interval '23 days')
  RETURNING id INTO v_q3;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q3, 'Peinture murs et plafonds', 200, 'm2', 28, 5600, 0, true),
    (p_user_id, v_q3, 'Petits travaux de preparation', 1, 'forfait', 36, 36, 1, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-04', v_c4, v_p4, 'Amenagement cuisine ouverte', 'Cuisine avec ilot', 'accepte',
    3455, 10, 3800, (v_m3 + interval '5 days')::date, v_m2 + interval '6 days', true, v_m2 + interval '4 days')
  RETURNING id INTO v_q4;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q4, 'Pose cloison placo', 15, 'm2', 62, 930, 0, true),
    (p_user_id, v_q4, 'Installation plomberie cuisine', 1, 'forfait', 1450, 1450, 1, true),
    (p_user_id, v_q4, 'Pose carrelage cuisine', 18, 'm2', 55, 990, 2, true),
    (p_user_id, v_q4, 'Finitions peinture', 3, 'forfait', 28, 85, 3, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-05', v_c5, v_p5, 'Extension veranda', 'Veranda 15m2', 'accepte',
    4909, 10, 5400, (v_m3 + interval '15 days')::date, v_m2 + interval '14 days', true, v_m2 + interval '13 days')
  RETURNING id INTO v_q5;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q5, 'Fondations et dalle', 1, 'forfait', 1200, 1200, 0, true),
    (p_user_id, v_q5, 'Structure et pose veranda', 1, 'forfait', 2800, 2800, 1, true),
    (p_user_id, v_q5, 'Electricite integree', 1, 'forfait', 909, 909, 2, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-06', v_c6, v_p6, 'Refection toiture', 'Toiture complete + zinguerie', 'accepte',
    4455, 10, 4900, (v_m3 + interval '22 days')::date, v_m2 + interval '23 days', true, v_m2 + interval '21 days')
  RETURNING id INTO v_q6;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q6, 'Refection toiture', 50, 'm2', 85, 4250, 0, true),
    (p_user_id, v_q6, 'Zinguerie et finitions', 1, 'forfait', 205, 205, 1, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-07', v_c7, v_p7, 'Isolation combles perdus', 'Isolation soufflee 30cm', 'accepte',
    4727, 10, 5200, (v_m4 + interval '5 days')::date, v_m3 + interval '6 days', true, v_m3 + interval '4 days')
  RETURNING id INTO v_q7;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q7, 'Isolation combles', 110, 'm2', 42, 4620, 0, true),
    (p_user_id, v_q7, 'Depose isolation existante', 1, 'forfait', 107, 107, 1, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-08', v_c8, v_p8, 'Renovation complete T4', 'Renovation appartement 4 pieces', 'accepte',
    7364, 10, 8100, (v_m4 + interval '15 days')::date, v_m3 + interval '16 days', true, v_m3 + interval '14 days')
  RETURNING id INTO v_q8;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q8, 'Renovation complete SDB', 1, 'forfait', 3500, 3500, 0, true),
    (p_user_id, v_q8, 'Peinture 4 pieces', 120, 'm2', 28, 3360, 1, true),
    (p_user_id, v_q8, 'Petits travaux', 1, 'forfait', 504, 504, 2, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-09', v_c9, v_p9, 'Carrelage rez-de-chaussee', 'Pose 80m2 + plinthes', 'accepte',
    5727, 10, 6300, (v_m4 + interval '26 days')::date, v_m3 + interval '26 days', true, v_m3 + interval '24 days')
  RETURNING id INTO v_q9;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q9, 'Pose de carrelage', 80, 'm2', 55, 4400, 0, true),
    (p_user_id, v_q9, 'Depose ancien revetement', 1, 'forfait', 800, 800, 1, true),
    (p_user_id, v_q9, 'Plinthes et joints', 1, 'forfait', 527, 527, 2, true);

  INSERT INTO public.quotes (user_id, quote_number, client_id, project_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-10', v_c10, v_p10, 'Amenagement bureau a domicile', 'Cloisonnage et finitions', 'envoye',
    4091, 10, 4500, (v_m4 + interval '28 days')::date, true, v_m4 + interval '3 days')
  RETURNING id INTO v_q10;

  INSERT INTO public.quote_lines (user_id, quote_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_q10, 'Pose cloison placo', 20, 'm2', 62, 1240, 0, true),
    (p_user_id, v_q10, 'Mise aux normes electriques', 1, 'forfait', 2000, 2000, 1, true),
    (p_user_id, v_q10, 'Peinture finition', 30, 'm2', 28, 840, 2, true),
    (p_user_id, v_q10, 'Petits travaux', 1, 'forfait', 11, 11, 3, true);

  -- Two extra quotes for pipeline realism
  INSERT INTO public.quotes (user_id, quote_number, client_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-11', v_prospect, 'Refection toiture Leroy', 'Devis en preparation', 'brouillon',
    6364, 10, 7000, (v_m4 + interval '30 days')::date, true, v_m4 + interval '5 days');

  INSERT INTO public.quotes (user_id, quote_number, client_id, title, description, status, total_ht, tva_rate, total_ttc, valid_until, is_demo, created_at)
  VALUES (p_user_id, 'D-' || v_year || '-' || v_suffix || '-12', v_prospect, 'Extension garage', 'Devis refuse', 'refuse',
    8182, 10, 9000, (v_m3 + interval '30 days')::date, true, v_m3 + interval '8 days');

  -- ============================================================
  -- FACTURES (10) — distributed across 4 months
  -- Revenue progression: Jan ~5k, Feb ~10k, Mar ~15k, Apr ~22k
  -- ============================================================
  -- F1: Dupont (Jan issue → Jan paid)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-01', v_q1, v_c1, v_p1, 'Facture chantier Dupont', 'payee',
    5000, 10, 5500, (v_m2 + interval '1 day')::date, v_m1 + interval '28 days', 'virement', v_m1 + interval '24 days', true, v_m1 + interval '24 days')
  RETURNING id INTO v_inv1;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv1, 'Renovation appartement Dupont (solde)', 1, 'forfait', 5000, 5000, 0, true);

  -- F2: Bernard (Feb issue → Feb paid)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-02', v_q2, v_c2, v_p2, 'Facture SDB Bernard', 'payee',
    4364, 10, 4800, (v_m2 + interval '28 days')::date, v_m2 + interval '10 days', 'virement', v_m2 + interval '6 days', true, v_m2 + interval '6 days')
  RETURNING id INTO v_inv2;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv2, 'Renovation SDB Bernard', 1, 'forfait', 4364, 4364, 0, true);

  -- F3: Martinez (Feb issue → Feb paid)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-03', v_q3, v_c3, v_p3, 'Facture peinture Martinez', 'payee',
    5636, 10, 6200, (v_m3 + interval '5 days')::date, v_m2 + interval '24 days', 'virement', v_m2 + interval '16 days', true, v_m2 + interval '16 days')
  RETURNING id INTO v_inv3;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv3, 'Peinture interieure maison Martinez', 1, 'forfait', 5636, 5636, 0, true);

  -- F4: Garcia (Feb issue → Mar paid, acompte)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-04', v_q4, v_c4, v_p4, 'Facture cuisine Garcia', 'payee',
    3455, 10, 3800, (v_m3 + interval '12 days')::date, v_m3 + interval '3 days', 'cb', v_m2 + interval '27 days', true, v_m2 + interval '27 days')
  RETURNING id INTO v_inv4;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv4, 'Amenagement cuisine Garcia', 1, 'forfait', 3455, 3455, 0, true);

  -- F5: Petit (Mar issue → Mar paid, acompte veranda)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-05', v_q5, v_c5, v_p5, 'Acompte 50% veranda Petit', 'payee',
    2455, 10, 2700, (v_m3 + interval '20 days')::date, v_m3 + interval '13 days', 'virement', v_m3 + interval '5 days', true, v_m3 + interval '5 days')
  RETURNING id INTO v_inv5;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv5, 'Acompte 50% extension veranda', 1, 'forfait', 2455, 2455, 0, true);

  -- F6: Roux (Mar issue → Mar paid)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-06', v_q6, v_c6, v_p6, 'Facture toiture Roux', 'payee',
    4455, 10, 4900, (v_m3 + interval '28 days')::date, v_m3 + interval '24 days', 'virement', v_m3 + interval '13 days', true, v_m3 + interval '13 days')
  RETURNING id INTO v_inv6;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv6, 'Refection toiture Roux', 1, 'forfait', 4455, 4455, 0, true);

  -- F7: Moreau (Mar issue → Mar paid)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-07', v_q7, v_c7, v_p7, 'Acompte isolation Moreau', 'payee',
    4727, 10, 5200, (v_m4 + interval '2 days')::date, v_m3 + interval '29 days', 'virement', v_m3 + interval '22 days', true, v_m3 + interval '22 days')
  RETURNING id INTO v_inv7;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv7, 'Isolation combles Moreau', 1, 'forfait', 4727, 4727, 0, true);

  -- F8: Fabre (Mar issue → Apr paid, gros chantier)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-08', v_q8, v_c8, v_p8, 'Facture Renovation T4 Fabre', 'payee',
    7364, 10, 8100, (v_m4 + interval '8 days')::date, v_m4 + interval '3 days', 'virement', v_m3 + interval '28 days', true, v_m3 + interval '28 days')
  RETURNING id INTO v_inv8;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv8, 'Renovation complete T4 Fabre', 1, 'forfait', 7364, 7364, 0, true);

  -- F9: Simon (Apr issue → Apr paid, carrelage acompte)
  INSERT INTO public.invoices (user_id, invoice_number, quote_id, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, paid_at, payment_method, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-09', v_q9, v_c9, v_p9, 'Acompte carrelage Simon', 'payee',
    2864, 10, 3150, (v_m4 + interval '14 days')::date, v_m4 + interval '5 days', 'cb', v_m4 + interval '1 day', true, v_m4 + interval '1 day')
  RETURNING id INTO v_inv9;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv9, 'Acompte 50% carrelage Simon', 1, 'forfait', 2864, 2864, 0, true);

  -- F10: Simon solde en retard (Apr issue, en_retard pour realisme)
  INSERT INTO public.invoices (user_id, invoice_number, client_id, project_id, title, status, total_ht, tva_rate, total_ttc, due_date, issued_at, is_demo, created_at)
  VALUES (p_user_id, 'F-' || v_year || '-' || v_suffix || '-10', v_c5, v_p5, 'Solde veranda Petit', 'en_retard',
    2455, 10, 2700, (v_today - interval '3 days')::date, v_m3 + interval '28 days', true, v_m3 + interval '28 days')
  RETURNING id INTO v_inv10;

  INSERT INTO public.invoice_lines (user_id, invoice_id, description, quantity, unit, unit_price, total, position, is_demo) VALUES
    (p_user_id, v_inv10, 'Solde 50% veranda Petit', 1, 'forfait', 2455, 2455, 0, true);

  -- ============================================================
  -- DEPENSES (15) — distributed across 4 months
  -- ============================================================
  SELECT id INTO v_cat_materiaux     FROM public.expense_categories WHERE user_id = p_user_id AND slug = 'materiaux';
  SELECT id INTO v_cat_carburant     FROM public.expense_categories WHERE user_id = p_user_id AND slug = 'carburant';
  SELECT id INTO v_cat_outillage     FROM public.expense_categories WHERE user_id = p_user_id AND slug = 'outillage';
  SELECT id INTO v_cat_assurances    FROM public.expense_categories WHERE user_id = p_user_id AND slug = 'assurances';
  SELECT id INTO v_cat_telephone     FROM public.expense_categories WHERE user_id = p_user_id AND slug = 'telephone';
  SELECT id INTO v_cat_vehicule      FROM public.expense_categories WHERE user_id = p_user_id AND slug = 'vehicule';
  SELECT id INTO v_cat_loyer         FROM public.expense_categories WHERE user_id = p_user_id AND slug = 'loyer';
  SELECT id INTO v_cat_sous_traitance FROM public.expense_categories WHERE user_id = p_user_id AND slug = 'sous_traitance';

  INSERT INTO public.expenses (user_id, description, amount, amount_ht, tva_amount, tva_rate, category, expense_category_id, date, supplier, payment_method, project_id, is_demo, created_at) VALUES
    -- Janvier
    (p_user_id, 'Materiaux chantier Dupont', 960, 800, 160, 20, 'materiaux', v_cat_materiaux, (v_m1 + interval '6 days')::date, 'Point P Paris', 'cb', v_p1, true, v_m1 + interval '6 days'),
    (p_user_id, 'Carburant camionnette', 120, 100, 20, 20, 'deplacement', v_cat_carburant, (v_m1 + interval '12 days')::date, 'Station Total', 'cb', NULL, true, v_m1 + interval '12 days'),
    (p_user_id, 'Loyer atelier janvier', 600, 500, 100, 20, 'autre', v_cat_loyer, (v_m1 + interval '1 day')::date, 'SCI Hangar', 'prelevement', NULL, true, v_m1 + interval '1 day'),
    (p_user_id, 'Materiaux chantier Bernard', 1440, 1200, 240, 20, 'materiaux', v_cat_materiaux, (v_m1 + interval '18 days')::date, 'Saint-Maclou Lyon', 'cb', v_p2, true, v_m1 + interval '18 days'),
    -- Fevrier
    (p_user_id, 'Loyer atelier fevrier', 600, 500, 100, 20, 'autre', v_cat_loyer, (v_m2 + interval '1 day')::date, 'SCI Hangar', 'prelevement', NULL, true, v_m2 + interval '1 day'),
    (p_user_id, 'Materiaux chantier Martinez', 1800, 1500, 300, 20, 'materiaux', v_cat_materiaux, (v_m2 + interval '8 days')::date, 'Leroy Merlin', 'cb', v_p3, true, v_m2 + interval '8 days'),
    (p_user_id, 'Assurance RC Pro', 360, 300, 60, 20, 'assurance', v_cat_assurances, (v_m2 + interval '10 days')::date, 'AXA', 'prelevement', NULL, true, v_m2 + interval '10 days'),
    (p_user_id, 'Carburant + peages', 180, 150, 30, 20, 'deplacement', v_cat_carburant, (v_m2 + interval '20 days')::date, 'Station Shell', 'cb', NULL, true, v_m2 + interval '20 days'),
    -- Mars
    (p_user_id, 'Loyer atelier mars', 600, 500, 100, 20, 'autre', v_cat_loyer, (v_m3 + interval '1 day')::date, 'SCI Hangar', 'prelevement', NULL, true, v_m3 + interval '1 day'),
    (p_user_id, 'Materiaux veranda Petit', 2400, 2000, 400, 20, 'materiaux', v_cat_materiaux, (v_m3 + interval '7 days')::date, 'Gedimat Nantes', 'virement', v_p5, true, v_m3 + interval '7 days'),
    (p_user_id, 'Outillage : perceuse visseuse', 240, 200, 40, 20, 'autre', v_cat_outillage, (v_m3 + interval '14 days')::date, 'Bricorama', 'cb', NULL, true, v_m3 + interval '14 days'),
    (p_user_id, 'Sous-traitant zinguerie toiture Roux', 1200, 1000, 200, 20, 'sous_traitance', v_cat_sous_traitance, (v_m3 + interval '18 days')::date, 'Zingueur 31', 'virement', v_p6, true, v_m3 + interval '18 days'),
    (p_user_id, 'Carburant mars', 200, 167, 33, 20, 'deplacement', v_cat_carburant, (v_m3 + interval '22 days')::date, 'Station BP', 'cb', NULL, true, v_m3 + interval '22 days'),
    -- Avril (partiel)
    (p_user_id, 'Loyer atelier avril', 600, 500, 100, 20, 'autre', v_cat_loyer, (v_m4 + interval '1 day')::date, 'SCI Hangar', 'prelevement', NULL, true, v_m4 + interval '1 day'),
    (p_user_id, 'Materiaux carrelage Simon', 960, 800, 160, 20, 'materiaux', v_cat_materiaux, (v_m4 + interval '3 days')::date, 'Porcelanosa', 'cb', v_p9, true, v_m4 + interval '3 days');

  -- ============================================================
  -- CALENDRIER (7 evenements) — passes et futurs
  -- ============================================================
  INSERT INTO public.calendar_events (user_id, title, description, category, start_date, end_date, start_time, end_time, color, client_id, is_demo) VALUES
    (p_user_id, 'Rdv metré Dupont', 'Prise de mesures initiale', 'rdv_client', (v_m1 + interval '3 days')::date, (v_m1 + interval '3 days')::date, '10:00', '11:30', '#3b82f6', v_c1, true),
    (p_user_id, 'Rdv metré Bernard', 'Visite SDB', 'rdv_client', (v_m1 + interval '11 days')::date, (v_m1 + interval '11 days')::date, '14:00', '15:00', '#3b82f6', v_c2, true),
    (p_user_id, 'Reception chantier Garcia', 'Livraison cuisine', 'visite_chantier', (v_m2 + interval '26 days')::date, (v_m2 + interval '26 days')::date, '09:00', '10:30', '#f59e0b', v_c4, true),
    (p_user_id, 'Rdv prospect Leroy', 'Presentation devis toiture', 'commercial', (v_today + interval '3 days')::date, (v_today + interval '3 days')::date, '14:00', '15:00', '#10b981', v_prospect, true),
    (p_user_id, 'Visite chantier Moreau', 'Point avancement isolation', 'visite_chantier', (v_today + interval '1 day')::date, (v_today + interval '1 day')::date, '08:30', '09:30', '#f59e0b', v_c7, true),
    (p_user_id, 'Livraison materiaux Simon', 'Reception carrelage', 'rdv_fournisseur', (v_today + interval '2 days')::date, (v_today + interval '2 days')::date, '07:30', '08:30', '#8b5cf6', v_c9, true),
    (p_user_id, 'Reunion equipe hebdo', 'Point avancement chantiers', 'administratif', (v_today + interval '5 days')::date, (v_today + interval '5 days')::date, '08:00', '09:00', '#6b7280', NULL, true);

  -- ============================================================
  -- TACHES (10) — mix completed / pending sur les 4 mois
  -- ============================================================
  INSERT INTO public.todos (user_id, title, description, priority, category, due_date, completed, completed_at, position, client_id, is_demo, created_at) VALUES
    (p_user_id, 'Envoyer devis Dupont', 'Finaliser et envoyer', 'haute', 'administratif', (v_m1 + interval '2 days')::date, true, v_m1 + interval '2 days', 0, v_c1, true, v_m1 + interval '1 day'),
    (p_user_id, 'Commander materiaux chantier Dupont', 'Valider bon de commande', 'haute', 'achat', (v_m1 + interval '5 days')::date, true, v_m1 + interval '5 days', 1, v_c1, true, v_m1 + interval '4 days'),
    (p_user_id, 'Encaisser facture Bernard', 'Relance si besoin', 'moyenne', 'client', (v_m2 + interval '15 days')::date, true, v_m2 + interval '10 days', 2, v_c2, true, v_m2 + interval '6 days'),
    (p_user_id, 'Preparer devis Garcia', 'Chiffrer cuisine ouverte', 'moyenne', 'administratif', (v_m2 + interval '4 days')::date, true, v_m2 + interval '4 days', 3, v_c4, true, v_m2 + interval '3 days'),
    (p_user_id, 'Reception toiture Roux', 'Controle final', 'haute', 'chantier', (v_m3 + interval '12 days')::date, true, v_m3 + interval '12 days', 4, v_c6, true, v_m3 + interval '10 days'),
    (p_user_id, 'Relancer Moreau pour acompte', 'Devis accepte, attendre virement', 'moyenne', 'client', (v_m3 + interval '20 days')::date, true, v_m3 + interval '22 days', 5, v_c7, true, v_m3 + interval '15 days'),
    (p_user_id, 'Relancer Petit - facture en retard', 'Solde veranda non paye', 'haute', 'client', (v_today - interval '1 day')::date, false, NULL, 6, v_c5, true, v_today - interval '2 days'),
    (p_user_id, 'Commander carrelage Simon', 'Verifier stock et delai', 'haute', 'achat', (v_today + interval '1 day')::date, false, NULL, 7, v_c9, true, v_today - interval '1 day'),
    (p_user_id, 'Preparer devis Leroy (toiture)', 'Chiffrer apres metré', 'moyenne', 'administratif', (v_today + interval '4 days')::date, false, NULL, 8, v_prospect, true, v_today),
    (p_user_id, 'Planifier chantier Lopez', 'Demarrage prevu la semaine prochaine', 'moyenne', 'chantier', (v_today + interval '6 days')::date, false, NULL, 9, v_c10, true, v_today);

  -- ============================================================
  -- PLANNING (10 evenements equipe)
  -- ============================================================
  INSERT INTO public.planning_events (user_id, title, project_id, team_member_id, event_type, start_date, end_date, all_day, notes, is_demo) VALUES
    (p_user_id, 'Chantier Dupont - travaux', v_p1, v_team1, 'chantier', (v_m1 + interval '5 days')::date, (v_m1 + interval '12 days')::date, true, 'Gros oeuvre + peinture', true),
    (p_user_id, 'Chantier Dupont - finitions', v_p1, v_team2, 'chantier', (v_m1 + interval '15 days')::date, (v_m1 + interval '22 days')::date, true, 'Peinture et finitions', true),
    (p_user_id, 'Chantier Bernard SDB', v_p2, v_team1, 'chantier', (v_m1 + interval '15 days')::date, (v_m1 + interval '30 days')::date, true, 'SDB complete', true),
    (p_user_id, 'Chantier Martinez peinture', v_p3, v_team2, 'chantier', (v_m1 + interval '24 days')::date, (v_m2 + interval '12 days')::date, true, 'Peinture interieure', true),
    (p_user_id, 'Chantier Garcia cuisine', v_p4, v_team1, 'chantier', (v_m2 + interval '5 days')::date, (v_m2 + interval '25 days')::date, true, 'Cuisine ouverte', true),
    (p_user_id, 'Chantier Roux toiture', v_p6, v_team1, 'chantier', (v_m2 + interval '22 days')::date, (v_m3 + interval '10 days')::date, true, 'Refection toiture', true),
    (p_user_id, 'Chantier Fabre T4', v_p8, v_team2, 'chantier', (v_m3 + interval '16 days')::date, (v_m4 + interval '2 days')::date, true, 'Renovation complete T4', true),
    (p_user_id, 'Chantier Simon carrelage', v_p9, v_team1, 'chantier', (v_m4 + interval '1 day')::date, (v_m4 + interval '12 days')::date, true, 'Pose carrelage', true),
    (p_user_id, 'Chantier Moreau isolation', v_p7, v_team2, 'chantier', (v_m4 + interval '3 days')::date, (v_m4 + interval '8 days')::date, true, 'Finition isolation', true),
    (p_user_id, 'Rdv prospect Leroy', v_p10, v_team1, 'autre', (v_today + interval '3 days')::date, (v_today + interval '3 days')::date, true, 'Visite + metré', true);

  -- ============================================================
  -- DOCUMENTS: root folder "Bienvenue"
  -- ============================================================
  INSERT INTO public.document_folders (user_id, parent_id, project_id, source, visibility, name, is_demo)
  VALUES (p_user_id, NULL, NULL, 'manual', 'private', 'Bienvenue', true)
  ON CONFLICT DO NOTHING;

  -- ============================================================
  -- Mark demo as active on profile
  -- ============================================================
  UPDATE public.profiles
  SET demo_active = true,
      demo_intro_seen = false
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_data_for_user(uuid) TO service_role;

-- 2. Update clear function to also clean expenses --------------
CREATE OR REPLACE FUNCTION public.clear_demo_data_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.planning_events  WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.calendar_events  WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.todos            WHERE user_id = p_user_id AND is_demo = true;
  DELETE FROM public.expenses         WHERE user_id = p_user_id AND is_demo = true;
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
