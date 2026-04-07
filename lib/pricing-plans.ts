export type PricingPlanKey = 'starter' | 'pro' | 'business';

export interface PricingPlanDefinition {
  key: PricingPlanKey;
  name: string;
  defaultPrice: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

export const PRICING_PLAN_DEFAULTS: PricingPlanDefinition[] = [
  {
    key: 'starter',
    name: 'Starter',
    defaultPrice: '0',
    description: 'Decouvrez Hellobat gratuitement, sans engagement ni carte bancaire.',
    features: [
      'Devis et factures (5 / mois)',
      '2 chantiers actifs',
      'Carnet de contacts',
      'Planning semaine',
      'Carte interactive',
      'Calendrier personnel',
      'Taches et rappels',
      'Application mobile',
      'Support par email',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    defaultPrice: '15',
    description: 'Gerez et developpez votre activite sans limites.',
    features: [
      'Devis et factures illimites',
      'Chantiers illimites',
      'Assistant IA devis (voix + photo)',
      'Signature electronique DocuSeal',
      'Planning equipe drag & drop',
      'Gestion equipe et sous-traitants',
      'Comptes equipe avec permissions',
      'Catalogues produits partageables',
      'Prospection CRM pipeline',
      'Site web genere par IA',
      'Boite mail Gmail integree',
      'Avis Google Business',
      'Corbeille 30 jours',
      'Conforme facture electronique 2026',
      'Support prioritaire',
    ],
    cta: 'Essai gratuit 30 jours',
    popular: true,
  },
  {
    key: 'business',
    name: 'Business',
    defaultPrice: '29',
    description: 'Automatisez et pilotez votre entreprise avec l\'IA.',
    features: [
      'Tout le plan Pro, plus :',
      '5 agents IA specialises (pannes, DTU, chiffrage, juridique, RGE/CEE)',
      'Plans et rendus generes par IA',
      'Comptabilite IA automatisee',
      'Contrats de maintenance recurrents',
      'Paiement en ligne Stripe',
      'Carte publique partageable',
      'Tableau de bord avance (KPIs, pipeline)',
      'IA illimitee (appels et tokens)',
      'Support dedie',
    ],
    cta: 'Essai gratuit 30 jours',
    popular: false,
  },
];

export const DEFAULT_PLAN_FEATURES: Record<PricingPlanKey, string[]> = PRICING_PLAN_DEFAULTS.reduce(
  (acc, plan) => {
    acc[plan.key] = plan.features;
    return acc;
  },
  {
    starter: [],
    pro: [],
    business: [],
  } as Record<PricingPlanKey, string[]>
);

export function parsePlanFeatures(
  rawValue: string | null | undefined,
  fallback: string[]
): string[] {
  if (!rawValue) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) {
      const features = parsed
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean);

      if (features.length > 0) {
        return features;
      }
    }
  } catch {
    // Keep supporting manual newline-separated values if needed.
  }

  const newlineFeatures = rawValue
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  return newlineFeatures.length > 0 ? newlineFeatures : fallback;
}

export function stringifyPlanFeatures(features: string[]): string {
  return JSON.stringify(
    features
      .map((feature) => feature.trim())
      .filter(Boolean)
  );
}
