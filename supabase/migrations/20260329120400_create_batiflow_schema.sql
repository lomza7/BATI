/*
  # BatiFlow - Schema complet de base de donnees

  1. Nouvelles tables
    - `clients` : Carnet d'adresses clients
      - `id` (uuid, PK)
      - `name` (text) - Nom du client
      - `email` (text) - Email
      - `phone` (text) - Telephone
      - `address` (text) - Adresse
      - `city` (text) - Ville
      - `postal_code` (text) - Code postal
      - `notes` (text) - Notes
      - `created_at` (timestamptz)

    - `quotes` : Devis
      - `id` (uuid, PK)
      - `quote_number` (text) - Numero unique D-YYYY-XXX
      - `client_id` (uuid, FK clients)
      - `title` (text) - Intitule du devis
      - `description` (text)
      - `status` (text) - brouillon, envoye, accepte, refuse, expire
      - `total_ht` (numeric) - Total HT
      - `tva_rate` (numeric) - Taux TVA
      - `total_ttc` (numeric) - Total TTC
      - `valid_until` (date) - Date de validite
      - `signed_at` (timestamptz) - Date de signature
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `quote_lines` : Lignes de devis
      - `id` (uuid, PK)
      - `quote_id` (uuid, FK quotes)
      - `description` (text)
      - `quantity` (numeric)
      - `unit` (text) - unite (m2, ml, u, h, forfait)
      - `unit_price` (numeric)
      - `total` (numeric)
      - `position` (integer) - Ordre d'affichage

    - `invoices` : Factures
      - `id` (uuid, PK)
      - `invoice_number` (text) - Numero unique F-YYYY-XXX
      - `quote_id` (uuid, FK quotes, nullable)
      - `client_id` (uuid, FK clients)
      - `title` (text)
      - `status` (text) - brouillon, envoyee, payee, en_retard, annulee
      - `total_ht` (numeric)
      - `tva_rate` (numeric)
      - `total_ttc` (numeric)
      - `due_date` (date)
      - `paid_at` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `invoice_lines` : Lignes de factures
      - `id` (uuid, PK)
      - `invoice_id` (uuid, FK invoices)
      - `description` (text)
      - `quantity` (numeric)
      - `unit` (text)
      - `unit_price` (numeric)
      - `total` (numeric)
      - `position` (integer)

    - `projects` : Chantiers
      - `id` (uuid, PK)
      - `name` (text) - Nom du chantier
      - `client_id` (uuid, FK clients)
      - `address` (text)
      - `city` (text)
      - `postal_code` (text)
      - `lat` (numeric) - Latitude
      - `lng` (numeric) - Longitude
      - `status` (text) - a_planifier, en_cours, termine, en_pause
      - `progress` (integer) - Pourcentage 0-100
      - `start_date` (date)
      - `end_date` (date)
      - `budget` (numeric)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `project_photos` : Photos de chantier
      - `id` (uuid, PK)
      - `project_id` (uuid, FK projects)
      - `url` (text)
      - `caption` (text)
      - `created_at` (timestamptz)

    - `team_members` : Membres d'equipe
      - `id` (uuid, PK)
      - `name` (text)
      - `role` (text)
      - `phone` (text)
      - `email` (text)
      - `color` (text) - Couleur dans le planning
      - `created_at` (timestamptz)

    - `planning_events` : Evenements planning
      - `id` (uuid, PK)
      - `title` (text)
      - `project_id` (uuid, FK projects, nullable)
      - `team_member_id` (uuid, FK team_members, nullable)
      - `event_type` (text) - chantier, conge, reunion, autre
      - `start_date` (date)
      - `end_date` (date)
      - `all_day` (boolean)
      - `notes` (text)
      - `created_at` (timestamptz)

    - `leads` : Prospects CRM
      - `id` (uuid, PK)
      - `name` (text)
      - `email` (text)
      - `phone` (text)
      - `source` (text) - travaux_com, bouche_a_oreille, site_web, autre
      - `stage` (text) - nouveau, contacte, devis_envoye, negocie, gagne, perdu
      - `value` (numeric)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `reviews` : Avis Google
      - `id` (uuid, PK)
      - `client_name` (text)
      - `project_id` (uuid, FK projects, nullable)
      - `rating` (integer) - 1-5
      - `comment` (text)
      - `response` (text) - Reponse de l'artisan
      - `status` (text) - en_attente, publie, repondu
      - `created_at` (timestamptz)

    - `ai_agents` : Agents IA configurables
      - `id` (uuid, PK)
      - `slug` (text) - pannes, dtu, chiffreur, juriste, rge_cee
      - `name` (text) - Nom personnalise
      - `avatar_url` (text)
      - `description` (text)
      - `system_prompt` (text)
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `ai_conversations` : Historique conversations IA
      - `id` (uuid, PK)
      - `agent_id` (uuid, FK ai_agents)
      - `title` (text)
      - `created_at` (timestamptz)

    - `ai_messages` : Messages dans conversations IA
      - `id` (uuid, PK)
      - `conversation_id` (uuid, FK ai_conversations)
      - `role` (text) - user, assistant
      - `content` (text)
      - `created_at` (timestamptz)

    - `recurring_contracts` : Contrats recurrents
      - `id` (uuid, PK)
      - `client_id` (uuid, FK clients)
      - `title` (text) - Ex: Entretien chaudiere
      - `contract_type` (text) - chaudiere, clim, piscine, autre
      - `amount` (numeric) - Montant mensuel
      - `frequency` (text) - mensuel, trimestriel, annuel
      - `status` (text) - actif, suspendu, resilie
      - `start_date` (date)
      - `next_billing` (date)
      - `notes` (text)
      - `created_at` (timestamptz)

    - `expenses` : Depenses comptabilite
      - `id` (uuid, PK)
      - `description` (text)
      - `amount` (numeric)
      - `category` (text) - materiaux, sous_traitance, deplacement, assurance, autre
      - `date` (date)
      - `supplier` (text)
      - `receipt_url` (text)
      - `tva_amount` (numeric)
      - `created_at` (timestamptz)

  2. Securite
    - RLS active sur toutes les tables
    - Politiques pour utilisateurs authentifies uniquement
*/

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  postal_code text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view clients" ON clients FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert clients" ON clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update clients" ON clients FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete clients" ON clients FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Devis
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  client_id uuid REFERENCES clients(id),
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'brouillon',
  total_ht numeric DEFAULT 0,
  tva_rate numeric DEFAULT 20,
  total_ttc numeric DEFAULT 0,
  valid_until date,
  signed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view quotes" ON quotes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert quotes" ON quotes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update quotes" ON quotes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete quotes" ON quotes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Lignes de devis
