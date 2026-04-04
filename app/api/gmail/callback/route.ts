import { NextRequest, NextResponse } from 'next/server';
import {
  clearGmailStateCookie,
  exchangeGmailCode,
  readGmailStateCookie,
  upsertGmailConnection,
  gmailFetch,
  GMAIL_USER_COOKIE,
} from '@/lib/gmail';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL('/mail', request.url);

  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const storedState = readGmailStateCookie(request);

    if (!code || !state || !storedState || state !== storedState) {
      url.searchParams.set('gmail_error', 'Connexion Gmail invalide ou expiree');
      const response = NextResponse.redirect(url);
      clearGmailStateCookie(response);
      return response;
    }

    const userId = request.cookies.get(GMAIL_USER_COOKIE)?.value;
    if (!userId) {
      url.searchParams.set('gmail_error', 'Session utilisateur introuvable. Veuillez vous reconnecter.');
      const response = NextResponse.redirect(url);
      clearGmailStateCookie(response);
      return response;
    }

    const tokens = await exchangeGmailCode(request, code);

    // Get the user's email address from Gmail profile
    let emailAddress = '';
    try {
      const profile = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: 'no-store',
      });
      const profileData = await profile.json() as { emailAddress?: string };
      emailAddress = profileData.emailAddress || '';
    } catch { /* non-critical */ }

    await upsertGmailConnection(userId, tokens, emailAddress);

    url.searchParams.set('gmail_connected', '1');
    const response = NextResponse.redirect(url);
    clearGmailStateCookie(response);
    response.cookies.set(GMAIL_USER_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    url.searchParams.set('gmail_error', error instanceof Error ? error.message : 'Impossible de connecter Gmail');
    const response = NextResponse.redirect(url);
    clearGmailStateCookie(response);
    return response;
  }
}
