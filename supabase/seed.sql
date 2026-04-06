-- ============================================================
-- Seed data for local development / testing
-- Run: supabase db seed
-- ============================================================
-- NOTE: This seed creates test users via auth.users directly.
-- In local dev, Supabase's auth schema is accessible for seeding.
-- Do NOT run this against staging or production.
--
-- 3 artisans BTP :
--   Jean Dupont     — Plombier,      Dupont Plomberie,   Lyon 69003
--   Marie Lefèvre   — Électricienne, Lefèvre Élec,       Marseille 13001
--   Karim Bensaïd   — Maçon,         BenBat Construction, Paris 75011
-- ============================================================

-- ============================================================
-- AUTH USERS
-- ============================================================

-- Jean Dupont — artisan1@hellobat.test / TestPassword123!
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at, role, aud
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'artisan1@hellobat.test',
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  '{"full_name": "Jean Dupont"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
) on conflict (id) do nothing;

-- Marie Lefèvre — artisan2@hellobat.test / TestPassword123!
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at, role, aud
) values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'artisan2@hellobat.test',
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  '{"full_name": "Marie Lefèvre"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
) on conflict (id) do nothing;

-- Karim Bensaïd — artisan3@hellobat.test / TestPassword123!
insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, created_at, updated_at, role, aud
) values (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'artisan3@hellobat.test',
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  '{"full_name": "Karim Bensaïd"}'::jsonb,
  now(), now(), 'authenticated', 'authenticated'
) on conflict (id) do nothing;

-- ============================================================
-- PROFILES
-- Trigger handle_new_user crée le profil au signup.
-- On met à jour les données métier ici.
-- ============================================================

update public.profiles set
  full_name         = 'Jean Dupont',
  email             = 'artisan1@hellobat.test',
  company_name      = 'Dupont Plomberie',
  phone             = '06 12 34 56 78',
  siret             = '41234567800012',
  naf_code          = '4322A',
  address           = '14 rue des Canuts',
  city              = 'Lyon',
  postal_code       = '69003',
  onboarding_completed = true
where id = '00000000-0000-0000-0000-000000000001';

update public.profiles set
  full_name         = 'Marie Lefèvre',
  email             = 'artisan2@hellobat.test',
  company_name      = 'Lefèvre Élec',
  phone             = '06 23 45 67 89',
  siret             = '52345678900023',
  naf_code          = '4321A',
  address           = '8 boulevard du Prado',
  city              = 'Marseille',
  postal_code       = '13001',
  onboarding_completed = true
where id = '00000000-0000-0000-0000-000000000002';

update public.profiles set
  full_name         = 'Karim Bensaïd',
  email             = 'artisan3@hellobat.test',
  company_name      = 'BenBat Construction',
  phone             = '06 34 56 78 90',
  siret             = '63456789000034',
  naf_code          = '4120A',
  address           = '27 rue de la Roquette',
  city              = 'Paris',
  postal_code       = '75011',
  onboarding_completed = true
where id = '00000000-0000-0000-0000-000000000003';

-- ============================================================
-- CLIENTS — Jean Dupont (4 clients)
-- ============================================================

insert into public.clients (id, user_id, name, email, phone, address, city, postal_code, notes) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'SCI Les Lilas',
    'contact@sci-leslilas.fr',
    '04 72 11 22 33',
    '5 avenue des Lilas',
    'Villeurbanne',
    '69100',
    'Gestionnaire : Mme Aubert — immeuble 12 lots'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Martin Pierre',
    'pierre.martin@gmail.com',
    '06 98 76 54 32',
    '8 rue du Moulin',
    'Caluire-et-Cuire',
    '69300',
    'Particulier — pavillon années 70'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Gauthier Sophie',
    'sophie.gauthier@outlook.com',
    '06 45 67 89 01',
    '22 impasse des Roses',
    'Bron',
    '69500',
    'Particulière — cuisine et SDB à rénover'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'Résidence Les Acacias',
    'syndic@acacias-lyon.fr',
    '04 72 33 44 55',
    '3 allée des Acacias',
    'Lyon',
    '69008',
    'Syndic copropriété 24 lots — contrat maintenance annuel'
  )
on conflict (id) do nothing;

-- ============================================================
-- CLIENTS — Marie Lefèvre (4 clients)
-- ============================================================

