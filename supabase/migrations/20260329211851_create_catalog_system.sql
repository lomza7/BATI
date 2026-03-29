/*
  # Systeme de catalogues produits

  1. Nouvelles tables

    - `catalogs` (Catalogues principaux)
      - `id` (uuid, PK)
      - `user_id` (uuid, FK auth.users) - Proprietaire
      - `name` (text) - Nom du catalogue
      - `description` (text) - Description
      - `cover_image` (text) - URL image de couverture
      - `status` (text) - 'draft' | 'published'
      - `created_at` / `updated_at` (timestamptz)

    - `catalog_collections` (Sous-catalogues / Collections thematiques)
      - `id` (uuid, PK)
      - `user_id` (uuid, FK auth.users)
      - `name` (text) - Nom de la collection
      - `description` (text)
      - `color` (text) - Couleur d'identification
      - `sort_order` (integer) - Ordre d'affichage
      - `created_at` / `updated_at` (timestamptz)

    - `catalog_products` (Produits individuels)
      - `id` (uuid, PK)
      - `collection_id` (uuid, FK catalog_collections)
      - `user_id` (uuid, FK auth.users)
      - `name` (text) - Nom du produit/modele
      - `description` (text)
      - `price` (numeric) - Prix en euros
      - `image_url` (text) - URL de l'image
      - `availability` (text) - 'in_stock' | 'on_order' | 'out_of_stock'
      - `sort_order` (integer) - Ordre dans la collection (drag & drop)
      - `created_at` / `updated_at` (timestamptz)

    - `catalog_sends` (Envois de catalogues aux clients via magic link)
      - `id` (uuid, PK)
      - `user_id` (uuid, FK auth.users)
      - `catalog_id` (uuid, FK catalogs)
      - `client_name` (text) - Nom du client
      - `client_email` (text) - Email du client
      - `token` (text, UNIQUE) - Token unique pour le magic link
      - `expires_at` (timestamptz) - Date d'expiration
      - `viewed_at` (timestamptz) - Premiere visite
      - `created_at` (timestamptz)

    - `catalog_catalog_collections` (Table de liaison catalogues <-> collections)
      - `id` (uuid, PK)
      - `catalog_id` (uuid, FK catalogs)
      - `collection_id` (uuid, FK catalog_collections)
      - `sort_order` (integer) - Ordre dans le catalogue

    - `catalog_client_selections` (Selections du client)
      - `id` (uuid, PK)
      - `send_id` (uuid, FK catalog_sends)
      - `product_id` (uuid, FK catalog_products)
      - `note` (text) - Note optionnelle du client
      - `created_at` (timestamptz)

  2. Securite
    - RLS active sur toutes les tables
    - Les utilisateurs ne voient que leurs propres donnees
    - Les tokens magic link permettent un acces public en lecture seule aux catalogues envoyes
    - Les clients peuvent inserer des selections via un token valide

  3. Index
    - Index sur les colonnes de recherche et tri
    - Index sur les tokens pour les lookups rapides
*/

-- Table catalogs
CREATE TABLE IF NOT EXISTS catalogs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  cover_image text DEFAULT '',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own catalogs"
  ON catalogs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own catalogs"
  ON catalogs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own catalogs"
  ON catalogs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own catalogs"
  ON catalogs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Table catalog_collections (sous-catalogues)
CREATE TABLE IF NOT EXISTS catalog_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  color text DEFAULT '#3b82f6',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE catalog_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own collections"
  ON catalog_collections FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collections"
  ON catalog_collections FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections"
  ON catalog_collections FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections"
  ON catalog_collections FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Table catalog_products
