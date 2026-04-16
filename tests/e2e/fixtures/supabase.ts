import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PROD_REF = 'ijdscgzpswlskwaozbuh';

export function getTestSupabaseAdmin(): SupabaseClient {
  const url = process.env.TEST_SUPABASE_URL;
  const serviceRole = process.env.TEST_SUPABASE_SERVICE_ROLE;

  if (!url || !serviceRole) {
    throw new Error(
      'TEST_SUPABASE_URL et TEST_SUPABASE_SERVICE_ROLE sont requis pour les tests E2E',
    );
  }

  if (url.includes(PROD_REF)) {
    throw new Error(
      `Refus de pointer les tests E2E vers le projet prod (${PROD_REF}). Utiliser une branche Supabase de test.`,
    );
  }

  return createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasTestCredentials(): boolean {
  return Boolean(
    process.env.TEST_SUPABASE_URL &&
      process.env.TEST_SUPABASE_ANON_KEY &&
      process.env.TEST_SUPABASE_SERVICE_ROLE,
  );
}
