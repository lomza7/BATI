-- ============================================================
-- Seed data for local development / testing
-- Run: supabase db seed
-- ============================================================

-- NOTE: This seed creates test users via auth.users directly.
-- In local dev, Supabase's auth schema is accessible for seeding.
-- Do NOT run this against staging or production.

-- Test user: artisan@hellobat.test / password: TestPassword123!
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'artisan@hellobat.test',
  crypt('TestPassword123!', gen_salt('bf')),
  now(),
  '{"full_name": "Jean Dupont"}'::jsonb,
  now(),
  now(),
  'authenticated',
  'authenticated'
) on conflict (id) do nothing;

-- Profile is auto-created by trigger, but update with more details
update public.profiles set
  full_name = 'Jean Dupont',
  company_name = 'Dupont Bâtiment',
  phone = '06 12 34 56 78',
  siret = '12345678901234',
  naf_code = '4120A',
  address = '12 rue des Artisans',
  city = 'Paris',
  postal_code = '75011',
  onboarding_completed = true
where id = '00000000-0000-0000-0000-000000000001';

-- Test clients
insert into public.clients (id, user_id, name, email, phone, address, city, postal_code) values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'SCI Les Lilas',
    'contact@sci-leslilas.fr',
    '01 23 45 67 89',
    '5 avenue des Lilas',
    'Montreuil',
    '93100'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'M. Martin Pierre',
    'pierre.martin@gmail.com',
    '06 98 76 54 32',
    '8 rue du Moulin',
    'Vincennes',
    '94300'
  )
on conflict (id) do nothing;

-- Test devis
insert into public.devis (id, user_id, client_id, reference, title, status, total_ht, total_tva, total_ttc, valid_until) values
  (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'DEV-2026-001',
    'Rénovation salle de bain — Lot plomberie',
    'envoyé',
    3500.00,
    700.00,
    4200.00,
    '2026-05-01'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'DEV-2026-002',
    'Extension véranda — Maçonnerie et carrelage',
    'brouillon',
    8200.00,
    1640.00,
    9840.00,
    '2026-04-30'
  )
on conflict (id) do nothing;

-- Devis lignes
insert into public.devis_lignes (devis_id, description, quantity, unit, unit_price_ht, sort_order) values
  ('20000000-0000-0000-0000-000000000001', 'Dépose baignoire et carrelage existant', 1, 'forfait', 400.00, 1),
  ('20000000-0000-0000-0000-000000000001', 'Installation receveur de douche à l''italienne', 1, 'u', 850.00, 2),
  ('20000000-0000-0000-0000-000000000001', 'Pose carrelage sol et murs (15m²)', 15, 'm²', 85.00, 3),
  ('20000000-0000-0000-0000-000000000001', 'Installation robinetterie et mitigeur', 1, 'u', 320.00, 4),
  ('20000000-0000-0000-0000-000000000001', 'Raccordements plomberie', 1, 'forfait', 650.00, 5),
  ('20000000-0000-0000-0000-000000000002', 'Fondations béton armé (12m²)', 12, 'm²', 180.00, 1),
  ('20000000-0000-0000-0000-000000000002', 'Dalle béton finition (20m²)', 20, 'm²', 95.00, 2),
  ('20000000-0000-0000-0000-000000000002', 'Pose carrelage extérieur (20m²)', 20, 'm²', 75.00, 3),
  ('20000000-0000-0000-0000-000000000002', 'Maçonnerie agrandissement', 1, 'forfait', 4500.00, 4);

-- Test chantier
insert into public.chantiers (id, user_id, client_id, name, address, city, postal_code, status, start_date, end_date, budget_ht) values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Rénovation SCI Les Lilas — Appartement T3',
    '5 avenue des Lilas',
    'Montreuil',
    '93100',
    'en_cours',
    '2026-03-15',
    '2026-05-30',
    12000.00
  )
on conflict (id) do nothing;
