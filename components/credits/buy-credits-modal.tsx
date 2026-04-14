'use client';

import { useState } from 'react';
import { Zap, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/hooks/use-toast';

type Pack = {
  key: '50' | '200' | '1000';
  credits: number;
  price: number;
  label: string;
  unit: string;
  popular?: boolean;
};

const PACKS: Pack[] = [
  { key: '50', credits: 50, price: 5, label: 'Dépannage', unit: '0,10 €/crédit' },
  {
    key: '200',
    credits: 200,
    price: 15,
    label: 'Populaire',
    unit: '0,075 €/crédit',
    popular: true,
  },
  { key: '1000', credits: 1000, price: 50, label: 'Power', unit: '0,05 €/crédit' },
];

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  async function buy(pack: Pack['key']) {
    if (!session?.access_token) return;
    setLoading(pack);
    try {
      const res = await fetch('/api/stripe/checkout-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ pack }),
      });
      const data = await res.json();
      if (!res.ok || !data?.url) {
        toast({
          title: 'Erreur',
          description: data?.error || 'Impossible de lancer le paiement.',
          variant: 'destructive',
        });
        return;
      }
      window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#D35400]" />
            Acheter des crédits IA
          </DialogTitle>
          <DialogDescription>
            Les crédits permettent de dépasser vos quotas IA mensuels. Ils ne périment jamais.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          {PACKS.map((pack) => (
            <div
              key={pack.key}
              className={`relative flex flex-col gap-2 rounded-lg border p-4 ${
                pack.popular ? 'border-[#D35400] bg-[#D35400]/5' : 'border-border'
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[#D35400] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                  Populaire
                </span>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{pack.credits}</span>
                <span className="text-sm text-muted-foreground">crédits</span>
              </div>
              <div className="text-sm font-medium">{pack.label}</div>
              <div className="text-lg font-semibold">{pack.price} € TTC</div>
              <div className="text-xs text-muted-foreground">{pack.unit}</div>
              <Button
                onClick={() => buy(pack.key)}
                disabled={loading !== null}
                className={
                  pack.popular ? 'bg-[#D35400] text-white hover:bg-[#B84400]' : undefined
                }
                variant={pack.popular ? 'default' : 'outline'}
              >
                {loading === pack.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Acheter'
                )}
              </Button>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Paiement sécurisé Stripe. Les crédits apparaîtront immédiatement après validation.
        </p>
      </DialogContent>
    </Dialog>
  );
}
