'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { useAccessState } from '@/hooks/use-access-state';

export function CreditsBadge() {
  const { state } = useAccessState();

  if (!state || !state.hasProAccess) return null;

  const low = state.creditsBalance < 10;

  return (
    <Link
      href="/parametres?tab=abonnement"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent ${
        low
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
          : 'border-border bg-card text-foreground'
      }`}
      title="Voir ma consommation de crédits"
    >
      <Zap className={`h-3.5 w-3.5 ${low ? 'text-amber-600' : 'text-[#D35400]'}`} />
      <span>{state.creditsBalance}</span>
    </Link>
  );
}
