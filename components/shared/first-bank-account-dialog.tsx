'use client';

import { Landmark } from 'lucide-react';
import type { BankAccountRow } from '@/lib/banks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BankAccountForm } from '@/components/shared/bank-account-form';

interface FirstBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the first RIB has been saved. Receives the new row. */
  onSaved: (account: BankAccountRow) => void;
  /** Context shown in the description. 'devis' ou 'facture'. */
  context: 'devis' | 'facture';
  /**
   * Si true, affiche un bouton "Plus tard" qui ferme la modale sans
   * forcer la saisie. Utilisé en amont du flow (ouverture de l'écran de
   * création). Sur la soumission finale ("Créer le devis"), on laisse
   * le mode bloquant (allowSkip=false par défaut).
   */
  allowSkip?: boolean;
  /** Appelé quand l'utilisateur clique sur "Plus tard". */
  onSkip?: () => void;
}

/**
 * Modale affichée quand l'utilisateur n'a pas encore de RIB configuré.
 * Deux modes :
 *   - allowSkip=false (défaut) : mode bloquant, affiché au moment de la
 *     création effective du document ("Créer le devis").
 *   - allowSkip=true : mode incitatif, affiché en amont (ouverture de
 *     l'écran nouveau devis). L'utilisateur peut cliquer "Plus tard".
 */
export function FirstBankAccountDialog({
  open,
  onOpenChange,
  onSaved,
  context,
  allowSkip = false,
  onSkip,
}: FirstBankAccountDialogProps) {
  const docLabel = context === 'devis' ? 'devis' : 'facture';
  // « devis » est invariable au pluriel, « facture » prend un s.
  const docLabelPlural = context === 'devis' ? 'devis' : 'factures';

  function handleSkip() {
    onSkip?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#d35400]/10 text-[#d35400]">
            <Landmark className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Ajoute ton RIB pour commencer</DialogTitle>
          <DialogDescription className="text-center">
            Avant de créer ton premier {docLabel}, renseigne tes coordonnées bancaires.
            Elles s&apos;afficheront automatiquement sur tes {docLabelPlural} pour que tes
            clients puissent te payer par virement.
          </DialogDescription>
        </DialogHeader>
        <BankAccountForm
          variant="dialog"
          forceDefault
          onSaved={onSaved}
        />
        {allowSkip && (
          <div className="flex justify-center pt-2">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              Plus tard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
