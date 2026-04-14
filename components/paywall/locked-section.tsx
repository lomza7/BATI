'use client';

import { Lock, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface LockedSectionProps {
  title?: string;
  description?: string;
  feature?: 'pro' | 'ai';
}

export function LockedSection({
  title = 'Fonctionnalité Pro',
  description = 'Cette section est réservée aux abonnés Pro. Passez en Pro pour débloquer toutes les fonctionnalités de Hellobat.',
  feature = 'pro',
}: LockedSectionProps) {
  const Icon = feature === 'ai' ? Sparkles : Lock;
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="rounded-full bg-[#D35400]/10 p-4">
          <Icon className="h-8 w-8 text-[#D35400]" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button asChild size="lg" className="mt-2 bg-[#D35400] text-white hover:bg-[#B84400]">
          <Link href="/parametres?tab=abonnement">Passer en Pro — 19,50 €/mois</Link>
        </Button>
        <p className="text-xs text-muted-foreground">Sans engagement, résiliable à tout moment.</p>
      </div>
    </div>
  );
}
