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
    description: 'Pour demarrer et tester Hellobat sans engagement.',
    features: [
      '5 devis / mois',
      '2 chantiers actifs',
      'Carnet de contacts',
      'Planning de base',
      'Carte interactive',
      'Support par email',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    key: 'pro',
    name: 'Pro',
    defaultPrice: '49',
    description: 'Pour les artisans qui veulent developper leur activite.',
    features: [
      'Devis IA vocal illimites',
      'Chantiers illimites',
      'Planning drag & drop',
      'Gestion equipe & sous-traitants',
      'Catalogues produits',
      'Site web inclus',
      'Prospection CRM',
      'Emails integres',
      'Avis Google',
      'Support prioritaire',
    ],
    cta: 'Essai gratuit 30 jours',
    popular: true,
  },
  {
    key: 'business',
    name: 'Business',
    defaultPrice: '89',
    description: 'Pour les entreprises qui veulent tout automatiser.',
    features: [
      'Tout le plan Pro',
      'Agents IA illimites',
      'Paiements Stripe',
      'Contrats de maintenance',
      'Plans & Rendus IA',
      'Comptabilite avancee',
      'Carte publique partageable',
      'API & Webhooks',
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
