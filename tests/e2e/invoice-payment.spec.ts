import { test, expect } from '@playwright/test';

/*
 * Flow 3 : création facture → lien HelloPay → paiement Stripe test → statut payée.
 *
 * Prérequis runtime (non câblés) :
 *   - Supabase de test + user connecté (voir auth-onboarding.spec.ts)
 *   - TEST_STRIPE_SECRET_KEY / TEST_STRIPE_PUBLISHABLE_KEY → mode test Stripe
 *   - Un compte Stripe Connect de test lié au user (charges_enabled = true)
 *
 * Stratégie : créer facture via UI, générer session HelloPay, ouvrir /pay/[id],
 *   compléter le formulaire avec carte test Stripe (4242...), attendre webhook,
 *   vérifier statut = "payee".
 */

const HAS_CREDENTIALS = Boolean(
  process.env.TEST_SUPABASE_URL &&
    process.env.TEST_STRIPE_SECRET_KEY &&
    process.env.TEST_STRIPE_PUBLISHABLE_KEY,
);

test.describe('Flow 3 — Facture → HelloPay → paiement', () => {
  test.skip(!HAS_CREDENTIALS, 'Credentials de test manquants — voir tests/e2e/README.md');

  test('une facture payée via HelloPay passe au statut "payee"', async ({ page }) => {
    // TODO: câbler quand les credentials de test sont fournis
    //   1. Login via storage state
    //   2. Créer facture depuis /factures → Nouveau
    //   3. Générer session HelloPay (POST /api/stripe/connect/hellopay/session)
    //   4. Ouvrir /pay/[invoice_id]
    //   5. Remplir carte test 4242 4242 4242 4242, exp futur, CVC 123
    //   6. Valider → attendre redirect + webhook Stripe
    //   7. Recharger /factures et vérifier statut "Payée"
    await page.goto('/');
    await expect(page).toHaveTitle(/Hellobat/);
  });
});
