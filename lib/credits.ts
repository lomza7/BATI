// Paywall — quotas mensuels IA + coûts en crédits + appel consume_ai().
// Serveur uniquement.

import { supabaseAdmin } from './supabase-admin';

export const AI_QUOTAS = {
  quote_ai: 50,
  agent: 50,
  email_ai: 50,
  accounting_ai: 50,
  before_after: 10,
  site_web: 3,
} as const;

export const AI_CREDIT_COSTS = {
  quote_ai: 3,
  agent: 3,
  email_ai: 3,
  accounting_ai: 3,
  before_after: 5,
  site_web: 15,
} as const;

/**
 * Quotas mensuels offerts aux utilisateurs du plan Gratuit (sans Pro).
 * Zéro par défaut — seul quote_ai est offert à hauteur de 3 / mois pour
 * que les artisans testent la génération IA avant de passer au Pro.
 */
export const AI_FREE_QUOTAS: Record<keyof typeof AI_QUOTAS, number> = {
  quote_ai: 3,
  agent: 0,
  email_ai: 0,
  accounting_ai: 0,
  before_after: 0,
  site_web: 0,
};

export type AiFeature = keyof typeof AI_QUOTAS;

export type ConsumeAiResult =
  | {
      ok: true;
      source: 'quota' | 'credits' | 'free_quota';
      balance?: number;
      consumed?: number;
    }
  | {
      ok: false;
      reason: 'no_pro_access' | 'insufficient_credits' | 'free_quota_reached';
      balance?: number;
      required?: number;
      limit?: number;
      used?: number;
    };

export async function consumeAi(userId: string, feature: AiFeature): Promise<ConsumeAiResult> {
  const { data, error } = await supabaseAdmin.rpc('consume_ai', {
    p_user_id: userId,
    p_feature: feature,
    p_quota: AI_QUOTAS[feature],
    p_credit_cost: AI_CREDIT_COSTS[feature],
    p_free_quota: AI_FREE_QUOTAS[feature],
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
    (Object.keys(AI_QUOTAS) as AiFeature[]).map((k) => [k, 0]),
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
