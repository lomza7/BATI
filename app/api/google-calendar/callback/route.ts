import { NextRequest, NextResponse } from 'next/server';
import {
  clearCalendarStateCookie,
  exchangeCalendarCode,
  readCalendarStateCookie,
  upsertCalendarConnection,
} from '@/lib/google-calendar';

export const runtime = 'nodejs';

const GCAL_USER_COOKIE = 'hellobat_gcal_uid';

export async function GET(request: NextRequest) {
  const url = new URL('/calendrier', request.url);

  try {
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const storedState = readCalendarStateCookie(request);

    if (!code || !state || !storedState || state !== storedState) {
      url.searchParams.set('google_error', 'Connexion Google Calendar invalide ou expiree');
      const response = NextResponse.redirect(url);
      clearCalendarStateCookie(response);
      return response;
    }

    // Read userId from the cookie set during /connect
    const userId = request.cookies.get(GCAL_USER_COOKIE)?.value;

    if (!userId) {
      url.searchParams.set('google_error', 'Session utilisateur introuvable. Veuillez vous reconnecter.');
      const response = NextResponse.redirect(url);
      clearCalendarStateCookie(response);
      return response;
    }

    const tokens = await exchangeCalendarCode(request, code);
    await upsertCalendarConnection(userId, tokens);

    url.searchParams.set('google_calendar_connected', '1');
    const response = NextResponse.redirect(url);
    clearCalendarStateCookie(response);
    // Clear the userId cookie
    response.cookies.set(GCAL_USER_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    url.searchParams.set('google_error', error instanceof Error ? error.message : 'Impossible de connecter Google Calendar');
    const response = NextResponse.redirect(url);
    clearCalendarStateCookie(response);
    return response;
  }
}
