import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('t');

  if (token) {
    try {
      const { data: invite } = await supabaseAdmin
        .from('referral_invites')
        .select('id, opened_at, open_count')
        .eq('tracking_token', token)
        .maybeSingle();

      if (invite) {
        await supabaseAdmin
          .from('referral_invites')
          .update({
            opened_at: invite.opened_at || new Date().toISOString(),
            open_count: (invite.open_count || 0) + 1,
          })
          .eq('id', invite.id);
      }
    } catch (e) {
      console.error('referral track-open error', e);
    }
  }

  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
