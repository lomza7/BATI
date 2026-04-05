-- ============================================================
-- Migration: 20260101000001_init
-- Description: Initial schema for Hellobat SaaS platform
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_crypto";

-- ============================================================
-- PROFILES
-- Linked to auth.users via trigger on signup
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  company_name text,
  phone text,
  siret text,
  naf_code text, -- e.g. 4120A, 4321A (codes BTP)
  address text,
  city text,
  postal_code text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================================
-- CLIENTS (CRM)
-- ============================================================
create table public.clients (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  postal_code text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "Users can manage their own clients"
  on public.clients for all
  using (auth.uid() = user_id);

-- ============================================================
-- DEVIS (QUOTES)
-- ============================================================
create type public.devis_status as enum ('brouillon', 'envoyé', 'accepté', 'refusé', 'expiré');

create table public.devis (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  reference text not null, -- e.g. DEV-2026-001
  title text not null,
  description text,
  status public.devis_status not null default 'brouillon',
  total_ht numeric(12, 2) not null default 0,
  total_tva numeric(12, 2) not null default 0,
  total_ttc numeric(12, 2) not null default 0,
  tva_rate numeric(5, 2) not null default 20.0,
  valid_until date,
  accepted_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.devis enable row level security;

create policy "Users can manage their own devis"
  on public.devis for all
  using (auth.uid() = user_id);

-- ============================================================
-- DEVIS LIGNES (Quote line items)
-- ============================================================
create table public.devis_lignes (
  id uuid primary key default uuid_generate_v4(),
  devis_id uuid not null references public.devis(id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit text default 'u', -- u, m², ml, h, j
  unit_price_ht numeric(12, 2) not null default 0,
  total_ht numeric(12, 2) generated always as (quantity * unit_price_ht) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.devis_lignes enable row level security;

create policy "Users can manage lignes of their own devis"
  on public.devis_lignes for all
  using (
    exists (
      select 1 from public.devis d
      where d.id = devis_id and d.user_id = auth.uid()
    )
  );

-- ============================================================
-- FACTURES (INVOICES)
-- Facturation électronique conforme 2026
-- ============================================================
create type public.facture_status as enum ('brouillon', 'émise', 'envoyée', 'payée', 'en_retard', 'annulée');

create table public.factures (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  devis_id uuid references public.devis(id) on delete set null,
  reference text not null, -- e.g. FAC-2026-001
  title text not null,
  status public.facture_status not null default 'brouillon',
  total_ht numeric(12, 2) not null default 0,
  total_tva numeric(12, 2) not null default 0,
  total_ttc numeric(12, 2) not null default 0,
  tva_rate numeric(5, 2) not null default 20.0,
  payment_terms_days integer not null default 30,
  due_date date,
  paid_at timestamptz,
  stripe_payment_intent_id text,
  -- Facturation électronique 2026
  e_invoice_format text, -- 'UBL', 'CII', 'Factur-X'
  e_invoice_status text, -- 'non_soumise', 'soumise', 'validée'
  e_invoice_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.factures enable row level security;

create policy "Users can manage their own factures"
  on public.factures for all
  using (auth.uid() = user_id);

-- ============================================================
-- CHANTIERS (PROJECTS/WORKSITES)
-- ============================================================
create type public.chantier_status as enum ('planifié', 'en_cours', 'terminé', 'annulé');

create table public.chantiers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  address text,
  city text,
  postal_code text,
  status public.chantier_status not null default 'planifié',
  start_date date,
  end_date date,
  budget_ht numeric(12, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.chantiers enable row level security;

create policy "Users can manage their own chantiers"
  on public.chantiers for all
  using (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger handle_clients_updated_at
  before update on public.clients
  for each row execute function public.handle_updated_at();

create trigger handle_devis_updated_at
  before update on public.devis
  for each row execute function public.handle_updated_at();

create trigger handle_factures_updated_at
  before update on public.factures
  for each row execute function public.handle_updated_at();

create trigger handle_chantiers_updated_at
  before update on public.chantiers
  for each row execute function public.handle_updated_at();

-- ============================================================
-- TRIGGER: create profile on user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_clients_user_id on public.clients(user_id);
create index idx_devis_user_id on public.devis(user_id);
create index idx_devis_client_id on public.devis(client_id);
create index idx_devis_status on public.devis(status);
create index idx_factures_user_id on public.factures(user_id);
create index idx_factures_status on public.factures(status);
create index idx_chantiers_user_id on public.chantiers(user_id);
create index idx_chantiers_status on public.chantiers(status);