CREATE TABLE IF NOT EXISTS quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'u',
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0,
  position integer DEFAULT 0
);
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view quote_lines" ON quote_lines FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert quote_lines" ON quote_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update quote_lines" ON quote_lines FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete quote_lines" ON quote_lines FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Factures
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  quote_id uuid REFERENCES quotes(id),
  client_id uuid REFERENCES clients(id),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'brouillon',
  total_ht numeric DEFAULT 0,
  tva_rate numeric DEFAULT 20,
  total_ttc numeric DEFAULT 0,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view invoices" ON invoices FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert invoices" ON invoices FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update invoices" ON invoices FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete invoices" ON invoices FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Lignes de factures
CREATE TABLE IF NOT EXISTS invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'u',
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0,
  position integer DEFAULT 0
);
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view invoice_lines" ON invoice_lines FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert invoice_lines" ON invoice_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update invoice_lines" ON invoice_lines FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete invoice_lines" ON invoice_lines FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Chantiers
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES clients(id),
  address text DEFAULT '',
  city text DEFAULT '',
  postal_code text DEFAULT '',
  lat numeric,
  lng numeric,
  status text NOT NULL DEFAULT 'a_planifier',
  progress integer DEFAULT 0,
  start_date date,
  end_date date,
  budget numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view projects" ON projects FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert projects" ON projects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update projects" ON projects FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete projects" ON projects FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Photos de chantier
