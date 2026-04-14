'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { useAccessState } from '@/hooks/use-access-state';

export function TrialBanner() {
  const { state } = useAccessState();

  if (!state) return null;
  if (state.status !== 'trialing') return null;
  if (state.daysLeftInTrial === null) return null;
  // N'afficher que les 10 derniers jours pour ne pas polluer
  if (state.daysLeftInTrial > 10) return null;

  const urgent = state.daysLeftInTrial <= 3;
  const days = state.daysLeftInTrial;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2 text-sm ${
        urgent
          ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
      }`}
    >
      <Clock className="h-4 w-4 shrink-0" />
      <span className="flex-1 font-medium">
        {days === 0
          ? 'Dernier jour d\u2019essai gratuit — passez en Pro pour conserver vos fonctionnalités.'
          : days === 1
            ? 'Plus qu\u2019un jour d\u2019essai gratuit.'
            : `${days} jours d\u2019essai gratuit restants.`}
      </span>
      <Button asChild size="sm" variant={urgent ? 'default' : 'outline'}>
        <Link href="/parametres?tab=abonnement">Passer en Pro</Link>
      </Button>
    </div>
  );
}
