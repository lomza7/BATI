/*
 * Cloudflare Turnstile — vérification côté serveur.
 *
 * Comportement :
 *  - Si TURNSTILE_SECRET_KEY n'est pas défini, on log un warning et on laisse passer
 *    (mode dev ou pas encore configuré). C'est volontaire pour ne pas casser les
 *    flows existants tant que le compte Cloudflare n'est pas branché.
 *  - Si la clé est définie, on POST le token à Cloudflare et on échoue dur si la
 *    vérification ne renvoie pas success=true.
 *
 * Setup en prod :
 *  1. Créer un site Turnstile sur https://dash.cloudflare.com/?to=/:account/turnstile
 *  2. Ajouter NEXT_PUBLIC_TURNSTILE_SITE_KEY (côté client) et TURNSTILE_SECRET_KEY
 *     (côté server) dans Vercel
 *  3. Pour signup/login/forgot-password : activer Turnstile dans le dashboard Supabase
 *     (Auth → Settings → Bot and Abuse Protection) — Supabase enforcera côté serveur
 *     dès que la config est en place.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult {
  ok: boolean;
  /** True quand la clé n'est pas configurée — la requête est laissée passer. */
  skipped?: boolean;
  /** Code Cloudflare en cas d'échec, à logger côté serveur uniquement. */
  errorCodes?: string[];
}

/**
 * Vérifie un token Turnstile auprès de Cloudflare.
 *
 * @param token Token retourné par le widget côté client (cf-turnstile-response).
 * @param remoteIp IP du client (facultatif, recommandé par Cloudflare).
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string,
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Pas de clé → on n'a pas configuré Turnstile, on laisse passer.
  // Visible dans les logs Vercel pour qu'on sache que la protection n'est pas active.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY missing — verification skipped');
    }
    return { ok: true, skipped: true };
  }

  if (!token || token.trim().length === 0) {
    return { ok: false, errorCodes: ['missing-input-response'] };
  }

  try {
    const formData = new URLSearchParams();
    formData.set('secret', secret);
    formData.set('response', token);
    if (remoteIp) formData.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    if (!res.ok) {
      console.error('[turnstile] verify HTTP error', res.status);
      return { ok: false, errorCodes: ['network-error'] };
    }

    const data = (await res.json()) as {
      success: boolean;
      'error-codes'?: string[];
    };

    if (!data.success) {
      console.error('[turnstile] verify failed', data['error-codes']);
      return { ok: false, errorCodes: data['error-codes'] };
    }

    return { ok: true };
  } catch (e) {
    console.error('[turnstile] verify threw', e);
    return { ok: false, errorCodes: ['exception'] };
  }
}
