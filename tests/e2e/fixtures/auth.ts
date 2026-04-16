import type { Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Login via l'UI /login. Suppose que NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est
 * pas défini côté app (le captcha s'auto-bypass, voir
 * components/shared/turnstile.tsx) — c'est le cas par défaut en CI.
 */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await page.waitForURL(/\/dashboard(\/|\?|$)/, { timeout: 15_000 });
}

/**
 * Récupère un access_token Supabase pour un user de test. Utile pour
 * appeler les routes API authentifiées (POST /api/docuseal/create-submission,
 * etc.) sans passer par l'UI.
 */
export async function getAccessToken(email: string, password: string): Promise<string> {
  const url = process.env.TEST_SUPABASE_URL!;
  const anonKey = process.env.TEST_SUPABASE_ANON_KEY!;
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`signInWithPassword failed: ${error?.message ?? 'no session'}`);
  }
  return data.session.access_token;
}
