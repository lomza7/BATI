import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const authHeader = request.headers.get('authorization')!;
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const [statsRes, referrersRes] = await Promise.all([
    userClient.rpc('get_admin_referral_stats'),
    userClient.rpc('get_admin_referrals'),
  ]);

  if (statsRes.error) {
    return NextResponse.json({ error: statsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    stats: statsRes.data || {},
    referrers: referrersRes.data || [],
  });
}
