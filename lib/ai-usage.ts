// AI usage tracking & rate limiting (server-side only)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey);
}

interface AiUsageEntry {
  user_id: string;
  route: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  status?: 'success' | 'error';
}

/**
 * Log an AI API call to the ai_usage table.
 * Uses service role to bypass RLS.
 */
export async function trackAiUsage(entry: AiUsageEntry) {
  const sb = getAdminClient();
  await sb.from('ai_usage').insert({
    user_id: entry.user_id,
    route: entry.route,
    model: entry.model || null,
    input_tokens: entry.input_tokens || 0,
    output_tokens: entry.output_tokens || 0,
    status: entry.status || 'success',
  });
}

interface LimitCheck {
  allowed: boolean;
  reason?: string;
  usage?: { calls: number; tokens: number };
  limits?: { monthly_calls: number; monthly_tokens: number };
}

/**
 * Check if a user is allowed to make an AI call.
 * Returns { allowed, reason } — caller should return 429 if not allowed.
 */
export async function checkAiLimit(userId: string): Promise<LimitCheck> {
  const sb = getAdminClient();

  // 1. Check manual block
  const { data: profile } = await sb
    .from('profiles')
    .select('plan, ai_blocked, ai_blocked_reason')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return { allowed: false, reason: 'Profil introuvable' };
  }

  if (profile.ai_blocked) {
    return {
      allowed: false,
      reason: profile.ai_blocked_reason || 'Votre acces IA a ete desactive. Contactez le support.',
    };
  }

  // 2. Get plan limits
  const plan = profile.plan || 'starter';
  const { data: limits } = await sb
    .from('ai_plan_limits')
    .select('monthly_calls, monthly_tokens')
    .eq('plan', plan)
    .maybeSingle();

  if (!limits) {
    // No limits defined for this plan — allow by default
    return { allowed: true };
  }

  // -1 means unlimited
  if (limits.monthly_calls === -1 && limits.monthly_tokens === -1) {
    return { allowed: true, limits };
  }

  // 3. Count this month's usage
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: usageRows } = await sb
    .from('ai_usage')
    .select('input_tokens, output_tokens')
    .eq('user_id', userId)
    .eq('status', 'success')
    .gte('created_at', startOfMonth.toISOString());

  const calls = usageRows?.length || 0;
  const tokens = (usageRows || []).reduce(
    (sum, row) => sum + (row.input_tokens || 0) + (row.output_tokens || 0),
    0
  );

  const usage = { calls, tokens };

  // 4. Check limits
  if (limits.monthly_calls !== -1 && calls >= limits.monthly_calls) {
    return {
      allowed: false,
      reason: `Limite atteinte : ${calls}/${limits.monthly_calls} appels IA ce mois. Passez au plan superieur pour continuer.`,
      usage,
      limits,
    };
  }

  if (limits.monthly_tokens !== -1 && tokens >= limits.monthly_tokens) {
    return {
      allowed: false,
      reason: `Limite de tokens atteinte ce mois. Passez au plan superieur pour continuer.`,
      usage,
      limits,
    };
  }

  return { allowed: true, usage, limits };
}
