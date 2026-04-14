import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAccessState } from '@/lib/subscription';
import { getMonthlyUsage, AI_QUOTAS, AI_CREDIT_COSTS } from '@/lib/credits';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 503 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Session utilisateur requise' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await sb.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const [access, usage] = await Promise.all([getAccessState(user.id), getMonthlyUsage(user.id)]);

  return NextResponse.json({
    plan: access.plan,
    status: access.status,
    trialEndAt: access.trialEndAt?.toISOString() ?? null,
    daysLeftInTrial: access.daysLeftInTrial,
    hasProAccess: access.hasProAccess,
    creditsBalance: access.creditsBalance,
    usage: usage.ai,
    docUsage: usage.docs,
    docLimit: 5,
    quotas: AI_QUOTAS,
    creditCosts: AI_CREDIT_COSTS,
  });
}
