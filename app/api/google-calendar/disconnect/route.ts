import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest, getValidAccessToken } from '@/lib/google-calendar';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  // Optionally revoke token
  try {
    const token = await getValidAccessToken(auth.userId);
    if (token) {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    }
  } catch {
    // Revocation failure is non-critical
  }

  // Delete connection
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  await sb.from('google_calendar_connections').delete().eq('user_id', auth.userId);

  return NextResponse.json({ ok: true });
}
