'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useAccessState } from '@/hooks/use-access-state';

/**
 * Pastille affichée sous le logo Hellobat pendant le trial Pro.
 * - Cachée hors trialing (active payant ou free).
 * - Cachée en mode sidebar collapsed (pas d'espace).
 * - Texte dynamique : "Essai Pro — J-X" ou "dernier jour".
 */
export function TrialPill() {
  const { state } = useAccessState();
  if (!state) return null;
  if (state.status !== 'trialing') return null;

  const days = state.daysLeftInTrial ?? null;
  if (days === null) return null;

  const label =
    days === 0
      ? 'Essai Pro — dernier jour'
      : days === 1
        ? 'Essai Pro — encore 1 jour'
        : `Essai Pro — J-${days}`;

  return (
    <Link
      href="/parametres?tab=abonnement"
      className="mx-5 mt-0 mb-3 inline-flex items-center gap-1.5 self-start rounded-full border border-[#D35400]/25 bg-[#D35400]/10 px-2.5 py-1 text-[11px] font-medium text-[#D35400] hover:bg-[#D35400]/15 transition-colors"
      title="Gérer mon essai"
    >
      <Sparkles className="h-3 w-3" />
      <span>{label}</span>
    </Link>
  );
}
