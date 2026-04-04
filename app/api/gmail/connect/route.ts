import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildGmailConnectUrl,
  createGmailState,
  setGmailStateCookie,
  GMAIL_USER_COOKIE,
} from '@/lib/gmail';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const errorUrl = new URL('/mail', request.url);

  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      errorUrl.searchParams.set('gmail_error', 'Session utilisateur requise');
      return NextResponse.redirect(errorUrl);
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user }, error } = await sb.auth.getUser(token);

    if (error || !user) {
      errorUrl.searchParams.set('gmail_error', 'Session utilisateur introuvable. Veuillez vous reconnecter.');
      return NextResponse.redirect(errorUrl);
    }

    const state = createGmailState();
    const response = NextResponse.redirect(buildGmailConnectUrl(request, state));
    setGmailStateCookie(response, request, state);

    response.cookies.set(GMAIL_USER_COOKIE, user.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    errorUrl.searchParams.set('gmail_error', error instanceof Error ? error.message : 'Configuration Google manquante');
    return NextResponse.redirect(errorUrl);
  }
}
