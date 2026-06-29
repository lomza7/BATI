'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Sparkles, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUserPlan, type UserPlan } from '@/lib/auth-context';
import { useAuth } from '@/lib/auth-context';
import { PRICING_PLAN_DEFAULTS } from '@/lib/pricing-plans';

const PLAN_LABELS: Record<UserPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

interface UpgradeGateProps {
  requiredPlan: UserPlan;
  children: React.ReactNode;
  /** Render as a blurred overlay instead of replacing content */
  overlay?: boolean;
}

export function UpgradeGate({ requiredPlan, children, overlay = false }: UpgradeGateProps) {
  const { canAccess, plan } = useUserPlan();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (canAccess(requiredPlan)) {
    return <>{children}</>;
  }

  const requiredPlanDef = PRICING_PLAN_DEFAULTS.find((p) => p.key === requiredPlan);
  const currentPlanDef = PRICING_PLAN_DEFAULTS.find((p) => p.key === plan);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/prices');
      const prices = await res.json();
      const priceId = prices?.[requiredPlan];
      if (!priceId) {
        router.push('/parametres?tab=abonnement');
        return;
      }
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          user_email: user?.email,
          user_id: user?.id,
          success_url: `${window.location.origin}${window.location.pathname}?upgrade=success`,
          cancel_url: window.location.href,
        }),
      });
      const { url } = await checkoutRes.json();
      if (url) window.location.href = url;
    } catch {
      router.push('/parametres?tab=abonnement');
    } finally {
      setLoading(false);
    }
  }

  const gate = (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Lock className="h-6 w-6 text-primary" />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          Fonctionnalité réservée au plan{' '}
          <span className="text-primary">{PLAN_LABELS[requiredPlan]}</span>
        </p>
        {currentPlanDef && (
          <p className="text-xs text-muted-foreground">
            Vous êtes sur le plan{' '}
            <span className="font-medium">{PLAN_LABELS[plan]}</span>
          </p>
        )}
      </div>

      {requiredPlanDef && (
        <ul className="space-y-1 text-left text-xs text-muted-foreground">
          {requiredPlanDef.features.slice(0, 5).map((f) => (
            <li key={f} className="flex items-start gap-1.5">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              {f}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button size="sm" onClick={handleUpgrade} disabled={loading}>
          {loading ? 'Chargement…' : `Passer au plan ${PLAN_LABELS[requiredPlan]}`}
        </Button>
        <Button size="sm" variant="outline" onClick={() => router.push('/parametres?tab=abonnement')}>
          En savoir plus
        </Button>
      </div>
    </div>
  );

  if (!overlay) return gate;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        {gate}
      </div>
    </div>
  );
}

interface UpgradeBannerProps {
  message: string;
  requiredPlan?: UserPlan;
  onDismiss?: () => void;
}

export function UpgradeBanner({ message, requiredPlan, onDismiss }: UpgradeBannerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (dismissed) return null;

  async function handleUpgrade() {
    if (!requiredPlan) {
      router.push('/parametres?tab=abonnement');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/prices');
      const prices = await res.json();
      const priceId = prices?.[requiredPlan];
      if (!priceId) {
        router.push('/parametres?tab=abonnement');
        return;
      }
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price_id: priceId,
          user_email: user?.email,
          user_id: user?.id,
          success_url: `${window.location.origin}${window.location.pathname}?upgrade=success`,
          cancel_url: window.location.href,
        }),
      });
      const { url } = await checkoutRes.json();
      if (url) window.location.href = url;
    } catch {
      router.push('/parametres?tab=abonnement');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="flex-1 text-amber-800 dark:text-amber-200">{message}</p>
      <div className="flex items-center gap-2">
        {requiredPlan && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
            onClick={handleUpgrade}
            disabled={loading}
          >
            {loading ? 'Chargement…' : 'Mettre à niveau'}
          </Button>
        )}
        <button
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          className="text-amber-600 hover:text-amber-800 dark:text-amber-400"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
