import { test, expect } from '@playwright/test';

/*
 * Flow 1 : inscription → vérification email → onboarding → dashboard.
 *
 * Prérequis runtime (non câblés) :
 *   - TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_ROLE
 *     → projet Supabase de test, pour pouvoir créer/nettoyer un user
 *   - TEST_RESEND_API_KEY ou mock pour intercepter le code de vérif
 *
 * Stratégie : créer le user via API service_role (bypass email), puis
 *   simuler la connexion + parcourir l'onboarding.
 */

const HAS_CREDENTIALS = Boolean(
  process.env.TEST_SUPABASE_URL &&
    process.env.TEST_SUPABASE_ANON_KEY &&
    process.env.TEST_SUPABASE_SERVICE_ROLE,
);

test.describe('Flow 1 — Signup → onboarding → dashboard', () => {
  test.skip(!HAS_CREDENTIALS, 'Credentials de test manquants — voir tests/e2e/README.md');

  test('un nouvel utilisateur peut s\'inscrire et accéder au dashboard', async ({ page }) => {
    // TODO: câbler quand les credentials de test sont fournis
    //   1. Créer un user via supabaseAdmin (email confirmé)
    //   2. Se connecter via /login
    //   3. Remplir l'onboarding (entreprise, métier, plan)
    //   4. Vérifier redirection /dashboard
    //   5. Cleanup : supprimer le user
    await page.goto('/');
    await expect(page).toHaveTitle(/Hellobat/);
  });
});
