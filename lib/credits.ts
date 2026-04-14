// Paywall — quotas mensuels IA + coûts en crédits + appel consume_ai().
// Serveur uniquement.

import { supabaseAdmin } from './supabase-admin';

/**
 * Allocation mensuelle de crédits pour un abonné Pro.
 * Rechargée automatiquement à la date anniversaire du compte via la
 * fonction SQL `refresh_credits_period` appelée depuis `consume_ai`.
 */
export const MONTHLY_CREDITS_ALLOCATION = 300;

export const AI_CREDIT_COSTS = {
  quote_ai: 3,
  agent: 3,
  email_ai: 3,
  accounting_ai: 3,
  before_after: 5,
  site_web: 15,
} as const;

/**
 * Quotas offerts aux utilisateurs du plan Gratuit (sans Pro).
 * Seul `quote_ai` est partagé à hauteur de 3/mois, les autres features
 * IA restent derrière le paywall Pro.
 */
export const AI_FREE_QUOTAS: Record<keyof typeof AI_CREDIT_COSTS, number> = {
  quote_ai: 3,
  agent: 0,
  email_ai: 0,
  accounting_ai: 0,
  before_after: 0,
  site_web: 0,
};

export type AiFeature = keyof typeof AI_CREDIT_COSTS;

export type ConsumeAiResult =
  | {
      ok: true;
      source: 'credits' | 'free_quota';
      consumed?: number;
      monthly_consumed?: number;
      purchased_consumed?: number;
      monthly_remaining?: number;
      purchased?: number;
    }
  | {
      ok: false;
      reason: 'no_pro_access' | 'insufficient_credits' | 'free_quota_reached';
      balance?: number;
      monthly_remaining?: number;
      purchased?: number;
      required?: number;
      limit?: number;
      used?: number;
    };

export async function consumeAi(userId: string, feature: AiFeature): Promise<ConsumeAiResult> {
  const { data, error } = await supabaseAdmin.rpc('consume_ai', {
    p_user_id: userId,
    p_feature: feature,
    p_quota: AI_FREE_QUOTAS[feature],
    p_credit_cost: AI_CREDIT_COSTS[feature],
  });

  if (error) {
    console.error('[consumeAi] rpc error', error);
    return { ok: false, reason: 'no_pro_access' };
  }
  return data as ConsumeAiResult;
}

/**
 * Gate "Pro access only" (pas de conso) — pour les sous-routes IA utilitaires
 * (transcription vocale, plan projet, description chantier) appelées plusieurs
 * fois par session. Le coût est perçu sur l'action finale (ex: quote_ai).
 */
export async function requireProAccess(userId: string): Promise<
  { ok: true } | { ok: false; reason: 'no_pro_access' }
> {
  const { data } = await supabaseAdmin.rpc('has_pro_access', { p_user_id: userId });
  return data === true ? { ok: true } : { ok: false, reason: 'no_pro_access' };
}

export async function getMonthlyUsage(
  userId: string,
): Promise<{ ai: Record<AiFeature, number>; docs: { quote: number; invoice: number } }> {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const { data } = await supabaseAdmin
    .from('usage_counters')
    .select('feature, count')
    .eq('user_id', userId)
    .eq('period', period);

  const ai = Object.fromEntries(
    (Object.keys(AI_CREDIT_COSTS) as AiFeature[]).map((k) => [k, 0]),
  ) as Record<AiFeature, number>;
  const docs = { quote: 0, invoice: 0 };

  for (const row of data ?? []) {
    if (row.feature in ai) {
      ai[row.feature as AiFeature] = row.count ?? 0;
    } else if (row.feature === 'quote') docs.quote = row.count ?? 0;
    else if (row.feature === 'invoice') docs.invoice = row.count ?? 0;
  }
  return { ai, docs };
}
