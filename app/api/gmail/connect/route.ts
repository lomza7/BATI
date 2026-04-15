import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  buildGmailConnectUrl,
  createGmailState,
  setGmailStateCookie,
  GMAIL_USER_COOKIE,
} from '@/lib/gmail';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: { user }, error } = await sb.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ error: 'Session utilisateur introuvable' }, { status: 401 });
    }

    const state = createGmailState();
    const redirectUrl = buildGmailConnectUrl(request, state);
    const response = NextResponse.json({ redirect_url: redirectUrl });
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Configuration Google manquante' },
      { status: 500 },
    );
  }
}
