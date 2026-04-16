import { test, expect } from '@playwright/test';
import { hasTestCredentials } from './fixtures/supabase';
import { createTestUser, deleteTestUser } from './fixtures/user';
import { loginViaUI } from './fixtures/auth';

/*
 * Flow 1 : signup → onboarding → dashboard.
 *
 * Stratégie :
 *   - On BYPASS le formulaire /signup (Turnstile + email verification) et
 *     on crée directement le user via `supabase.auth.admin.createUser`
 *     avec email_confirm=true. Équivalent fonctionnel côté produit : un
 *     user qui clique sur le lien de vérif dans son email.
 *   - Le login passe par l'UI réelle (/login). Le captcha Turnstile
 *     s'auto-bypass quand NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas défini
 *     (voir components/shared/turnstile.tsx).
 *
 * On ne drill pas les 9 étapes du modal onboarding (file uploads, Pappers
 * API, flaky). On vérifie seulement les deux invariants :
 *   A. Un user fresh voit bien le modal d'onboarding après login.
 *   B. Un user dont onboarding_completed=true n'est PAS bloqué par le modal
 *      et accède au dashboard.
 */

test.describe('Flow 1 — Signup → onboarding → dashboard', () => {
  test.skip(!hasTestCredentials(), 'Credentials de test manquants — voir tests/e2e/README.md');

  test('un user onboardé atteint le dashboard après login', async ({ page }) => {
    const user = await createTestUser({ onboardingCompleted: true });
    try {
      await loginViaUI(page, user.email, user.password);
      // Assertion dashboard: l'URL change vers /dashboard (déjà vérifié par
      // loginViaUI), et le modal onboarding ne doit PAS apparaître.
      const onboardingDialog = page.getByRole('dialog', {
        name: /configuration de votre compte/i,
      });
      await expect(onboardingDialog).toBeHidden({ timeout: 3_000 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test('un user fresh voit le modal onboarding après login', async ({ page }) => {
    const user = await createTestUser({ onboardingCompleted: false });
    try {
      await loginViaUI(page, user.email, user.password);
      const onboardingDialog = page.getByRole('dialog', {
        name: /configuration de votre compte/i,
      });
      await expect(onboardingDialog).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('#fullName')).toBeVisible();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
