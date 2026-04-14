// Paywall Hellobat — 2 plans : free / pro.
// Prix affichés TTC par défaut. Toggle HT via `tva-utils.ts`.

export type PricingPlanKey = 'free' | 'pro';

// Backward-compat : anciennes valeurs DB/config toujours possibles pendant la transition.
export type LegacyPlanKey = 'starter' | 'business';

/** Convertit une clé legacy vers la nouvelle clé. starter→free, business→pro. */
export function normalizePlan(raw: string | null | undefined): PricingPlanKey {
  if (!raw) return 'free';
  if (raw === 'pro' || raw === 'business') return 'pro';
  return 'free';
}

export interface PricingPlanDefinition {
  key: PricingPlanKey;
  name: string;
  /** Prix TTC mensuel en euros (string pour l'affichage "19,50"). */
  defaultPriceTtc: string;
  /** Prix TTC annuel en euros (null pour le plan Free). */
  defaultPriceYearlyTtc: string | null;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

export const PRICING_PLAN_DEFAULTS: PricingPlanDefinition[] = [
  {
    key: 'free',
    name: 'Gratuit',
    defaultPriceTtc: '0',
    defaultPriceYearlyTtc: null,
    description: 'Pour démarrer en douceur, sans engagement ni carte bancaire.',
    features: [
      '5 devis / mois',
      '5 factures / mois',
      '3 devis IA (voix) offerts / mois',
      'Signature électronique incluse',
      'Paiement en ligne des devis et factures par vos clients',
      'HelloPay — encaissement sur chantier (QR + carte)',
      'Chantiers illimités',
      'Contacts, calendrier et tâches',
      'Drive documents : tous vos papiers au même endroit',
      'Connexion à votre Gmail : gérez vos emails sans quitter la plateforme',
      'Envoi facile de demandes d\u2019avis Google My Business',
      'Support par email',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    defaultPriceTtc: '19,50',
    defaultPriceYearlyTtc: '195',
    description: 'Toutes les fonctionnalités pour piloter et développer votre activité.',
    features: [
      'Devis et factures illimités',
      'Devis dictés à la voix, rédigés par l\u2019IA',
      'Site web professionnel gratuit',
      'Comptabilité automatisée : scan des factures fournisseurs',
      'Assistants IA experts du bâtiment (DTU, chiffrage, juridique, RGE/CEE)',
      'Photos avant/après générées par l\u2019IA',
      'Réponses aux emails clients assistées par IA',
      'Gestion d\u2019équipe et planning des chantiers',
      'Carte interactive de tous vos chantiers',
      'Catalogues produits à partager avec vos clients',
      'Prospection et pipeline commercial',
      'Contrats d\u2019entretien récurrents',
      'Signature électronique incluse',
      'Paiement en ligne des devis et factures par vos clients',
      'HelloPay — encaissement sur chantier (QR + carte)',
      'Drive documents : tous vos papiers au même endroit',
      'Contacts, calendrier et tâches',
      'Connexion à votre Gmail',
      'Demandes d\u2019avis Google My Business',
      'Support prioritaire',
    ],
    cta: 'Essai gratuit 30 jours',
    popular: true,
  },
];

export const DEFAULT_PLAN_FEATURES: Record<PricingPlanKey, string[]> = PRICING_PLAN_DEFAULTS.reduce(
  (acc, plan) => {
    acc[plan.key] = plan.features;
    return acc;
  },
  { free: [], pro: [] } as Record<PricingPlanKey, string[]>,
);

// ─── Packs de crédits IA ─────────────────────────────────────────────────────

export interface CreditPackDefinition {
  key: '50' | '200' | '1000';
  credits: number;
  priceTtc: number;
  label: string;
  unit: string; // "0,10 €/crédit"
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPackDefinition[] = [
  { key: '50', credits: 50, priceTtc: 5, label: 'Dépannage', unit: '0,10 €/crédit' },
  {
    key: '200',
    credits: 200,
    priceTtc: 15,
    label: 'Populaire',
    unit: '0,075 €/crédit',
    popular: true,
  },
  { key: '1000', credits: 1000, priceTtc: 50, label: 'Power', unit: '0,05 €/crédit' },
];

// ─── Helpers features plan (texte multi-ligne ou JSON) ───────────────────────

export function parsePlanFeatures(
  rawValue: string | null | undefined,
  fallback: string[],
): string[] {
  if (!rawValue) return fallback;

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      const features = parsed
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);
      if (features.length > 0) return features;
    }
  } catch {
    // fallback to newline format
  }

  const newlineFeatures = rawValue
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  return newlineFeatures.length > 0 ? newlineFeatures : fallback;
}

export function stringifyPlanFeatures(features: string[]): string {
  return JSON.stringify(features.map((f) => f.trim()).filter(Boolean));
}
