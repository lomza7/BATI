-- Fix signup "Database error saving new user".
--
-- Chaîne cassée : auth.users INSERT → handle_new_user() → INSERT profiles
-- → set_public_review_token() → gen_random_bytes(12)
--
-- Cause : pgcrypto est installé dans le schema `extensions` (convention
-- Supabase). set_public_review_token appelait `gen_random_bytes` sans
-- préfixe de schema et sans `search_path` élargi, donc Postgres levait
-- SQLSTATE 42883 (function does not exist), faisant échouer tout le
-- flux de signup.
--
-- Fix : qualifier l'appel en `extensions.gen_random_bytes` + définir
-- explicitement `search_path` pour être robuste.

create or replace function public.set_public_review_token()
returns trigger
language plpgsql
set search_path to 'public', 'extensions'
as $$
begin
  if new.public_review_token is null then
    new.public_review_token := encode(extensions.gen_random_bytes(12), 'hex');
  end if;
  return new;
end;
$$;
