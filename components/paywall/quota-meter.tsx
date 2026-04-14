'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useAccessState } from '@/hooks/use-access-state';

interface QuotaMeterProps {
  feature: 'quote' | 'invoice';
  limit?: number;
}

export function QuotaMeter({ feature, limit }: QuotaMeterProps) {
  const { state } = useAccessState();
  if (!state) return null;
  if (state.hasProAccess) return null;

  const used = state.docUsage?.[feature] ?? 0;
  const cap = limit ?? state.docLimit ?? 5;
  const remaining = Math.max(0, cap - used);
  const atLimit = remaining === 0;
  const label = feature === 'quote' ? 'devis' : 'factures';

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        atLimit
          ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {atLimit ? (
          <>
            Limite atteinte : <strong>{used}/{cap} {label}</strong> ce mois-ci.
            Passez en Pro pour continuer à en créer.
          </>
        ) : (
          <>
            Plan Gratuit : <strong>{used}/{cap} {label}</strong> ce mois-ci.
          </>
        )}
      </span>
      <Link
        href="/parametres?tab=abonnement"
        className="font-semibold text-[#D35400] hover:underline"
      >
        Passer en Pro
      </Link>
    </div>
  );
}
