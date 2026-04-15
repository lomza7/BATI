'use client';

import { useState } from 'react';
import { Zap, ShoppingCart, Calendar } from 'lucide-react';
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

function formatRefillDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function UsageWidget() {
  const { state } = useAccessState();
  const [buyOpen, setBuyOpen] = useState(false);

  if (!state) return null;
  if (!state.hasProAccess) return null;

  const features = Object.keys(FEATURE_LABELS) as AiFeature[];
  const allocation = state.monthlyCreditsAllocation || 0;
  const monthlyUsed = Math.max(allocation - state.monthlyCreditsRemaining, 0);
  const monthlyPct = allocation > 0 ? Math.round((monthlyUsed / allocation) * 100) : 0;
  const refillLabel = formatRefillDate(state.creditsNextRefillAt);

  return (
    <>
      <div className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
        {/* ─── Solde global ──────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Solde de crédits IA</div>
            <div className="mt-1 flex items-baseline gap-2">
              <Zap className="h-6 w-6 text-[#D35400]" />
              <span className="text-3xl font-bold">{state.creditsBalance}</span>
              <span className="text-sm text-muted-foreground">crédits disponibles</span>
            </div>
          </div>
          <Button
            onClick={() => setBuyOpen(true)}
            className="w-full gap-2 bg-[#D35400] text-white hover:bg-[#B84400] sm:w-auto"
          >
            <ShoppingCart className="h-4 w-4" />
            Acheter des crédits
          </Button>
        </div>

        {/* ─── Détail mensuel + permanents ───────────────────────────── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Crédits mensuels</span>
              <span className="text-xs text-muted-foreground">Plan Pro</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">
              {state.monthlyCreditsRemaining}
              <span className="text-sm font-normal text-muted-foreground"> / {allocation}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#D35400]"
                style={{ width: `${Math.min(100, monthlyPct)}%` }}
              />
            </div>
            {refillLabel && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Rechargement le {refillLabel}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Crédits achetés</span>
              <span className="text-xs text-muted-foreground">Permanents</span>
            </div>
            <div className="mt-1 text-2xl font-semibold">{state.purchasedCreditsBalance}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Aucune péremption. Utilisés uniquement après épuisement du quota mensuel.
            </p>
          </div>
        </div>

        {/* ─── Consommation par feature ──────────────────────────────── */}
        <div className="border-t pt-4">
          <div className="mb-3 text-sm font-medium">Consommation ce mois-ci</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {features.map((feature) => {
              const used = state.usage[feature] ?? 0;
              const cost = state.creditCosts[feature] ?? 0;
              return (
                <div key={feature} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{FEATURE_LABELS[feature]}</span>
                    <span className="text-xs text-muted-foreground">{cost} crédits/action</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {used} utilisation{used > 1 ? 's' : ''} ce mois
                    {used > 0 && (
                      <> — {used * cost} crédit{used * cost > 1 ? 's' : ''} consommé{used * cost > 1 ? 's' : ''}</>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <BuyCreditsModal open={buyOpen} onOpenChange={setBuyOpen} />
    </>
  );
}
