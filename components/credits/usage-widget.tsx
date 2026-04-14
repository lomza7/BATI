'use client';

import { useState } from 'react';
import { Zap, ShoppingCart } from 'lucide-react';
import { useAccessState, type AiFeature } from '@/hooks/use-access-state';
import { Button } from '@/components/ui/button';
import { BuyCreditsModal } from './buy-credits-modal';

const FEATURE_LABELS: Record<AiFeature, string> = {
  quote_ai: 'Devis IA',
  agent: 'Agents IA',
  email_ai: 'Réponse email IA',
  accounting_ai: 'Comptabilité IA',
  before_after: 'Avant/Après IA',
  site_web: 'Site web IA',
};

export function UsageWidget() {
  const { state } = useAccessState();
  const [buyOpen, setBuyOpen] = useState(false);

  if (!state) return null;
  if (!state.hasProAccess) return null;

  const features = Object.keys(FEATURE_LABELS) as AiFeature[];

  return (
    <>
      <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Solde de crédits IA</div>
            <div className="mt-1 flex items-baseline gap-2">
              <Zap className="h-6 w-6 text-[#D35400]" />
              <span className="text-3xl font-bold">{state.creditsBalance}</span>
              <span className="text-sm text-muted-foreground">crédits</span>
            </div>
          </div>
          <Button
            onClick={() => setBuyOpen(true)}
            className="gap-2 bg-[#D35400] text-white hover:bg-[#B84400]"
          >
            <ShoppingCart className="h-4 w-4" />
            Acheter
          </Button>
        </div>

        <div className="border-t pt-4">
          <div className="mb-3 text-sm font-medium">Usage IA ce mois-ci</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {features.map((feature) => {
              const used = state.usage[feature] ?? 0;
              const quota = state.quotas[feature] ?? 0;
              const cost = state.creditCosts[feature] ?? 0;
              const overQuota = used > quota;
              const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
              return (
                <div key={feature} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{FEATURE_LABELS[feature]}</span>
                    <span className="text-xs text-muted-foreground">{cost} crédits/action</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <span className={overQuota ? 'font-semibold text-amber-700' : ''}>
                      {used}/{quota}
                    </span>{' '}
                    ce mois
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${overQuota ? 'bg-amber-500' : 'bg-[#D35400]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Les quotas mensuels se réinitialisent le 1<sup>er</sup> du mois. Au-delà, chaque action
            IA consomme des crédits de votre solde.
          </p>
        </div>
      </div>
      <BuyCreditsModal open={buyOpen} onOpenChange={setBuyOpen} />
    </>
  );
}
