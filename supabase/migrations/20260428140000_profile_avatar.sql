-- Photo de profil utilisateur — colonne + bucket Storage public "avatars".
-- Bucket public (lecture anonyme) pour éviter de générer des signed URLs à
-- chaque affichage. Path scopé par user (auth.uid/…) pour que seul le
-- propriétaire puisse uploader/supprimer.

alter table public.profiles
  add column if not exists avatar_url text default '';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/png','image/jpeg','image/jpg','image/webp','image/gif','image/heic']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Avatars: public read" on storage.objects;
create policy "Avatars: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "Avatars: user uploads own folder" on storage.objects;
create policy "Avatars: user uploads own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatars: user updates own folder" on storage.objects;
create policy "Avatars: user updates own folder"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Avatars: user deletes own folder" on storage.objects;
create policy "Avatars: user deletes own folder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
