-- Cache des détails de prestations générés par l'IA (ou saisis manuellement),
-- keyed sur (user, titre normalisé). Évite de rappeler OpenAI pour un titre
-- déjà rencontré et garantit la cohérence du détail d'un devis à l'autre.

create table if not exists public.prestation_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title_norm text not null,
  title text not null,
  detail text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, title_norm)
);

create index if not exists prestation_details_user_title_idx
  on public.prestation_details (user_id, title_norm);

alter table public.prestation_details enable row level security;

drop policy if exists "prestation_details_select_own" on public.prestation_details;
drop policy if exists "prestation_details_insert_own" on public.prestation_details;
drop policy if exists "prestation_details_update_own" on public.prestation_details;
drop policy if exists "prestation_details_delete_own" on public.prestation_details;

create policy "prestation_details_select_own"
  on public.prestation_details for select
  using (auth.uid() = user_id);

create policy "prestation_details_insert_own"
  on public.prestation_details for insert
  with check (auth.uid() = user_id);

create policy "prestation_details_update_own"
  on public.prestation_details for update
  using (auth.uid() = user_id);

create policy "prestation_details_delete_own"
  on public.prestation_details for delete
  using (auth.uid() = user_id);
