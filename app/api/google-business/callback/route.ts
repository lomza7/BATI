import { NextRequest, NextResponse } from 'next/server';
import {
  clearGoogleStateCookie,
  createGoogleSessionFromCode,
  readGoogleStateCookie,
  setGoogleSessionCookie,
} from '@/lib/google-business';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL('/avis', request.url);

  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const storedState = readGoogleStateCookie();

    if (!code || !state || !storedState || state !== storedState) {
      url.searchParams.set('google_error', 'Connexion Google invalide ou expiree');
      const response = NextResponse.redirect(url);
      clearGoogleStateCookie(response);
      return response;
    }

    const session = await createGoogleSessionFromCode(request, code);
    url.searchParams.set('google_connected', '1');

    const response = NextResponse.redirect(url);
    clearGoogleStateCookie(response);
    setGoogleSessionCookie(response, request, session);
    return response;
  } catch (error) {
    url.searchParams.set('google_error', error instanceof Error ? error.message : 'Impossible de connecter Google');
    const response = NextResponse.redirect(url);
    clearGoogleStateCookie(response);
    return response;
  }
}
