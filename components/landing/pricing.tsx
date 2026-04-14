'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_PLAN_FEATURES,
  PRICING_PLAN_DEFAULTS,
  parsePlanFeatures,
  type PricingPlanKey,
} from '@/lib/pricing-plans';
import { ttcToHt } from '@/lib/tva-utils';

type Billing = 'monthly' | 'yearly';
type TaxMode = 'ttc' | 'ht';

export function Pricing() {
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [featuresByPlan, setFeaturesByPlan] = useState<Record<PricingPlanKey, string[]>>(
    DEFAULT_PLAN_FEATURES,
  );
  const [billing, setBilling] = useState<Billing>('monthly');
  const [taxMode, setTaxMode] = useState<TaxMode>('ttc');

  useEffect(() => {
    async function loadPrices() {
      const { data } = await supabase.rpc('get_platform_config');
      if (data) {
        const cfg = data as Record<string, string>;
        setPrices({
          pro: cfg.price_pro || '19,50',
          pro_yearly: cfg.price_pro_yearly || '195',
        });
        setFeaturesByPlan({
          free: parsePlanFeatures(cfg.features_free, DEFAULT_PLAN_FEATURES.free),
          pro: parsePlanFeatures(cfg.features_pro, DEFAULT_PLAN_FEATURES.pro),
        });
      }
    }
    loadPrices();
  }, []);

  function formatPrice(ttc: string): string {
    return taxMode === 'ht' ? ttcToHt(ttc) : ttc;
  }

  return (
    <section id="pricing" className="py-12 sm:py-24 bg-[var(--landing-off)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
            Des tarifs <em className="italic text-[var(--landing-accent)]">transparents</em>
          </h2>
          <p className="text-[var(--landing-muted)] text-lg max-w-xl mx-auto">
            Essai gratuit 30 jours. Sans engagement, résiliable à tout moment.
          </p>
        </div>

        {/* Toggles mensuel/annuel + TTC/HT */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          <div className="inline-flex items-center rounded-full border border-[var(--landing-border)] bg-white p-1">
            <button
              type="button"
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                billing === 'monthly'
                  ? 'bg-[var(--landing-accent)] text-white'
                  : 'text-[var(--landing-muted)]'
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBilling('yearly')}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors flex items-center gap-1.5 ${
                billing === 'yearly'
                  ? 'bg-[var(--landing-accent)] text-white'
                  : 'text-[var(--landing-muted)]'
              }`}
            >
              Annuel
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  billing === 'yearly'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                -2 mois
              </span>
            </button>
          </div>

          <div className="inline-flex items-center rounded-full border border-[var(--landing-border)] bg-white p-1">
            <button
              type="button"
              onClick={() => setTaxMode('ttc')}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                taxMode === 'ttc'
                  ? 'bg-[var(--landing-text)] text-white'
                  : 'text-[var(--landing-muted)]'
              }`}
            >
              TTC
            </button>
            <button
              type="button"
              onClick={() => setTaxMode('ht')}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                taxMode === 'ht'
                  ? 'bg-[var(--landing-text)] text-white'
                  : 'text-[var(--landing-muted)]'
              }`}
            >
              HT
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PRICING_PLAN_DEFAULTS.map((plan) => {
            const isFree = plan.key === 'free';
            const ttcMonthly = prices.pro || plan.defaultPriceTtc;
            const ttcYearly = prices.pro_yearly || plan.defaultPriceYearlyTtc || '';
            const displayedTtc = billing === 'yearly' ? ttcYearly : ttcMonthly;
            const priceStr = isFree ? '0' : formatPrice(displayedTtc);
            const perLabel = billing === 'yearly' ? '/an' : '/mois';
            const features = featuresByPlan[plan.key] || plan.features;

            return (
              <div
                key={plan.key}
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
                  <h3 className="text-lg font-semibold text-[var(--landing-text)] mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-[var(--landing-muted)] mb-4">{plan.description}</p>
                  {isFree ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-[var(--landing-text)]">Gratuit</span>
                      <span className="text-sm text-[var(--landing-muted)]">à vie</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-[var(--landing-text)]">
                          {priceStr} €
                        </span>
                        <span className="text-sm text-[var(--landing-muted)]">
                          {taxMode.toUpperCase()} {perLabel}
                        </span>
                      </div>
                      {billing === 'yearly' && (
                        <p className="mt-1 text-xs text-emerald-700">
                          Équivalent ~{formatPrice('16,25')} € {taxMode.toUpperCase()} / mois
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-sm text-[var(--landing-text)]">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`block text-center py-3 rounded-full font-medium text-sm transition-colors ${
                    plan.popular
                      ? 'bg-[var(--landing-accent)] text-white hover:bg-[#b94800]'
                      : 'bg-[var(--landing-stone)] text-[var(--landing-text)] hover:bg-[var(--landing-border)]'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/tarifs"
            className="text-sm text-[var(--landing-accent)] hover:underline font-medium"
          >
            Voir le comparatif détaillé des fonctionnalités →
          </Link>
        </div>
      </div>
    </section>
  );
}
