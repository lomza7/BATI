import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildGoogleConnectUrl, createGoogleState, setGoogleStateCookie } from '@/lib/google-business';

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

    const state = createGoogleState();
    const response = NextResponse.json({ redirect_url: buildGoogleConnectUrl(request, state) });
    setGoogleStateCookie(response, request, state);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Configuration Google manquante' },
      { status: 500 },
    );
  }
}
