import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }
  const token = authHeader.replace('Bearer ', '').trim();

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await sb.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const { data: connection } = await supabaseAdmin
    .from('stripe_connections')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  // Refresh from Stripe if key available
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey && connection.stripe_account_id) {
    try {
      const stripe = new Stripe(stripeKey, { apiVersion: '2026-03-25.dahlia' });
      const account = await stripe.accounts.retrieve(connection.stripe_account_id);

      const updates = {
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        onboarding_completed: (account.charges_enabled && account.details_submitted) ?? false,
        updated_at: new Date().toISOString(),
      };

      await supabaseAdmin
        .from('stripe_connections')
        .update(updates)
        .eq('user_id', user.id);

      return NextResponse.json({
        connected: true,
        ...updates,
        stripe_account_id: connection.stripe_account_id,
      });
    } catch {
      // Stripe error — return cached DB data
    }
  }

  return NextResponse.json({
    connected: true,
    charges_enabled: connection.charges_enabled,
    payouts_enabled: connection.payouts_enabled,
    details_submitted: connection.details_submitted,
    onboarding_completed: connection.onboarding_completed,
    stripe_account_id: connection.stripe_account_id,
  });
}
