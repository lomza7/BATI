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
import { BankAccountForm } from '@/components/shared/bank-account-form';

interface FirstBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the first RIB has been saved. Receives the new row. */
  onSaved: (account: BankAccountRow) => void;
  /** Context shown in the description. 'devis' ou 'facture'. */
  context: 'devis' | 'facture';
}

/**
 * Modale bloquante affichee au moment ou l'utilisateur tente de creer son
 * premier devis ou sa premiere facture et n'a encore aucun RIB configure.
 * On lui demande d'ajouter son compte bancaire pour que ses documents soient
 * payables par virement.
 */
export function FirstBankAccountDialog({
  open,
  onOpenChange,
  onSaved,
  context,
}: FirstBankAccountDialogProps) {
  const docLabel = context === 'devis' ? 'devis' : 'facture';
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
            Elles s&apos;afficheront automatiquement sur tes {docLabel}s pour que tes
            clients puissent te payer par virement.
          </DialogDescription>
        </DialogHeader>
        <BankAccountForm
          variant="dialog"
          forceDefault
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
