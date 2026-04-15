import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminRequest } from '@/lib/admin';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: list usage per user (aggregated this month)
export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const sb = getAdminClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Get all usage this month
  const { data: usage } = await sb
    .from('ai_usage')
    .select('user_id, route, input_tokens, output_tokens, status, created_at')
    .gte('created_at', startOfMonth.toISOString())
    .order('created_at', { ascending: false });

  // Get profiles with block status
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, company_name, full_name, plan, ai_blocked, ai_blocked_reason');

  // Get limits
  const { data: limits } = await sb
    .from('ai_plan_limits')
    .select('*');

  // Aggregate per user
  const userMap = new Map<string, {
    user_id: string;
    company_name: string;
    full_name: string;
    plan: string;
    ai_blocked: boolean;
    ai_blocked_reason: string;
    calls: number;
    tokens: number;
    last_call: string | null;
    routes: Record<string, number>;
  }>();

  for (const p of profiles || []) {
    userMap.set(p.id, {
      user_id: p.id,
      company_name: p.company_name || '—',
      full_name: p.full_name || '—',
      plan: p.plan || 'starter',
      ai_blocked: p.ai_blocked || false,
      ai_blocked_reason: p.ai_blocked_reason || '',
      calls: 0,
      tokens: 0,
      last_call: null,
      routes: {},
    });
  }

  for (const row of usage || []) {
    if (row.status !== 'success') continue;
    const entry = userMap.get(row.user_id);
    if (!entry) continue;
    entry.calls += 1;
    entry.tokens += (row.input_tokens || 0) + (row.output_tokens || 0);
    if (!entry.last_call) entry.last_call = row.created_at;
    entry.routes[row.route] = (entry.routes[row.route] || 0) + 1;
  }

  // Only return users who have usage or are blocked
  const usersWithUsage = Array.from(userMap.values())
    .filter(u => u.calls > 0 || u.ai_blocked)
    .sort((a, b) => b.tokens - a.tokens);

  return NextResponse.json({
    users: usersWithUsage,
    limits: limits || [],
  });
}

// POST: block/unblock a user or update limits
export async function POST(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
  }

  const sb = getAdminClient();
  const body = await request.json();

  // Block/unblock user
  if (body.action === 'toggle_block') {
    const { user_id, blocked, reason } = body;
    const { error } = await sb
      .from('profiles')
      .update({
        ai_blocked: blocked,
        ai_blocked_reason: reason || '',
      })
      .eq('id', user_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Update plan limits
  if (body.action === 'update_limits') {
    const { plan, monthly_calls, monthly_tokens } = body;
    const { error } = await sb
      .from('ai_plan_limits')
      .upsert({ plan, monthly_calls, monthly_tokens });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}
