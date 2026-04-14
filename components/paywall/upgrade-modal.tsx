'use client';

import Link from 'next/link';
import { Sparkles, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  feature?: string;
}

const PRO_HIGHLIGHTS = [
  'Devis et factures illimités',
  'Équipe, planning, catalogues, CRM',
  'Agents IA, devis IA, sites web IA',
  'Crédits IA à la carte au-delà des quotas',
];

export function UpgradeModal({
  open,
  onOpenChange,
  title = 'Passez au plan Pro',
  description,
  feature,
}: UpgradeModalProps) {
  const desc =
    description ??
    (feature
      ? `"${feature}" est réservé aux abonnés Pro. Débloquez toutes les fonctionnalités avancées de Hellobat.`
      : 'Débloquez toutes les fonctionnalités avancées de Hellobat.');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#D35400]" />
            {title}
          </DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>

        <div className="my-2 rounded-lg border bg-muted/40 p-4">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold">19,50 €</span>
            <span className="text-sm text-muted-foreground">TTC / mois</span>
          </div>
          <ul className="space-y-1.5">
            {PRO_HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D35400]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Plus tard
          </Button>
          <Button
            asChild
            className="bg-[#D35400] text-white hover:bg-[#B84400]"
            onClick={() => onOpenChange(false)}
          >
            <Link href="/parametres?tab=abonnement">Passer en Pro</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
