import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildCalendarConnectUrl,
  createCalendarState,
  setCalendarStateCookie,
} from '@/lib/google-calendar';

export const runtime = 'nodejs';

const GCAL_USER_COOKIE = 'hellobat_gcal_uid';

export async function GET(request: NextRequest) {
  const errorUrl = new URL('/calendrier', request.url);

  try {
    // Get user from the access token passed as query param
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      errorUrl.searchParams.set('google_error', 'Session utilisateur requise');
      return NextResponse.redirect(errorUrl);
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user }, error } = await sb.auth.getUser(token);

    if (error || !user) {
      errorUrl.searchParams.set('google_error', 'Session utilisateur introuvable. Veuillez vous reconnecter.');
      return NextResponse.redirect(errorUrl);
    }

    const state = createCalendarState();
    const response = NextResponse.redirect(buildCalendarConnectUrl(request, state));
    setCalendarStateCookie(response, request, state);

    // Store userId in a secure cookie so callback can read it
    response.cookies.set(GCAL_USER_COOKIE, user.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    errorUrl.searchParams.set('google_error', error instanceof Error ? error.message : 'Configuration Google manquante');
    return NextResponse.redirect(errorUrl);
  }
}
