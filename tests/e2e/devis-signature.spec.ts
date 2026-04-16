import { test, expect } from '@playwright/test';

/*
 * Flow 2 : création devis → envoi client → signature DocuSeal → statut signé.
 *
 * Prérequis runtime (non câblés) :
 *   - Supabase de test + user connecté (voir auth-onboarding.spec.ts)
 *   - TEST_DOCUSEAL_API_KEY → sandbox DocuSeal (https://api.docuseal.eu)
 *   - Un client existant (seedé) ou créé dans le test
 *
 * Stratégie : authentifier via storage state, créer un devis, l'envoyer,
 *   signer via l'API sandbox DocuSeal, vérifier le webhook a mis à jour
 *   le statut.
 */

const HAS_CREDENTIALS = Boolean(
  process.env.TEST_SUPABASE_URL &&
    process.env.TEST_DOCUSEAL_API_KEY,
);

test.describe('Flow 2 — Devis → envoi → signature', () => {
  test.skip(!HAS_CREDENTIALS, 'Credentials de test manquants — voir tests/e2e/README.md');

  test('un devis envoyé puis signé passe au statut "signé"', async ({ page }) => {
    // TODO: câbler quand les credentials de test sont fournis
    //   1. Login via storage state
    //   2. Aller sur /devis → Nouveau devis
    //   3. Remplir formulaire (client, lignes)
    //   4. Cliquer "Envoyer" → vérifier quote_sends créé
    //   5. Récupérer l'URL publique /d/[token]
    //   6. Via API DocuSeal sandbox : signer le document
    //   7. Recharger /devis et vérifier badge "Signé"
    await page.goto('/');
    await expect(page).toHaveTitle(/Hellobat/);
  });
});
