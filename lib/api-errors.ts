/*
 * Helpers de réponses d'erreur API.
 *
 * Objectif : éviter de renvoyer au client des messages bruts venant de Supabase,
 * Stripe, OpenAI / Anthropic, ou d'erreurs Postgres internes — ces messages
 * peuvent leak des chemins storage, des noms de colonnes / tables internes,
 * des contraintes RLS, voire des fragments de SQL.
 *
 * Pattern :
 *   - Côté serveur : on log l'erreur complète avec contexte (route, user_id…)
 *     via console.error pour qu'elle soit visible dans les logs Vercel.
 *   - Côté client : on renvoie un message générique en français + un code
 *     stable que le frontend peut utiliser pour afficher un libellé spécifique
 *     si besoin.
 */

import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'INTERNAL'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'BAD_REQUEST'
  | 'UPLOAD_FAILED'
  | 'AI_FAILED'
  | 'AI_PARSE'
  | 'EXTERNAL_API'
  | 'DB_WRITE'
  | 'DB_READ'
  | 'RATE_LIMITED';

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  INTERNAL: 'Une erreur est survenue, réessayez dans un instant.',
  NOT_FOUND: 'Ressource introuvable.',
  UNAUTHORIZED: 'Non authentifié.',
  FORBIDDEN: 'Accès refusé.',
  BAD_REQUEST: 'Requête invalide.',
  UPLOAD_FAILED: 'Échec du téléversement du fichier.',
  AI_FAILED: 'Erreur côté IA, réessayez dans un instant.',
  AI_PARSE: 'Réponse IA inexploitable, réessayez.',
  EXTERNAL_API: 'Service externe indisponible, réessayez.',
  DB_WRITE: 'Impossible d\'enregistrer les modifications.',
  DB_READ: 'Impossible de charger les données.',
  RATE_LIMITED: 'Trop de requêtes, veuillez patienter.',
};

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  INTERNAL: 500,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  UPLOAD_FAILED: 500,
  AI_FAILED: 502,
  AI_PARSE: 422,
  EXTERNAL_API: 502,
  DB_WRITE: 500,
  DB_READ: 500,
  RATE_LIMITED: 429,
};

interface ApiErrorOptions {
  /** Override the user-facing message. Use only when the generic one is too vague. */
  message?: string;
  /** HTTP status code. Defaults to a sensible per-code value. */
  status?: number;
  /** Additional structured context to log server-side (route, user_id, etc). */
  context?: Record<string, unknown>;
  /** The original error / cause to log server-side (never sent to client). */
  cause?: unknown;
}

/**
 * Build a sanitized JSON error response and log the underlying cause server-side.
 *
 * Example :
 *   if (uploadErr) {
 *     return apiError('UPLOAD_FAILED', {
 *       cause: uploadErr,
 *       context: { route: 'rendus/generate', user_id: lead.user_id },
 *     });
 *   }
 */
export function apiError(code: ErrorCode, options: ApiErrorOptions = {}): NextResponse {
  const status = options.status ?? DEFAULT_STATUS[code];
  const message = options.message ?? DEFAULT_MESSAGES[code];

  // Log côté serveur uniquement — visible dans les logs Vercel.
  if (options.cause || options.context) {
    const causeStr =
      options.cause instanceof Error
        ? `${options.cause.name}: ${options.cause.message}`
        : options.cause
        ? String(options.cause)
        : '';
    console.error(
      `[api-error] ${code}`,
      JSON.stringify({
        ...options.context,
        cause: causeStr,
      }),
    );
  }

  return NextResponse.json({ error: message, code }, { status });
}