insert into public.clients (id, user_id, name, email, phone, address, city, postal_code, notes) values
  (
    '10000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000002',
    'SCI Mistral',
    'gestion@sci-mistral.fr',
    '04 91 11 22 33',
    '15 cours Lieutaud',
    'Marseille',
    '13006',
    'Immeuble commercial 3 étages — mise aux normes électriques'
  ),
  (
    '10000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000002',
    'Fabre Julien',
    'julien.fabre@sfr.fr',
    '06 12 98 76 54',
    '44 rue de la Paix',
    'Aix-en-Provence',
    '13100',
    'Particulier — maison individuelle, extension en cours'
  ),
  (
    '10000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000002',
    'Blanc Nathalie',
    'nathalie.blanc@gmail.com',
    '06 87 65 43 21',
    '7 traverse du Vallon',
    'Aubagne',
    '13400',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000014',
    '00000000-0000-0000-0000-000000000002',
    'SARL Azur Restauration',
    'contact@azur-restauration.fr',
    '04 91 55 66 77',
    '12 boulevard National',
    'Marseille',
    '13001',
    'Restaurant — mise aux normes HACCP, 3 cuisines professionnelles'
  )
on conflict (id) do nothing;

-- ============================================================
-- CLIENTS — Karim Bensaïd (3 clients)
-- ============================================================

insert into public.clients (id, user_id, name, email, phone, address, city, postal_code, notes) values
  (
    '10000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000003',
    'Durand Michel',
    'michel.durand@free.fr',
    '06 11 22 33 44',
    '18 rue Oberkampf',
    'Paris',
    '75011',
    'Particulier — extension arrière maison +30m²'
  ),
  (
    '10000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000003',
    'SCI Belleville Habitat',
    'contact@belleville-habitat.fr',
    '01 43 55 66 77',
    '32 rue de Belleville',
    'Paris',
    '75020',
    'Réhabilitation immeuble haussmannien — gros œuvre'
  ),
  (
    '10000000-0000-0000-0000-000000000023',
    '00000000-0000-0000-0000-000000000003',
    'Nguyen Thanh',
    'thanh.nguyen@gmail.com',
    '06 77 88 99 00',
    '5 passage de la Bonne Graine',
    'Paris',
    '75011',
    'Particulière — ravalement façade + isolation extérieure'
  )
on conflict (id) do nothing;

-- ============================================================
-- DEVIS — Jean Dupont
-- ============================================================

-- DEV-2026-001 : Rénovation SDB complète — envoyé (TVA 10% travaux rénov)
insert into public.devis (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, valid_until, sent_at) values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'DEV-2026-001',
    'Rénovation salle de bain — Dupont Plomberie',
    'envoyé',
    3200.00,
    320.00,
    3520.00,
    10.0,
    '2026-05-15',
    '2026-03-20 09:00:00+01'
  )
on conflict (id) do nothing;

insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000001', 'Dépose et évacuation baignoire existante', 1, 'forfait', 350.00, 1),
  ('20000000-0000-0000-0000-000000000001', 'Installation receveur de douche à l''italienne 120×80', 1, 'u', 780.00, 2),
  ('20000000-0000-0000-0000-000000000001', 'Mitigeur thermostatique + colonne de douche', 1, 'u', 420.00, 3),
  ('20000000-0000-0000-0000-000000000001', 'Raccordements eau froide / eau chaude', 1, 'forfait', 580.00, 4),
  ('20000000-0000-0000-0000-000000000001', 'Remplacement WC suspendu bâti-support', 1, 'u', 690.00, 5),
  ('20000000-0000-0000-0000-000000000001', 'Fournitures et consommables', 1, 'forfait', 380.00, 6);

-- DEV-2026-002 : Remplacement chauffe-eau — accepté (TVA 10%)
insert into public.devis (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, valid_until, sent_at, accepted_at) values
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'DEV-2026-002',
    'Remplacement chauffe-eau thermodynamique 200L',
    'accepté',
    1850.00,
    185.00,
    2035.00,
    10.0,
    '2026-04-30',
    '2026-03-10 10:30:00+01',
    '2026-03-12 14:15:00+01'
  )
on conflict (id) do nothing;

insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000002', 'Dépose chauffe-eau existant + évacuation', 1, 'forfait', 150.00, 1),
  ('20000000-0000-0000-0000-000000000002', 'Fourniture chauffe-eau thermodynamique Daikin 200L', 1, 'u', 1050.00, 2),
  ('20000000-0000-0000-0000-000000000002', 'Pose, raccordements hydrauliques et électriques', 1, 'forfait', 450.00, 3),
  ('20000000-0000-0000-0000-000000000002', 'Mise en service et réglages', 1, 'forfait', 200.00, 4);