CREATE TABLE IF NOT EXISTS project_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  caption text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view project_photos" ON project_photos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert project_photos" ON project_photos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update project_photos" ON project_photos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete project_photos" ON project_photos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Membres d'equipe
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  color text DEFAULT '#E97F2A',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view team_members" ON team_members FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert team_members" ON team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update team_members" ON team_members FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete team_members" ON team_members FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Planning
CREATE TABLE IF NOT EXISTS planning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  project_id uuid REFERENCES projects(id),
  team_member_id uuid REFERENCES team_members(id),
  event_type text NOT NULL DEFAULT 'chantier',
  start_date date NOT NULL,
  end_date date NOT NULL,
  all_day boolean DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE planning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view planning_events" ON planning_events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert planning_events" ON planning_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update planning_events" ON planning_events FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete planning_events" ON planning_events FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Leads / CRM
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text DEFAULT '',
  phone text DEFAULT '',
  source text DEFAULT 'autre',
  stage text NOT NULL DEFAULT 'nouveau',
  value numeric DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view leads" ON leads FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert leads" ON leads FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update leads" ON leads FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete leads" ON leads FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Avis
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  project_id uuid REFERENCES projects(id),
  rating integer NOT NULL DEFAULT 5,
  comment text DEFAULT '',
  response text DEFAULT '',
  status text NOT NULL DEFAULT 'en_attente',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view reviews" ON reviews FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert reviews" ON reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update reviews" ON reviews FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete reviews" ON reviews FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Agents IA
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  avatar_url text DEFAULT '',
  description text DEFAULT '',
  system_prompt text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view ai_agents" ON ai_agents FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert ai_agents" ON ai_agents FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update ai_agents" ON ai_agents FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete ai_agents" ON ai_agents FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Conversations IA
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE NOT NULL,
  title text DEFAULT 'Nouvelle conversation',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view ai_conversations" ON ai_conversations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert ai_conversations" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update ai_conversations" ON ai_conversations FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete ai_conversations" ON ai_conversations FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Messages IA
CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES ai_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view ai_messages" ON ai_messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert ai_messages" ON ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update ai_messages" ON ai_messages FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete ai_messages" ON ai_messages FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Contrats recurrents
CREATE TABLE IF NOT EXISTS recurring_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  title text NOT NULL,
  contract_type text DEFAULT 'autre',
  amount numeric DEFAULT 0,
  frequency text DEFAULT 'mensuel',
  status text NOT NULL DEFAULT 'actif',
  start_date date,
  next_billing date,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE recurring_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view recurring_contracts" ON recurring_contracts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert recurring_contracts" ON recurring_contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update recurring_contracts" ON recurring_contracts FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete recurring_contracts" ON recurring_contracts FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Depenses / Comptabilite
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric DEFAULT 0,
  category text DEFAULT 'autre',
  date date DEFAULT CURRENT_DATE,
  supplier text DEFAULT '',
  receipt_url text DEFAULT '',
  tva_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view expenses" ON expenses FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can insert expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update expenses" ON expenses FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete expenses" ON expenses FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Seed les 5 agents IA par defaut
INSERT INTO ai_agents (slug, name, description, system_prompt) VALUES
  ('pannes', 'Expert Pannes', 'Diagnostique les pannes courantes en plomberie, electricite, chauffage', 'Tu es un expert en diagnostic de pannes dans le batiment. Tu aides les artisans a identifier les causes probables et les solutions.'),
  ('dtu', 'Expert DTU', 'Specialiste des Documents Techniques Unifies et normes de construction', 'Tu es un specialiste des DTU (Documents Techniques Unifies). Tu connais toutes les normes de construction francaises.'),
  ('chiffreur', 'Chiffreur Pro', 'Aide au chiffrage precis des travaux avec prix materiaux et main-d-oeuvre', 'Tu es un expert en chiffrage de travaux. Tu aides a estimer les couts des materiaux et la main-d-oeuvre.'),
  ('juriste', 'Juriste BTP', 'Conseils juridiques lies au BTP : contrats, assurances, litiges', 'Tu es un juriste specialise dans le droit du BTP. Tu conseilles sur les contrats, assurances et litiges.'),
  ('rge_cee', 'Expert RGE/CEE', 'Aide sur les certifications RGE et les Certificats d-Economies d-Energie', 'Tu es un expert en certifications RGE et CEE. Tu aides les artisans a comprendre les demarches et les aides.')
ON CONFLICT (slug) DO NOTHING;

-- Index pour les recherches frequentes
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_planning_events_dates ON planning_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_recurring_contracts_status ON recurring_contracts(status);
