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

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: 'Utilisateur non authentifie' }, { status: 401 });
  }

  const { data: existingActiveMembership } = await supabaseAdmin
    .from('workspace_memberships')
    .select('id, owner_user_id, role, status')
    .eq('member_user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (existingActiveMembership) {
    return NextResponse.json({ ok: true, claimed: false, membership: existingActiveMembership });
  }

  const normalizedEmail = (user.email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return NextResponse.json({ ok: true, claimed: false });
  }

  const { data: pendingInvite } = await supabaseAdmin
    .from('workspace_memberships')
    .select('*')
    .eq('invited_email', normalizedEmail)
    .eq('status', 'pending')
    .is('member_user_id', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendingInvite) {
    return NextResponse.json({ ok: true, claimed: false });
  }

  const { data: ownerProfile } = await supabaseAdmin
    .from('profiles')
    .select('plan')
    .eq('id', pendingInvite.owner_user_id)
    .maybeSingle();

  if (!ownerProfile || ownerProfile.plan === 'starter') {
    return NextResponse.json({ ok: true, claimed: false, skipped: 'workspace_not_eligible' });
  }

  const { data: claimedMembership, error: claimError } = await supabaseAdmin
    .from('workspace_memberships')
    .update({
      member_user_id: user.id,
      status: 'active',
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', pendingInvite.id)
    .eq('status', 'pending')
    .is('member_user_id', null)
    .select('*')
    .maybeSingle();

  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 400 });
  }

  await supabaseAdmin
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return NextResponse.json({ ok: true, claimed: true, membership: claimedMembership });
}
