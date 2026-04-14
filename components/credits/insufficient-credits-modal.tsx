'use client';

import { useState } from 'react';
import { AlertCircle, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BuyCreditsModal } from './buy-credits-modal';

interface InsufficientCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance?: number;
  required?: number;
}

export function InsufficientCreditsModal({
  open,
  onOpenChange,
  balance = 0,
  required = 0,
}: InsufficientCreditsModalProps) {
  const [buyOpen, setBuyOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Crédits IA insuffisants
            </DialogTitle>
            <DialogDescription>
              Vous avez épuisé vos crédits IA pour cette période. Achetez des crédits permanents
              pour continuer dès maintenant, ou attendez la prochaine recharge mensuelle.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 rounded-lg border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Solde actuel</span>
              <span className="font-semibold">
                <Zap className="mr-1 inline h-4 w-4 text-[#D35400]" />
                {balance} crédits
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">Nécessaire pour cette action</span>
              <span className="font-semibold text-amber-700">{required} crédits</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Plus tard
            </Button>
            <Button
              className="bg-[#D35400] text-white hover:bg-[#B84400]"
              onClick={() => {
                onOpenChange(false);
                setBuyOpen(true);
              }}
            >
              Acheter des crédits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BuyCreditsModal open={buyOpen} onOpenChange={setBuyOpen} />
    </>
  );
}
