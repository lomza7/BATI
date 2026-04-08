import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 503 });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
  }

  const { data: code, error: codeError } = await userClient.rpc('get_or_create_referral_code');
  if (codeError) {
    return NextResponse.json({ error: codeError.message }, { status: 400 });
  }

  const { data: stats } = await userClient.rpc('get_referral_stats');

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
  const link = `${origin.replace(/\/$/, '')}/signup?ref=${code}`;

  return NextResponse.json({
    code,
    link,
    stats: stats || {
      invites_sent: 0,
      invites_opened: 0,
      signups: 0,
      subscribed: 0,
      months_earned: 0,
    },
  });
}
