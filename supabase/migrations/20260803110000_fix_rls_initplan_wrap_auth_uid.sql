-- Perf : envelopper auth.uid()/auth.role()/auth.jwt()/auth.email() dans (select ...)
-- pour que Postgres l'évalue UNE fois par requête au lieu d'une fois par ligne.
-- Corrige les 138 alertes auth_rls_initplan (advisor Supabase). Réécrit chaque
-- policy en préservant exactement sa logique (USING / WITH CHECK inchangés
-- hormis l'enveloppe). Appliquée en prod le 2026-08-03 (incident lenteur :
-- statement timeouts en cascade, pages qui ne chargeaient pas).
do $$
declare
  r record;
  v_qual text;
  v_check text;
  stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and ( (qual is not null and qual ~ 'auth\.(uid|role|jwt|email)\(\)' and qual !~* '\(\s*select\s+auth\.')
         or (with_check is not null and with_check ~ 'auth\.(uid|role|jwt|email)\(\)' and with_check !~* '\(\s*select\s+auth\.') )
  loop
    stmt := 'ALTER POLICY ' || quote_ident(r.policyname)
         || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
    if r.qual is not null then
      v_qual := regexp_replace(r.qual, '\(\s*select\s+(auth\.(uid|role|jwt|email)\(\))\s*\)', '\1', 'gi');
      v_qual := regexp_replace(v_qual, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g');
      stmt := stmt || ' USING (' || v_qual || ')';
    end if;
    if r.with_check is not null then
      v_check := regexp_replace(r.with_check, '\(\s*select\s+(auth\.(uid|role|jwt|email)\(\))\s*\)', '\1', 'gi');
      v_check := regexp_replace(v_check, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g');
      stmt := stmt || ' WITH CHECK (' || v_check || ')';
    end if;
    execute stmt;
  end loop;
end $$;
