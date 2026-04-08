import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => ({}));
  const code = String(body?.code || '').trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: 'Code de parrainage manquant.' }, { status: 400 });
  }

  // Look up the referrer by code (uses service role: codes are user-private in RLS)
  const { data: referralCode } = await supabaseAdmin
    .from('referral_codes')
    .select('user_id, code')
    .eq('code', code)
    .maybeSingle();

  if (!referralCode) {
    return NextResponse.json({ error: 'Code de parrainage introuvable.' }, { status: 404 });
  }

  if (referralCode.user_id === user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas vous parrainer vous-meme.' }, { status: 400 });
  }

  // Check if a signup already exists for this referred user
  const { data: existing } = await supabaseAdmin
    .from('referral_signups')
    .select('id')
    .eq('referred_user_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ already_claimed: true });
  }

  // Insert the signup link
  const { error: insertError } = await supabaseAdmin
    .from('referral_signups')
    .insert({
      referrer_user_id: referralCode.user_id,
      referred_user_id: user.id,
      code: referralCode.code,
    });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  // Mark profile as having a pending referral (used by checkout for the trial)
  await supabaseAdmin
    .from('profiles')
    .update({ pending_referral_code: referralCode.code })
    .eq('id', user.id);

  // Best-effort: link a matching invite (same recipient email) so the referrer sees the conversion
  if (user.email) {
    await supabaseAdmin
      .from('referral_invites')
      .update({
        signed_up_at: new Date().toISOString(),
        signed_up_user_id: user.id,
      })
      .eq('referrer_user_id', referralCode.user_id)
      .ilike('recipient_email', user.email)
      .is('signed_up_at', null);
  }

  return NextResponse.json({ success: true });
}
