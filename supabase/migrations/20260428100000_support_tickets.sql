-- ─────────────────────────────────────────────────────────────────────────
-- Table support_tickets : feedback utilisateurs depuis le bouton Aide
-- ─────────────────────────────────────────────────────────────────────────
-- Chaque soumission du HelpDialog (bug / question / amélioration) crée une
-- ligne ici. Vue admin pour traitement, email envoyé en parallèle via Resend.
-- Snapshot du contexte profil (email, nom, téléphone, entreprise) capturé à
-- la création pour ne pas dépendre de l'état du profile au moment de la
-- lecture admin.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('bug', 'question', 'amelioration')),
  message text not null,
  -- Snapshot du profil au moment de la soumission
  user_email text not null,
  user_full_name text default '',
  user_phone text default '',
  company_name text default '',
  -- Contexte technique pour debugging / priorisation
  page_url text default '',
  user_agent text default '',
  -- État du ticket côté admin
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'closed')),
  admin_notes text default '',
  handled_by uuid references auth.users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user_id on public.support_tickets (user_id);
create index if not exists idx_support_tickets_status_created on public.support_tickets (status, created_at desc);
create index if not exists idx_support_tickets_type on public.support_tickets (type);

-- Trigger pour maintenir updated_at
create or replace function public.support_tickets_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
create trigger support_tickets_touch_updated_at
  before update on public.support_tickets
  for each row execute function public.support_tickets_touch_updated_at();

-- RLS : user voit ses propres tickets, admin voit tout via is_admin()
alter table public.support_tickets enable row level security;

drop policy if exists "Users view own tickets" on public.support_tickets;
create policy "Users view own tickets"
  on public.support_tickets for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users insert own tickets" on public.support_tickets;
create policy "Users insert own tickets"
  on public.support_tickets for insert
  to authenticated
  with check (user_id = auth.uid());

-- Seuls les admins peuvent update (traitement, notes)
drop policy if exists "Admins update tickets" on public.support_tickets;
create policy "Admins update tickets"
  on public.support_tickets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete tickets" on public.support_tickets;
create policy "Admins delete tickets"
  on public.support_tickets for delete
  to authenticated
  using (public.is_admin());
