import { test, expect } from '@playwright/test';
import Stripe from 'stripe';
import { hasTestCredentials, getTestSupabaseAdmin } from './fixtures/supabase';
import { createTestUser, deleteTestUser } from './fixtures/user';
import { seedClient, seedInvoice } from './fixtures/seed';

/*
 * Flow 3 : facture → paiement HelloPay → webhook Stripe → statut "payee".
 *
 * Couverture actuelle :
 *   1. Seed user + client + facture via Supabase admin
 *   2. Construit un event Stripe `payment_intent.succeeded` avec
 *      metadata.source=hellopay + invoice_id, signé avec
 *      STRIPE_HELLOPAY_WEBHOOK_SECRET (Stripe.webhooks.generateTestHeaderString)
 *   3. POST l'event signé sur /api/stripe/connect/hellopay/webhook
 *   4. Vérifie que `invoices.status === 'payee'` et `paid_at` est setté
 *
 * Ce qui n'est PAS couvert (volontairement, marqué TODO) :
 *   - Navigation UI /pay/[id] avec PaymentElement Stripe Elements :
 *     nécessite une stripe_connection active + payment_client_secret valide
 *     côté Stripe réel. Peu de valeur ajoutée vs coût (l'iframe Stripe est
 *     leur responsabilité, pas la nôtre).
 *   - Test via Stripe CLI forwarding (ajouterait un binaire au CI).
 *
 * Ce test valide la partie la plus business-critique : le handler webhook
 * qui transitionne la facture en 'payee'. Une régression ici = argent
 * reçu sans statut DB → litige client.
 */

const HAS_WEBHOOK_SECRET = Boolean(process.env.STRIPE_HELLOPAY_WEBHOOK_SECRET);
const HAS_STRIPE_KEY = Boolean(process.env.TEST_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY);

test.describe('Flow 3 — Facture → webhook Stripe → statut payee', () => {
  test.skip(
    !hasTestCredentials() || !HAS_WEBHOOK_SECRET || !HAS_STRIPE_KEY,
    'Credentials manquants (Supabase + STRIPE_HELLOPAY_WEBHOOK_SECRET + STRIPE_SECRET_KEY) — voir tests/e2e/README.md',
  );

  test('un webhook payment_intent.succeeded HelloPay passe la facture à "payee"', async ({ request, baseURL }) => {
    const user = await createTestUser({ onboardingCompleted: true, companyName: 'E2E Artisans' });
    const admin = getTestSupabaseAdmin();
    let invoiceId: string | null = null;

    try {
      const client = await seedClient(admin, user.id);
      const invoice = await seedInvoice(admin, user.id, client.id, { totalHt: 500 });
      invoiceId = invoice.id;

      // Construit un event Stripe signé localement (pas d'appel API Stripe).
      const webhookSecret = process.env.STRIPE_HELLOPAY_WEBHOOK_SECRET!;
      const fakePaymentIntent = {
        id: `pi_test_${Date.now()}`,
        object: 'payment_intent',
        amount: 60_000,
        currency: 'eur',
        status: 'succeeded',
        metadata: {
          source: 'hellopay',
          invoice_id: invoice.id,
        },
      };
      const event = {
        id: `evt_test_${Date.now()}`,
        object: 'event',
        api_version: '2026-03-25.dahlia',
        type: 'payment_intent.succeeded',
        data: { object: fakePaymentIntent },
        created: Math.floor(Date.now() / 1000),
        livemode: false,
        pending_webhooks: 0,
        request: { id: null, idempotency_key: null },
      };
      const payload = JSON.stringify(event);
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
      });

      const res = await request.post(`${baseURL}/api/stripe/connect/hellopay/webhook`, {
        headers: {
          'stripe-signature': signature,
          'Content-Type': 'application/json',
        },
        data: payload,
      });
      expect(res.ok(), `webhook HTTP ${res.status()}: ${await res.text()}`).toBe(true);

      // Vérifie la transition en base.
      const { data: row, error } = await admin
        .from('invoices')
        .select('status, paid_at')
        .eq('id', invoice.id)
        .single();
      expect(error).toBeNull();
      expect(row?.status).toBe('payee');
      expect(row?.paid_at).toBeTruthy();
    } finally {
      if (invoiceId) {
        await admin.from('invoice_lines').delete().eq('invoice_id', invoiceId);
        await admin.from('invoice_sends').delete().eq('invoice_id', invoiceId);
        await admin.from('invoices').delete().eq('id', invoiceId);
      }
      await deleteTestUser(user.id);
    }
  });
});
