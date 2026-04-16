-- ─────────────────────────────────────────────────────────────────────────
-- Pièces jointes pour support_tickets
-- ─────────────────────────────────────────────────────────────────────────
-- Un user peut joindre jusqu'à 3 fichiers (screenshots, PDFs, courtes
-- vidéos) à son ticket. Les paths du Storage sont stockés en JSONB sur
-- la ligne du ticket plutôt qu'en table séparée : peu de fichiers, jamais
-- indexés, lus toujours avec le ticket.
--
-- Format d'un item :
-- { "path": "user_id/ticket_id/file.png", "name": "screenshot.png",
--   "mime": "image/png", "size": 123456 }
-- ─────────────────────────────────────────────────────────────────────────

alter table public.support_tickets
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Bucket Storage privé pour les attachments. Seul le propriétaire et les
-- admins peuvent lire. Upload autorisé pour le user authentifié dans son
-- propre dossier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-attachments',
  'support-attachments',
  false,
  10485760, -- 10 MB
  array[
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/heic',
    'application/pdf',
    'video/mp4', 'video/quicktime', 'video/webm',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies : upload/read/delete scopés sur le dossier du user.
-- La convention de path est `<auth.uid>/...`. On la valide par (storage.foldername(name))[1].
drop policy if exists "Support attachments: user can upload into own folder" on storage.objects;
create policy "Support attachments: user can upload into own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Support attachments: user can read own files" on storage.objects;
create policy "Support attachments: user can read own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists "Support attachments: user can delete own files" on storage.objects;
create policy "Support attachments: user can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'support-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
