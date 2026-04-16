/*
 * Contrat d'accès public — validation centralisée.
 *
 * Toute route publique (non authentifiée) utilisant `supabaseAdmin` DOIT
 * commencer par l'un des validateurs ci-dessous. Le but : formaliser que
 * la vérification du token/slug/id a bien lieu AVANT toute lecture/écriture
 * DB. Audit automatisé via `scripts/audit-public-routes.ts`.
 *
 * Pourquoi `supabaseAdmin` sur routes publiques : le caller est anonyme,
 * donc pas de `auth.uid()` ni de RLS exploitable. L'alternative (anon role
 * avec policies dédiées par table) a été écartée car plus fragile (chaque
 * nouvelle table doit être reconfigurée) et fuiterait le schéma via la
 * anon key. Cf. audit §1.3.
 */

import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  validateToken as validateAccountantTokenRaw,
  type TokenValidation as AccountantTokenValidation,
  type AccountantAccessRow,
  type ResolvedScope,
} from '@/lib/comptabilite/accountant-scope';

// ─────────────────────────────────────────────────────────────────────────
// Type générique : { ok: true, data } | { ok: false, status, error }
// ─────────────────────────────────────────────────────────────────────────

export type PublicAccessResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

function fail(status: number, error: string): PublicAccessResult<never> {
  return { ok: false, status, error };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Portail comptable — token dans /api/comptabilite/portal/[token]/*
// ─────────────────────────────────────────────────────────────────────────

export interface AccountantPortalAccess {
  access: AccountantAccessRow;
  scope: ResolvedScope;
}

export async function validateAccountantPortalToken(
  token: string | null | undefined,
): Promise<PublicAccessResult<AccountantPortalAccess>> {
  if (!token) return fail(400, 'Token manquant');
  const r: AccountantTokenValidation = await validateAccountantTokenRaw(token);
  if (!r.ok || !r.access || !r.scope) {
    return fail(r.status, r.error || 'Lien invalide');
  }
  return { ok: true, data: { access: r.access, scope: r.scope } };
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Signature devis — token dans quote_sends (routes /d/[token] et /api/public/sign-quote)
// ─────────────────────────────────────────────────────────────────────────

export interface QuoteSendAccess {
  id: string;
  expires_at: string | null;
  signed_at: string | null;
}

export async function validateQuoteSignatureToken(
  token: string | null | undefined,
): Promise<PublicAccessResult<QuoteSendAccess>> {
  if (!token || typeof token !== 'string') return fail(400, 'Token manquant');
  const { data, error } = await supabaseAdmin
    .from('quote_sends')
    .select('id, expires_at, signed_at')
    .eq('token', token)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, 'Token invalide');
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return fail(410, 'Lien expiré');
  }
  return { ok: true, data: data as QuoteSendAccess };
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Session de paiement facture — UUID de la facture comme token
//    Voir §1.2 : UUIDv4 = ~122 bits d'entropie, pattern "share link".
// ─────────────────────────────────────────────────────────────────────────

export interface InvoicePaySessionAccess {
  id: string;
  title: string | null;
  total_ttc: number | string;
  status: string;
  payment_client_secret: string | null;
  payment_stripe_account_id: string | null;
  payment_publishable_key: string | null;
}

export async function validateInvoicePaySession(
  id: string | null | undefined,
): Promise<PublicAccessResult<InvoicePaySessionAccess>> {
  if (!id) return fail(400, 'id requis');
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select(
      'id, title, total_ttc, status, payment_client_secret, payment_stripe_account_id, payment_publishable_key',
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return fail(404, 'Lien invalide');
  return { ok: true, data: data as InvoicePaySessionAccess };
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Catalogue public — token dans catalog_sends (route /c/[token])
// ─────────────────────────────────────────────────────────────────────────

export interface CatalogSendAccess {
  id: string;
  catalog_id: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export async function validateCatalogToken(
  token: string | null | undefined,
): Promise<PublicAccessResult<CatalogSendAccess>> {
  if (!token) return fail(400, 'Token manquant');
  const { data, error } = await supabaseAdmin
    .from('catalog_sends')
    .select('id, catalog_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, 'Lien introuvable');
  if (data.revoked_at) return fail(410, 'Ce lien a été révoqué');
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return fail(410, 'Ce lien a expiré');
  }
  return { ok: true, data: data as CatalogSendAccess };
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Rendu public — token dans rendu_campaigns (routes /r/[token] et /api/rendus/public/[token]/*)
// ─────────────────────────────────────────────────────────────────────────

export interface RenduCampaignAccess {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export async function validateRenduToken(
  token: string | null | undefined,
): Promise<PublicAccessResult<RenduCampaignAccess>> {
  if (!token) return fail(400, 'Token manquant');
  const { data, error } = await supabaseAdmin
    .from('rendu_campaigns')
    .select('id, user_id, client_id, project_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, 'Lien introuvable');
  if (data.revoked_at) return fail(410, 'Ce lien a été révoqué');
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return fail(410, 'Ce lien a expiré');
  }
  return { ok: true, data: data as RenduCampaignAccess };
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Site artisan publié — slug dans artisan_sites (route /site/[slug])
// ─────────────────────────────────────────────────────────────────────────

export interface ArtisanSiteAccess {
  id: string;
  user_id: string;
  slug: string;
  is_published: boolean;
}

export async function validateArtisanSiteSlug(
  slug: string | null | undefined,
): Promise<PublicAccessResult<ArtisanSiteAccess>> {
  if (!slug) return fail(400, 'Slug manquant');
  const { data, error } = await supabaseAdmin
    .from('artisan_sites')
    .select('id, user_id, slug, is_published')
    .eq('slug', slug)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data || !data.is_published) return fail(404, 'Site introuvable');
  return { ok: true, data: data as ArtisanSiteAccess };
}
