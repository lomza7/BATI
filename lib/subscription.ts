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
  /** Crédits mensuels Pro restants (se rechargent à la date anniversaire). */
  monthlyCreditsRemaining: number;
  /** Allocation mensuelle totale du plan. */
  monthlyCreditsAllocation: number;
  /** Crédits permanents issus de packs achetés (ne se péremeront pas). */
  purchasedCreditsBalance: number;
  /** Total affiché au user = mensuel restant + permanents. */
  creditsBalance: number;
  /** Prochaine date de recharge des crédits mensuels. */
  creditsNextRefillAt: Date | null;
  stripeCustomerId: string | null;
}

export async function getAccessState(userId: string): Promise<AccessState> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select(
      'plan, subscription_status, trial_end_at, ai_credits_balance, stripe_customer_id, monthly_credits_allocation, monthly_credits_used, credits_period_start',
    )
    .eq('id', userId)
    .maybeSingle();

  if (!data) {
    return {
      plan: 'free',
      status: 'free',
      trialEndAt: null,
      daysLeftInTrial: null,
      hasProAccess: false,
      monthlyCreditsRemaining: 0,
      monthlyCreditsAllocation: 0,
      purchasedCreditsBalance: 0,
      creditsBalance: 0,
      creditsNextRefillAt: null,
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

  const allocation = data.monthly_credits_allocation ?? 0;
  const used = data.monthly_credits_used ?? 0;
  const monthlyRemaining = Math.max(allocation - used, 0);
  const purchased = data.ai_credits_balance ?? 0;

  // Prochaine recharge = credits_period_start + 1 mois (avance en live dans consume_ai).
  let nextRefill: Date | null = null;
  if (data.credits_period_start) {
    const start = new Date(data.credits_period_start);
    nextRefill = new Date(start);
    nextRefill.setMonth(nextRefill.getMonth() + 1);
  }

  return {
    plan,
    status,
    trialEndAt,
    daysLeftInTrial,
    hasProAccess,
    monthlyCreditsRemaining: monthlyRemaining,
    monthlyCreditsAllocation: allocation,
    purchasedCreditsBalance: purchased,
    creditsBalance: monthlyRemaining + purchased,
    creditsNextRefillAt: nextRefill,
    stripeCustomerId: data.stripe_customer_id ?? null,
  };
}

export function canUseProFeatures(s: AccessState): boolean {
  return s.hasProAccess;
}
export function canAccessAI(s: AccessState): boolean {
  return s.hasProAccess;
}
