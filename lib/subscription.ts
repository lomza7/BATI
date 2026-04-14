// Paywall helpers — calcul de l'état d'accès d'un user (plan, trial, crédits).
// Serveur uniquement (utilise le service role pour lire profiles sans RLS).

import { supabaseAdmin } from './supabase-admin';

export type Plan = 'free' | 'pro';
export type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'free';

export interface AccessState {
  plan: Plan;
  status: SubStatus;
  trialEndAt: Date | null;
  daysLeftInTrial: number | null;
  hasProAccess: boolean;
  creditsBalance: number;
  stripeCustomerId: string | null;
}

export async function getAccessState(userId: string): Promise<AccessState> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('plan, subscription_status, trial_end_at, ai_credits_balance, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (!data) {
    return {
      plan: 'free',
      status: 'free',
      trialEndAt: null,
      daysLeftInTrial: null,
      hasProAccess: false,
      creditsBalance: 0,
      stripeCustomerId: null,
    };
  }

  const plan = (data.plan === 'pro' ? 'pro' : 'free') as Plan;
  const status = (data.subscription_status as SubStatus) || 'free';
  const trialEndAt = data.trial_end_at ? new Date(data.trial_end_at) : null;

  const now = Date.now();
  const daysLeftInTrial = trialEndAt
    ? Math.max(0, Math.ceil((trialEndAt.getTime() - now) / 86_400_000))
    : null;

  const trialActive = status === 'trialing' && trialEndAt !== null && trialEndAt.getTime() > now;
  const hasProAccess = plan === 'pro' && (status === 'active' || trialActive);

  return {
    plan,
    status,
    trialEndAt,
    daysLeftInTrial,
    hasProAccess,
    creditsBalance: data.ai_credits_balance ?? 0,
    stripeCustomerId: data.stripe_customer_id ?? null,
  };
}

export function canUseProFeatures(s: AccessState): boolean {
  return s.hasProAccess;
}
export function canAccessAI(s: AccessState): boolean {
  return s.hasProAccess;
}