-- DEV-2026-003 : Contrat maintenance résidence — brouillon (TVA 20%)
insert into public.devis (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, valid_until) values
  (
    '20000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    'DEV-2026-003',
    'Contrat maintenance annuel plomberie — Résidence Les Acacias',
    'brouillon',
    3880.00,
    776.00,
    4656.00,
    20.0,
    '2026-06-01'
  )
on conflict (id) do nothing;

insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000003', 'Visite préventive semestrielle (×2)', 2, 'forfait', 600.00, 1),
  ('20000000-0000-0000-0000-000000000003', 'Débouchage colonnes montantes (×2/an)', 2, 'u', 380.00, 2),
  ('20000000-0000-0000-0000-000000000003', 'Astreinte téléphonique 24h/24 7j/7', 12, 'mois', 120.00, 3),
  ('20000000-0000-0000-0000-000000000003', 'Fournitures incluses (joints, robinets)', 1, 'forfait', 480.00, 4);

-- ============================================================
-- FACTURES — Jean Dupont
-- ============================================================

-- FAC-2026-001 : facture payée (depuis DEV-2026-002 accepté)
insert into public.factures (id, user_id, client_id, devis_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, payment_terms_days, due_date, paid_at) values
  (
    '40000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'FAC-2026-001',
    'Remplacement chauffe-eau thermodynamique 200L',
    'payée',
    1850.00,
    185.00,
    2035.00,
    10.0,
    30,
    '2026-04-12',
    '2026-04-05 11:22:00+02'
  )
on conflict (id) do nothing;

-- FAC-2026-002 : facture envoyée en attente de paiement
insert into public.factures (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, payment_terms_days, due_date) values
  (
    '40000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'FAC-2026-002',
    'Rénovation salle de bain — SCI Les Lilas — Acompte 40%',
    'envoyée',
    1280.00,
    128.00,
    1408.00,
    10.0,
    30,
    '2026-05-05'
  )
on conflict (id) do nothing;

-- ============================================================
-- CHANTIERS — Jean Dupont
-- ============================================================

insert into public.chantiers (id, user_id, client_id, name, address, city, postal_code,
  status, start_date, end_date, budget_ht, notes) values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Rénovation SDB — SCI Les Lilas Bat A',
    '5 avenue des Lilas',
    'Villeurbanne',
    '69100',
    'en_cours',
    '2026-04-07',
    '2026-04-25',
    3200.00,
    'Accès par l''interphone — contacter Mme Aubert au 04 72 11 22 33'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'Remplacement chauffe-eau — Martin Pierre',
    '8 rue du Moulin',
    'Caluire-et-Cuire',
    '69300',
    'terminé',
    '2026-03-14',
    '2026-03-14',
    1850.00,
    'Chantier terminé en 1 journée — client très satisfait'
  )
on conflict (id) do nothing;

-- ============================================================
-- DEVIS — Marie Lefèvre
-- ============================================================

-- DEV-2026-101 : Mise aux normes tableau électrique — envoyé (TVA 10%)
insert into public.devis (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, valid_until, sent_at) values
  (
    '20000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000011',
    'DEV-2026-101',
    'Mise aux normes NF C 15-100 — SCI Mistral RDC',
    'envoyé',
    4370.00,
    437.00,
    4807.00,
    10.0,
    '2026-05-20',
    '2026-03-25 08:45:00+01'
  )
on conflict (id) do nothing;

insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000011', 'Audit électrique complet et rapport NF C 15-100', 1, 'forfait', 350.00, 1),
  ('20000000-0000-0000-0000-000000000011', 'Remplacement tableau divisionnaire 3 rangées', 1, 'u', 680.00, 2),
  ('20000000-0000-0000-0000-000000000011', 'Disjoncteurs différentiels 30mA (×12)', 12, 'u', 95.00, 3),
  ('20000000-0000-0000-0000-000000000011', 'Mise à la terre (prise de terre + liaisons)', 1, 'forfait', 420.00, 4),
  ('20000000-0000-0000-0000-000000000011', 'Remplacement prises et interrupteurs vétustes (×18)', 18, 'u', 45.00, 5),
  ('20000000-0000-0000-0000-000000000011', 'Main d''œuvre pose et câblage', 12, 'h', 65.00, 6),
  ('20000000-0000-0000-0000-000000000011', 'Certificat Consuel', 1, 'forfait', 190.00, 7);

