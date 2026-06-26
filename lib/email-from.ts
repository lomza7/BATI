// Résolution robuste de l'adresse d'expéditeur Resend.
//
// Contexte : le domaine `send.hellobat.app` n'est PAS vérifié dans Resend
// (POST /emails → 403). Seul `hellobat.app` est vérifié. Pour que les emails
// partent quoi qu'il arrive — même si RESEND_FROM_EMAIL pointe encore sur
// l'ancien domaine cassé — on force toujours le domaine vérifié au moment de
// l'envoi.

const VERIFIED_DOMAIN = 'hellobat.app';
const BROKEN_DOMAIN = /@send\.hellobat\.app/gi;

/**
 * Retourne l'expéditeur à utiliser, en priorisant RESEND_FROM_EMAIL puis le
 * fallback fourni, et en réécrivant systématiquement tout `@send.hellobat.app`
 * (non vérifié) vers `@hellobat.app` (vérifié).
 *
 * Accepte aussi bien une chaîne complète (`Hellobat <equipe@hellobat.app>`)
 * qu'une adresse nue (`equipe@hellobat.app`).
 */
export function resolveFromEmail(fallback: string): string {
  const env = process.env.RESEND_FROM_EMAIL;
  const chosen = env && env.trim() ? env.trim() : fallback;
  return chosen.replace(BROKEN_DOMAIN, `@${VERIFIED_DOMAIN}`);
}

/**
 * Variante pour les routes qui réinjectent l'expéditeur dans un libellé du type
 * `${entreprise} via Hellobat <ADRESSE>` : on a besoin de l'ADRESSE seule.
 * Extrait l'adresse d'un éventuel format `Nom <adresse>` et force le domaine vérifié.
 */
export function resolveFromAddress(fallbackAddress: string): string {
  const raw = resolveFromEmail(fallbackAddress);
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}
