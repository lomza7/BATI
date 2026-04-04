import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateGmailRequest, getGmailConnection } from '@/lib/gmail';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await authenticateGmailRequest(request);
  if (auth instanceof NextResponse) return auth;

  const conn = await getGmailConnection(auth.userId);
  if (conn) {
    // Revoke token
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${conn.access_token}`, { method: 'POST' });
    } catch { /* best effort */ }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await sb.from('gmail_connections').delete().eq('user_id', auth.userId);
  }

  return NextResponse.json({ ok: true });
}