-- DEV-2026-102 : Tableau électrique maison neuve — accepté (TVA 20% neuf)
insert into public.devis (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, valid_until, sent_at, accepted_at) values
  (
    '20000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000012',
    'DEV-2026-102',
    'Installation électrique complète — Extension Fabre',
    'accepté',
    7360.00,
    1472.00,
    8832.00,
    20.0,
    '2026-04-30',
    '2026-03-05 14:00:00+01',
    '2026-03-08 10:30:00+01'
  )
on conflict (id) do nothing;

insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000012', 'Tableau général basse tension 6 rangées', 1, 'u', 950.00, 1),
  ('20000000-0000-0000-0000-000000000012', 'Câblage alimentation extension (150m câble)', 150, 'ml', 8.50, 2),
  ('20000000-0000-0000-0000-000000000012', 'Prises de courant 16A (×22)', 22, 'u', 55.00, 3),
  ('20000000-0000-0000-0000-000000000012', 'Points lumineux (×14)', 14, 'u', 75.00, 4),
  ('20000000-0000-0000-0000-000000000012', 'VMC simple flux installation complète', 1, 'forfait', 680.00, 5),
  ('20000000-0000-0000-0000-000000000012', 'Domotique : volets roulants connectés (×4)', 4, 'u', 280.00, 6),
  ('20000000-0000-0000-0000-000000000012', 'Main d''œuvre et fournitures annexes', 1, 'forfait', 1075.00, 7);

-- DEV-2026-103 : Installation borne IRVE + domotique — brouillon (TVA 20%)
insert into public.devis (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, valid_until) values
  (
    '20000000-0000-0000-0000-000000000013',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000014',
    'DEV-2026-103',
    'Mise aux normes électriques cuisines pro + borne IRVE — SARL Azur',
    'brouillon',
    9858.00,
    1971.60,
    11829.60,
    20.0,
    '2026-06-30'
  )
on conflict (id) do nothing;

insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000013', 'Bilan de puissance et étude technique', 1, 'forfait', 600.00, 1),
  ('20000000-0000-0000-0000-000000000013', 'Remplacement tableau TGBT cuisine', 1, 'u', 1200.00, 2),
  ('20000000-0000-0000-0000-000000000013', 'Câblage prises 32A fours professionnels (×6)', 6, 'u', 320.00, 3),
  ('20000000-0000-0000-0000-000000000013', 'Borne IRVE 22kW avec badge RFID (parking)', 2, 'u', 1850.00, 4),
  ('20000000-0000-0000-0000-000000000013', 'Tranchée et pose gaine (30ml)', 30, 'ml', 45.00, 5),
  ('20000000-0000-0000-0000-000000000013', 'Main d''œuvre et déplacements', 16, 'h', 68.00, 6);

-- ============================================================
-- FACTURES — Marie Lefèvre
-- ============================================================

-- FAC-2026-101 : payée (DEV-2026-102 accepté)
insert into public.factures (id, user_id, client_id, devis_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, payment_terms_days, due_date, paid_at) values
  (
    '40000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000012',
    '20000000-0000-0000-0000-000000000012',
    'FAC-2026-101',
    'Installation électrique complète — Extension Fabre — Solde',
    'payée',
    7360.00,
    1472.00,
    8832.00,
    20.0,
    45,
    '2026-04-22',
    '2026-04-01 16:05:00+02'
  )
on conflict (id) do nothing;

-- FAC-2026-102 : en retard (NF C 15-100 SCI Mistral)
insert into public.factures (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, payment_terms_days, due_date) values
  (
    '40000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000011',
    'FAC-2026-102',
    'Mise aux normes NF C 15-100 — SCI Mistral — Acompte 50%',
    'en_retard',
    2185.00,
    218.50,
    2403.50,
    10.0,
    30,
    '2026-03-31'
  )
on conflict (id) do nothing;

-- ============================================================
-- CHANTIERS — Marie Lefèvre
-- ============================================================

insert into public.chantiers (id, user_id, client_id, name, address, city, postal_code,
  status, start_date, end_date, budget_ht, notes) values
  (
    '30000000-0000-0000-0000-000000000011',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000012',
    'Installation électrique extension — Fabre Julien',
    '44 rue de la Paix',
    'Aix-en-Provence',
    '13100',
    'en_cours',
    '2026-04-02',
    '2026-04-18',
    7360.00,
    'Accès code portail : 4821. Contact client matin avant 9h.'
  ),
  (
    '30000000-0000-0000-0000-000000000012',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000011',
    'Mise aux normes NF C 15-100 — SCI Mistral',
    '15 cours Lieutaud',
    'Marseille',
    '13006',
    'planifié',
    '2026-05-05',
    '2026-05-23',
    4370.00,
    'Travaux à réaliser en dehors des heures d''ouverture (>18h ou week-end)'
  )
