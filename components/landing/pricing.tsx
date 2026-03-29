'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';

const plans = [
  {
    name: 'Starter',
    price: '0',
    period: '/mois',
    description: 'Pour demarrer et tester BatiFlow sans engagement.',
    features: [
      '5 devis / mois',
      '2 chantiers actifs',
      'Planning de base',
      'Application mobile',
      'Support par email',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    name: 'Pro',
    price: '49',
    period: '/mois',
    description: 'Pour les artisans qui veulent developper leur activite.',
    features: [
      'Devis et factures illimites',
      'Chantiers illimites',
      'Planning avance',
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
    name: 'Business',
    price: '89',
    period: '/mois',
    description: 'Pour les entreprises qui veulent tout automatiser.',
    features: [
      'Tout le plan Pro',
      'Agents IA illimites',
      'Paiements Stripe',
      'Contrats de maintenance',
      'Plans & Rendus',
      'Comptabilite avancee',
      'API & Webhooks',
      'Support dedie',
    ],
    cta: 'Essai gratuit 30 jours',
    popular: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-12 sm:py-24 bg-[var(--landing-off)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Des tarifs <em className="italic text-[var(--landing-accent)]">transparents</em>
          </h2>
          <p className="text-[var(--landing-muted)] text-lg max-w-xl mx-auto">
            Choisissez le plan qui correspond a votre activite. Changez a tout moment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative p-6 sm:p-8 rounded-2xl border ${
                plan.popular
                  ? 'border-[var(--landing-accent)] bg-white shadow-xl shadow-[var(--landing-accent)]/10 md:scale-[1.02]'
                  : 'border-[var(--landing-border)] bg-white'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--landing-accent)] text-white text-xs font-medium">
                  Le plus populaire
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[var(--landing-text)] mb-1">{plan.name}</h3>
                <p className="text-sm text-[var(--landing-muted)] mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-[var(--landing-text)]">{plan.price} EUR</span>
                  <span className="text-sm text-[var(--landing-muted)]">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm text-[var(--landing-text)]">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/dashboard"
                className={`block text-center py-3 rounded-full font-medium text-sm transition-colors ${
                  plan.popular
                    ? 'bg-[var(--landing-accent)] text-white hover:bg-[#b94800]'
                    : 'bg-[var(--landing-stone)] text-[var(--landing-text)] hover:bg-[var(--landing-border)]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
