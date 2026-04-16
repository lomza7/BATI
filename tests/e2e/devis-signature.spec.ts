import { test, expect } from '@playwright/test';
import { hasTestCredentials, getTestSupabaseAdmin } from './fixtures/supabase';
import { createTestUser, deleteTestUser } from './fixtures/user';
import { getAccessToken } from './fixtures/auth';
import { seedClient, seedQuote } from './fixtures/seed';

/*
 * Flow 2 : création devis → envoi → signature DocuSeal → statut "signé".
 *
 * Couverture actuelle :
 *   1. Seed user + client + devis via Supabase admin
 *   2. POST /api/docuseal/create-submission avec un token user réel
 *      → crée une submission DocuSeal sandbox + quote_sends row avec token
 *   3. Navigate /d/[token] : vérifie que la page publique de signature
 *      se rend (sans crasher) et expose la zone de signature DocuSeal
 *
 * Ce qui n'est PAS couvert (volontairement, marqué TODO) :
 *   - Simuler la signature effective côté client DocuSeal sandbox
 *     (nécessite d'appeler l'API DocuSeal pour compléter le submitter)
 *   - Déclencher le webhook /api/docuseal/webhook et vérifier que le
 *     statut du devis passe à 'signé'
 *
 *   Raison : le webhook Hellobat re-fetch la submission côté DocuSeal pour
 *   vérifier status==='completed' (voir app/api/docuseal/webhook/route.ts).
 *   Simuler le webhook sans avoir réellement complété la signature côté
 *   sandbox échoue au double-check. Le câblage complet demande un test
 *   dédié qui complète la submission via l'API DocuSeal sandbox.
 */

const HAS_DOCUSEAL = Boolean(process.env.TEST_DOCUSEAL_API_KEY);

test.describe('Flow 2 — Devis → envoi → page signature publique', () => {
  test.skip(
    !hasTestCredentials() || !HAS_DOCUSEAL,
    'Credentials manquants (Supabase + DOCUSEAL) — voir tests/e2e/README.md',
  );

  test('un devis envoyé génère un token public et la page /d/[token] se rend', async ({ page, request, baseURL }) => {
    const user = await createTestUser({ onboardingCompleted: true, companyName: 'E2E Artisans' });
    const admin = getTestSupabaseAdmin();
    let quoteId: string | null = null;

    try {
      const client = await seedClient(admin, user.id);
      const quote = await seedQuote(admin, user.id, client.id);
      quoteId = quote.id;

      const accessToken = await getAccessToken(user.email, user.password);

      const res = await request.post(`${baseURL}/api/docuseal/create-submission`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          quote_id: quote.id,
          client_name: client.name,
          client_email: client.email,
          expires_in_days: 30,
          excluded_attachment_ids: [],
        },
      });
      expect(res.ok(), `create-submission HTTP ${res.status()}: ${await res.text()}`).toBe(true);

      // Récupère le token public depuis quote_sends
      const { data: sends, error: sendsErr } = await admin
        .from('quote_sends')
        .select('token, docuseal_submission_id')
        .eq('quote_id', quote.id)
        .order('created_at', { ascending: false })
        .limit(1);
      expect(sendsErr).toBeNull();
      expect(sends?.[0]?.token).toBeTruthy();
      const token = sends![0].token;

      await page.goto(`/d/${token}`);
      // La page publique doit charger sans renvoyer une 404/500 et exposer
      // un élément identifiant le flow de signature (DocuSeal embed ou
      // fallback texte).
      await expect(page).toHaveTitle(/Hellobat|Devis|Signature/i, { timeout: 10_000 });
      // Le composant <DocusealSigning> monte une iframe DocuSeal. Si la
      // signature n'est pas encore completée, on s'attend à voir soit le
      // widget (iframe) soit un état "en cours". On tolère les deux.
      const iframeOrSignInfo = page.locator('iframe').or(
        page.getByText(/signature|signer|docuseal/i).first(),
      );
      await expect(iframeOrSignInfo.first()).toBeVisible({ timeout: 15_000 });

      // Invariant DB : le devis n'est pas encore 'signé' (pas de webhook tiré).
      const { data: quoteRow } = await admin
        .from('quotes')
        .select('status, signed_at')
        .eq('id', quote.id)
        .single();
      expect(quoteRow?.status).not.toBe('signé');
      expect(quoteRow?.signed_at).toBeNull();

      // TODO: simuler la signature via DocuSeal sandbox API puis fire
      //       POST /api/docuseal/webhook avec x-docuseal-secret header.
      //       Nécessite :
      //       - DOCUSEAL_WEBHOOK_SECRET défini en CI (app + request)
      //       - Appel à l'API DocuSeal sandbox pour marquer le submitter
      //         comme complété (nécessaire sinon le webhook re-fetch la
      //         submission et skip avec 'status_not_completed').
    } finally {
      if (quoteId) {
        await admin.from('quote_sends').delete().eq('quote_id', quoteId);
        await admin.from('quote_lines').delete().eq('quote_id', quoteId);
        await admin.from('quotes').delete().eq('id', quoteId);
      }
      await deleteTestUser(user.id);
    }
  });
});