on conflict (id) do nothing;

-- ============================================================
-- DEVIS — Karim Bensaïd
-- ============================================================

-- DEV-2026-201 : Extension pavillon — envoyé (TVA 10% amélioration habitat)
insert into public.devis (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, valid_until, sent_at) values
  (
    '20000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000021',
    'DEV-2026-201',
    'Extension arrière pavillon 30m² — gros œuvre et dalle',
    'envoyé',
    21270.00,
    2127.00,
    23397.00,
    10.0,
    '2026-05-31',
    '2026-03-28 11:00:00+01'
  )
on conflict (id) do nothing;

insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000021', 'Terrassement et évacuation terres (30m²)', 30, 'm²', 45.00, 1),
  ('20000000-0000-0000-0000-000000000021', 'Fondations béton armé HA (profondeur 80cm)', 30, 'm²', 210.00, 2),
  ('20000000-0000-0000-0000-000000000021', 'Murs parpaings 20cm (3ml × 8ml = 22m linéaires, h=2.5m)', 55, 'm²', 120.00, 3),
  ('20000000-0000-0000-0000-000000000021', 'Dalle béton armé finition lissée (30m²)', 30, 'm²', 95.00, 4),
  ('20000000-0000-0000-0000-000000000021', 'Chape fluide autonivelante (30m²)', 30, 'm²', 38.00, 5),
  ('20000000-0000-0000-0000-000000000021', 'Location grue à tour (3 semaines)', 3, 'sem', 850.00, 6),
  ('20000000-0000-0000-0000-000000000021', 'Nettoyage chantier et évacuation gravats', 1, 'forfait', 480.00, 7);

-- DEV-2026-202 : Ravalement façade + ITE — brouillon (TVA 10%)
insert into public.devis (id, user_id, client_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, valid_until) values
  (
    '20000000-0000-0000-0000-000000000022',
    '00000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000023',
    'DEV-2026-202',
    'Ravalement façade + isolation thermique extérieure (ITE)',
    'brouillon',
    20920.00,
    2092.00,
    23012.00,
    10.0,
    '2026-07-15'
  )
on conflict (id) do nothing;

insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000022', 'Échafaudage (6 semaines)', 6, 'sem', 580.00, 1),
  ('20000000-0000-0000-0000-000000000022', 'Nettoyage haute pression façade (120m²)', 120, 'm²', 18.00, 2),
  ('20000000-0000-0000-0000-000000000022', 'Reprise fissures et épaufrures', 1, 'forfait', 1200.00, 3),
  ('20000000-0000-0000-0000-000000000022', 'Pose isolant polystyrène 14cm (120m²)', 120, 'm²', 45.00, 4),
  ('20000000-0000-0000-0000-000000000022', 'Enduit de finition grain fin taloché (120m²)', 120, 'm²', 38.00, 5),
  ('20000000-0000-0000-0000-000000000022', 'Peinture façade 2 couches (120m²)', 120, 'm²', 22.00, 6),
  ('20000000-0000-0000-0000-000000000022', 'Main d''œuvre encadrements et appuis fenêtres (×8)', 8, 'u', 185.00, 7);

-- ============================================================
-- FACTURES — Karim Bensaïd
-- ============================================================

-- FAC-2026-201 : Acompte 30% extension Durand — payé
insert into public.factures (id, user_id, client_id, devis_id, reference, title, status,
  total_ht, total_tva, total_ttc, tva_rate, payment_terms_days, due_date, paid_at) values
  (
    '40000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000021',
    '20000000-0000-0000-0000-000000000021',
    'FAC-2026-201',
    'Extension arrière Durand — Acompte 30%',
    'payée',
    6381.00,
    638.10,
    7019.10,
    10.0,
    15,
    '2026-04-12',
    '2026-04-03 09:30:00+02'
  )
on conflict (id) do nothing;

-- ============================================================
-- CHANTIERS — Karim Bensaïd
-- ============================================================

insert into public.chantiers (id, user_id, client_id, name, address, city, postal_code,
  status, start_date, end_date, budget_ht, notes) values
  (
    '30000000-0000-0000-0000-000000000021',
    '00000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000021',
    'Extension pavillon Durand — 30m² gros œuvre',
    '18 rue Oberkampf',
    'Paris',
    '75011',
    'en_cours',
    '2026-04-07',
    '2026-06-20',
    21270.00,
    'Permis de construire PC-075-2026-0042 accordé. Voisins prévenus. DICT déposée.'
  )
on conflict (id) do nothing;