CREATE TABLE IF NOT EXISTS catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES catalog_collections(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  price numeric DEFAULT 0,
  image_url text DEFAULT '',
  availability text DEFAULT 'in_stock',
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own products"
  ON catalog_products FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products"
  ON catalog_products FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products"
  ON catalog_products FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own products"
  ON catalog_products FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Table catalog_catalog_collections (liaison)
CREATE TABLE IF NOT EXISTS catalog_catalog_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id uuid REFERENCES catalogs(id) ON DELETE CASCADE NOT NULL,
  collection_id uuid REFERENCES catalog_collections(id) ON DELETE CASCADE NOT NULL,
  sort_order integer DEFAULT 0,
  UNIQUE(catalog_id, collection_id)
);

ALTER TABLE catalog_catalog_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own catalog-collection links"
  ON catalog_catalog_collections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM catalogs WHERE catalogs.id = catalog_id AND catalogs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own catalog-collection links"
  ON catalog_catalog_collections FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM catalogs WHERE catalogs.id = catalog_id AND catalogs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own catalog-collection links"
  ON catalog_catalog_collections FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM catalogs WHERE catalogs.id = catalog_id AND catalogs.user_id = auth.uid()
    )
  );

-- Table catalog_sends (envois magic link)
CREATE TABLE IF NOT EXISTS catalog_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  catalog_id uuid REFERENCES catalogs(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL DEFAULT '',
  client_email text DEFAULT '',
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  viewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE catalog_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sends"
  ON catalog_sends FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sends"
  ON catalog_sends FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sends"
  ON catalog_sends FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sends"
  ON catalog_sends FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Acces public en lecture via token (pour le magic link)
CREATE POLICY "Public can view sends by token"
  ON catalog_sends FOR SELECT TO anon
  USING (
    token IS NOT NULL
    AND expires_at > now()
  );

-- Table catalog_client_selections
CREATE TABLE IF NOT EXISTS catalog_client_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid REFERENCES catalog_sends(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES catalog_products(id) ON DELETE CASCADE NOT NULL,
  note text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(send_id, product_id)
);

ALTER TABLE catalog_client_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view selections for own sends"
  ON catalog_client_selections FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM catalog_sends WHERE catalog_sends.id = send_id AND catalog_sends.user_id = auth.uid()
    )
  );

CREATE POLICY "Anon can insert selections for valid sends"
  ON catalog_client_selections FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM catalog_sends WHERE catalog_sends.id = send_id AND catalog_sends.expires_at > now()
    )
  );

CREATE POLICY "Anon can view selections for valid sends"
  ON catalog_client_selections FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM catalog_sends WHERE catalog_sends.id = send_id AND catalog_sends.expires_at > now()
    )
  );

-- Acces public aux produits et collections via les envois valides
CREATE POLICY "Public can view products via valid send"
  ON catalog_products FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM catalog_catalog_collections ccc
      JOIN catalog_sends cs ON cs.catalog_id = ccc.catalog_id
      WHERE ccc.collection_id = catalog_products.collection_id
      AND cs.expires_at > now()
    )
  );

CREATE POLICY "Public can view collections via valid send"
  ON catalog_collections FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM catalog_catalog_collections ccc
      JOIN catalog_sends cs ON cs.catalog_id = ccc.catalog_id
      WHERE ccc.collection_id = catalog_collections.id
      AND cs.expires_at > now()
    )
  );

CREATE POLICY "Public can view catalogs via valid send"
  ON catalogs FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM catalog_sends cs
      WHERE cs.catalog_id = catalogs.id
      AND cs.expires_at > now()
    )
  );

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_catalogs_user ON catalogs(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_collections_user ON catalog_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_collection ON catalog_products(collection_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_user ON catalog_products(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_sort ON catalog_products(collection_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_catalog_sends_token ON catalog_sends(token);
CREATE INDEX IF NOT EXISTS idx_catalog_sends_user ON catalog_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_catalog_sends_catalog ON catalog_sends(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_client_selections_send ON catalog_client_selections(send_id);
CREATE INDEX IF NOT EXISTS idx_catalog_catalog_collections_catalog ON catalog_catalog_collections(catalog_id);
CREATE INDEX IF NOT EXISTS idx_catalog_catalog_collections_collection ON catalog_catalog_collections(collection_id);
