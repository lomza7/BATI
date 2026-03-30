/*
  # Create project photos storage bucket

  1. Bucket
    - `project-photos` public bucket for chantier photos

  2. Security
    - Authenticated users can upload only inside their own folder
    - Authenticated users can update/delete only their own files
    - Public read access for already-uploaded chantier photos
*/

INSERT INTO storage.buckets (id, name, public)
SELECT 'project-photos', 'project-photos', true
WHERE NOT EXISTS (
  SELECT 1 FROM storage.buckets WHERE id = 'project-photos'
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Auth users can upload project photos'
  ) THEN
    CREATE POLICY "Auth users can upload project photos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'project-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Auth users can update project photos'
  ) THEN
    CREATE POLICY "Auth users can update project photos"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'project-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'project-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Auth users can delete project photos'
  ) THEN
    CREATE POLICY "Auth users can delete project photos"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'project-photos'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Anyone can view project photos'
  ) THEN
    CREATE POLICY "Anyone can view project photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'project-photos');
  END IF;
END $$;
