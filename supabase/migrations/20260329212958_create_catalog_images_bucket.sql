/*
  # Bucket de stockage pour les images de catalogues

  1. Nouveau bucket
    - `catalog-images` - stockage des photos produits uploadees

  2. Securite
    - Les utilisateurs authentifies peuvent uploader des images
    - Les images sont lisibles publiquement (pour les magic links clients)
    - Chaque utilisateur upload dans son propre dossier (user_id/)

  3. Modifications tables
    - Ajout colonne `emoji` sur `catalog_collections`
    - Ajout colonne `emoji` sur `catalogs`
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('catalog-images', 'catalog-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload catalog images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catalog-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can update own catalog images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catalog-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'catalog-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Authenticated users can delete own catalog images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catalog-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can view catalog images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'catalog-images');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'catalog_collections' AND column_name = 'emoji'
  ) THEN
    ALTER TABLE catalog_collections ADD COLUMN emoji text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'catalogs' AND column_name = 'emoji'
  ) THEN
    ALTER TABLE catalogs ADD COLUMN emoji text DEFAULT '';
  END IF;
END $$;
