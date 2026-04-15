import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

// Admin-only test helper to simulate referral lifecycle events without
// depending on real email opens or Stripe webhooks. Used to validate
// the tracking flow locally / on staging.
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

  // Restrict to admin, gated by env flag in prod to eviter tout effet de bord public.
  const isAdmin = user.email === 'louis@maaza.pro';
  const isDev = process.env.NODE_ENV !== 'production';
  const enabled = process.env.ENABLE_REFERRAL_TEST === '1';
  if (!isAdmin && !isDev) {
    return NextResponse.json({ error: 'Action reservee aux administrateurs' }, { status: 403 });
  }
  if (!isDev && !enabled) {
    return NextResponse.json({ error: 'Endpoint desactive en production' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const inviteId = String(body?.invite_id || '').trim();
  const action = String(body?.action || '').trim();

  if (!inviteId || !['open', 'signup', 'subscribe', 'reset'].includes(action)) {
    return NextResponse.json({ error: 'Parametres invalides (invite_id, action)' }, { status: 400 });
  }

  // Verify ownership (admin can act on any invite, but enforce ownership otherwise)
  const { data: invite, error: inviteErr } = await supabaseAdmin
    .from('referral_invites')
    .select('id, referrer_user_id, recipient_email, opened_at, open_count, signed_up_at, signed_up_user_id')
    .eq('id', inviteId)
    .maybeSingle();

  if (inviteErr || !invite) {
    return NextResponse.json({ error: 'Invitation introuvable' }, { status: 404 });
  }

  if (!isAdmin && invite.referrer_user_id !== user.id) {
    return NextResponse.json({ error: 'Action non autorisee' }, { status: 403 });
  }

  const now = new Date().toISOString();

  try {
    if (action === 'open') {
      await supabaseAdmin
        .from('referral_invites')
        .update({
          opened_at: invite.opened_at || now,
          open_count: (invite.open_count || 0) + 1,
        })
        .eq('id', invite.id);
      return NextResponse.json({ success: true, action });
    }

    if (action === 'signup') {
      // Mark the invite as having generated a signup. We don't create a real
      // referral_signups row here because that would require a real referred user.
      await supabaseAdmin
        .from('referral_invites')
        .update({
          opened_at: invite.opened_at || now,
          open_count: invite.open_count || 1,
          signed_up_at: invite.signed_up_at || now,
        })
        .eq('id', invite.id);

      // Optional: create a synthetic signup row tied to the referrer themselves so
      // the stats RPC reflects the test. We use the referrer_user_id as referred too,
      // which the schema allows because referred_user_id has a UNIQUE constraint —
      // so we only create it if no row exists yet for this referrer's own account.
      const { data: existingSelfSignup } = await supabaseAdmin
        .from('referral_signups')
        .select('id')
        .eq('referred_user_id', invite.referrer_user_id)
        .maybeSingle();

      if (!existingSelfSignup) {
        await supabaseAdmin
          .from('referral_signups')
          .insert({
            referrer_user_id: invite.referrer_user_id,
            referred_user_id: invite.referrer_user_id,
            code: 'TEST',
            notes: 'test_trigger',
          });
      }
      return NextResponse.json({ success: true, action });
    }

    if (action === 'subscribe') {
      // Ensure the invite is marked as opened + signed up
      await supabaseAdmin
        .from('referral_invites')
        .update({
          opened_at: invite.opened_at || now,
          open_count: invite.open_count || 1,
          signed_up_at: invite.signed_up_at || now,
        })
        .eq('id', invite.id);

      // Make sure a signups row exists, then mark it subscribed
      let signupId: string | null = null;

      const { data: existingSignup } = await supabaseAdmin
        .from('referral_signups')
        .select('id')
        .eq('referred_user_id', invite.referrer_user_id)
        .maybeSingle();

      if (existingSignup) {
        signupId = existingSignup.id;
      } else {
        const { data: created } = await supabaseAdmin
          .from('referral_signups')
          .insert({
            referrer_user_id: invite.referrer_user_id,
            referred_user_id: invite.referrer_user_id,
            code: 'TEST',
            notes: 'test_trigger',
          })
          .select('id')
          .single();
        signupId = created?.id || null;
      }

      if (signupId) {
        await supabaseAdmin
          .from('referral_signups')
          .update({
            subscribed_at: now,
            subscription_plan: 'test',
            referred_credit_granted: true,
            referred_credit_granted_at: now,
            referrer_credit_granted: true,
            referrer_credit_granted_at: now,
            notes: 'test_trigger',
          })
          .eq('id', signupId);
      }

      return NextResponse.json({ success: true, action });
    }

    if (action === 'reset') {
      await supabaseAdmin
        .from('referral_invites')
        .update({
          opened_at: null,
          open_count: 0,
          signed_up_at: null,
          signed_up_user_id: null,
        })
        .eq('id', invite.id);

      // Clean any synthetic signup row created via test_trigger for this referrer
      await supabaseAdmin
        .from('referral_signups')
        .delete()
        .eq('referrer_user_id', invite.referrer_user_id)
        .eq('notes', 'test_trigger');

      return NextResponse.json({ success: true, action });
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur interne';
    console.error('test-trigger error', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
