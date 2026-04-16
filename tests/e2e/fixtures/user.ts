import type { SupabaseClient } from '@supabase/supabase-js';
import { getTestSupabaseAdmin } from './supabase';

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/**
 * Crée un user Supabase confirmé (bypass email verification) + un profil associé.
 * Le trigger handle_new_user() est censé créer le profil automatiquement ; on
 * attend brièvement puis on upsert pour garantir la présence des champs qu'on
 * utilise dans les assertions.
 */
export async function createTestUser(opts: {
  onboardingCompleted: boolean;
  companyName?: string;
}): Promise<TestUser> {
  const admin = getTestSupabaseAdmin();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `e2e-${suffix}@test.hellobat.app`;
  const password = `Test-${suffix}-Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? 'no user returned'}`);
  }
  const userId = data.user.id;

  // Laisse le trigger handle_new_user() s'exécuter.
  await new Promise((r) => setTimeout(r, 300));

  await admin
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        onboarding_completed: opts.onboardingCompleted,
        company_name: opts.companyName ?? (opts.onboardingCompleted ? 'E2E Artisans' : ''),
        full_name: opts.onboardingCompleted ? 'E2E Tester' : '',
      },
      { onConflict: 'id' },
    );

  return { id: userId, email, password };
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = getTestSupabaseAdmin();
  // cascade: l'ensemble des tables user-owned a FK ON DELETE CASCADE vers
  // auth.users via profiles.id. Si ce n'est pas le cas, la suppression user
  // échouera et laissera de l'orphelin → assainir au cas par cas.
  await admin.auth.admin.deleteUser(userId).catch(() => {
    // Tenter un nettoyage profile en fallback pour éviter de bloquer le test.
    return admin.from('profiles').delete().eq('id', userId);
  });
}

export async function setOnboardingCompleted(
  admin: SupabaseClient,
  userId: string,
  completed: boolean,
): Promise<void> {
  await admin
    .from('profiles')
    .update({ onboarding_completed: completed })
    .eq('id', userId);
}
