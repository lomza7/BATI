-- Fix : les policies anon sur `profiles` référençaient invoice_sends et
-- quote_sends sans que anon ait les privilèges SELECT sur ces tables.
-- Résultat : toutes les requêtes anon sur profiles retournaient 42501
-- permission denied, cassant la page publique /site/[slug] qui
-- faisait `profiles.select('*')` pour afficher le site artisan.
-- Symptôme externe : 404 sur les sites artisans publiés récemment
-- (les anciens passaient grâce au cache ISR généré avant la policy).
--
-- Solution : envelopper les EXISTS dans des fonctions SECURITY DEFINER
-- qui bypass RLS pour l'évaluation de la condition. Ces helpers ne
-- retournent que bool — aucune donnée des tables ne fuite.

create or replace function public.user_has_valid_quote_send(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from quote_sends
    where user_id = p_user_id
      and expires_at > now()
  );
$$;

create or replace function public.user_has_valid_invoice_send(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from invoice_sends
    where user_id = p_user_id
      and expires_at > now()
  );
$$;

grant execute on function public.user_has_valid_quote_send(uuid) to anon, authenticated;
grant execute on function public.user_has_valid_invoice_send(uuid) to anon, authenticated;

drop policy if exists "Public can view profiles via valid quote send" on public.profiles;
create policy "Public can view profiles via valid quote send"
  on public.profiles for select
  to anon
  using (public.user_has_valid_quote_send(id));

drop policy if exists "anon_view_profile_via_invoice_send" on public.profiles;
create policy "anon_view_profile_via_invoice_send"
  on public.profiles for select
  to anon
  using (public.user_has_valid_invoice_send(id));
