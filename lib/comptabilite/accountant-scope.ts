import { supabaseAdmin } from '@/lib/supabase-admin';

export interface AccountantAccessRow {
  id: string;
  user_id: string;
  accountant_email: string;
  accountant_name: string | null;
  token: string;
  scope: 'full' | 'fiscal_year' | 'period';
  scope_year: number | null;
  scope_start: string | null;
  scope_end: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
}

export interface ResolvedScope {
  start: string | null;
  end: string | null;
  label: string;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz';

export function generateAccessToken(length = 36): string {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function resolveScope(access: AccountantAccessRow): ResolvedScope {
  if (access.scope === 'full') {
    return { start: null, end: null, label: 'Toutes les données comptables' };
  }
  if (access.scope === 'fiscal_year' && access.scope_year) {
    const year = access.scope_year;
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: `Année fiscale ${year}`,
    };
  }
  if (access.scope === 'period' && access.scope_start && access.scope_end) {
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    return {
      start: access.scope_start,
      end: access.scope_end,
      label: `Du ${fmt(access.scope_start)} au ${fmt(access.scope_end)}`,
    };
  }
  return { start: null, end: null, label: 'Données comptables' };
}

export interface TokenValidation {
  ok: boolean;
  status: number;
  error?: string;
  access?: AccountantAccessRow;
  scope?: ResolvedScope;
}

export async function validateToken(token: string): Promise<TokenValidation> {
  if (!token || token.length < 24) {
    return { ok: false, status: 404, error: 'Lien introuvable' };
  }
  const { data, error } = await supabaseAdmin
    .from('accountant_access')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: error.message };
  if (!data) return { ok: false, status: 404, error: 'Lien introuvable' };

  if (data.revoked_at) {
    return { ok: false, status: 410, error: 'Cet accès a été révoqué' };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 410, error: 'Cet accès a expiré' };
  }

  return { ok: true, status: 200, access: data as AccountantAccessRow, scope: resolveScope(data as AccountantAccessRow) };
}

export async function trackTokenView(accessId: string) {
  // Increment view counter and update last_viewed_at
  const { data: current } = await supabaseAdmin
    .from('accountant_access')
    .select('view_count')
    .eq('id', accessId)
    .maybeSingle();

  await supabaseAdmin
    .from('accountant_access')
    .update({
      last_viewed_at: new Date().toISOString(),
      view_count: (current?.view_count || 0) + 1,
    })
    .eq('id', accessId);
}
