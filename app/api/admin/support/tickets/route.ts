import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAdminRequest } from '@/lib/admin';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const typeFilter = url.searchParams.get('type');

  let query = supabaseAdmin
    .from('support_tickets')
    .select('id, user_id, type, message, user_email, user_full_name, user_phone, company_name, page_url, user_agent, status, admin_notes, handled_at, created_at, updated_at, attachments')
    .order('created_at', { ascending: false })
    .limit(200);

  if (statusFilter && ['new', 'in_progress', 'resolved', 'closed'].includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }
  if (typeFilter && ['bug', 'question', 'amelioration'].includes(typeFilter)) {
    query = query.eq('type', typeFilter);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Génère des signed URLs (1h) pour chaque attachment. L'admin ouvre
  // généralement les tickets au fur et à mesure, 1h suffit ; il suffit
  // de rafraîchir la page pour obtenir de nouveaux liens.
  const rows = (data || []) as Array<{
    attachments?: Array<{ path: string; name: string; mime: string; size: number }>;
    [k: string]: unknown;
  }>;

  const allPaths = rows.flatMap((t) => (t.attachments || []).map((a) => a.path));
  const signedMap = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from('support-attachments')
      .createSignedUrls(allPaths, 60 * 60);
    (signed || []).forEach((s, i) => {
      if (s?.signedUrl) signedMap.set(allPaths[i], s.signedUrl);
    });
  }

  const tickets = rows.map((t) => ({
    ...t,
    attachments: (t.attachments || []).map((a) => ({
      ...a,
      url: signedMap.get(a.path) || null,
    })),
  }));

  return NextResponse.json({ tickets });
}

export async function PATCH(request: Request) {
  const admin = await verifyAdminRequest(request);
  if (!admin) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  let body: {
    id?: string;
    status?: 'new' | 'in_progress' | 'resolved' | 'closed';
    admin_notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.status) {
    if (!['new', 'in_progress', 'resolved', 'closed'].includes(body.status)) {
      return NextResponse.json({ error: 'status invalide' }, { status: 400 });
    }
    update.status = body.status;
    if (body.status !== 'new' && !update.handled_at) {
      update.handled_at = new Date().toISOString();
      update.handled_by = admin.id;
    }
  }
  if (typeof body.admin_notes === 'string') {
    update.admin_notes = body.admin_notes;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .update(update)
    .eq('id', body.id)
    .select('id, status, admin_notes, handled_at, updated_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ticket: data });
}
