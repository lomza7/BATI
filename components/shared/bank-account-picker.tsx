'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Landmark, Plus, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { maskIban, type BankAccountRow } from '@/lib/banks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BankAccountForm } from '@/components/shared/bank-account-form';
import { cn } from '@/lib/utils';

interface BankAccountPickerProps {
  /** Currently selected bank_account_id, or null for "no bank attached". */
  value: string | null;
  /** Called with the new id whenever the selection changes. */
  onChange: (id: string | null) => void;
  /** Optional class for the trigger container. */
  className?: string;
  /** Label shown above the trigger. Omit to hide. */
  label?: string;
  /** Disable the whole picker. */
  disabled?: boolean;
}

/**
 * Dropdown + "add new" flow for picking which RIB to attach to a quote or
 * invoice. On mount we fetch the user's non-deleted bank accounts, auto-select
 * the default one if nothing is picked yet, and re-fetch whenever a new
 * account is added via the inline dialog.
 */
export function BankAccountPicker({
  value,
  onChange,
  className,
  label = 'Coordonnees bancaires',
  disabled = false,
}: BankAccountPickerProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const selected = accounts.find((a) => a.id === value) || null;

  useEffect(() => {
    if (!user) return;
    loadAccounts();
  }, [user]);

  async function loadAccounts() {
    setLoading(true);
    const { data } = await supabase
      .from('bank_accounts')
      .select('id, label, bank_name, bank_slug, account_holder, iban, bic, is_default, created_at')
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    const list = (data as BankAccountRow[]) || [];
    setAccounts(list);
    setLoading(false);

    // Auto-select the default if nothing is picked yet.
    if (!value && list.length > 0) {
      const def = list.find((a) => a.is_default) || list[0];
      if (def) onChange(def.id);
    }
  }

  function handleSaved(account: BankAccountRow) {
    setShowAddDialog(false);
    onChange(account.id);
    loadAccounts();
  }

  return (
    <div className={cn('space-y-1', className)}>
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setOpen((v) => !v)}
          disabled={disabled || loading}
          className={cn(
            'flex h-auto w-full items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d35400]/10 text-[#d35400]">
              <Landmark className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              {selected ? (
                <>
                  <span className="flex items-center gap-1.5 truncate font-medium">
                    {selected.label}
                    {selected.is_default && (
                      <Star className="h-3 w-3 fill-[#d35400] text-[#d35400]" />
                    )}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {selected.bank_name} — {maskIban(selected.iban)}
                  </span>
                </>
              ) : accounts.length === 0 && !loading ? (
                <>
                  <span className="block font-medium text-foreground">Aucun RIB enregistre</span>
                  <span className="block text-[11px] text-muted-foreground">Ajoutes-en un pour l'afficher sur le document.</span>
                </>
              ) : (
                <span className="text-muted-foreground">Selectionne un compte…</span>
              )}
            </span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && !disabled && (
          <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
            <div className="max-h-[260px] overflow-y-auto py-1">
              {accounts.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Tu n'as encore aucun RIB. Ajoute ton premier compte pour l'afficher sur tes documents.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { onChange(null); setOpen(false); }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                      !value && 'bg-accent',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Landmark className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-muted-foreground">Ne pas joindre de RIB</span>
                    </span>
                    {!value && <Check className="h-4 w-4 text-[#d35400]" />}
                  </button>

                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => { onChange(a.id); setOpen(false); }}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                        value === a.id && 'bg-accent',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d35400]/10 text-[#d35400]">
                          <Landmark className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate font-medium">
                            {a.label}
                            {a.is_default && <Star className="h-3 w-3 fill-[#d35400] text-[#d35400]" />}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {a.bank_name} — {maskIban(a.iban)}
                          </span>
                        </span>
                      </span>
                      {value === a.id && <Check className="h-4 w-4 shrink-0 text-[#d35400]" />}
                    </button>
                  ))}
                </>
              )}
            </div>

            <div className="border-t border-border p-2">
              <button
                type="button"
                onClick={() => { setOpen(false); setShowAddDialog(true); }}
                className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[#d35400] hover:bg-[#d35400]/5"
              >
                <Plus className="h-4 w-4" /> Ajouter un nouveau RIB
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un RIB</DialogTitle>
            <DialogDescription>
              Ce compte s'affichera sur tes devis et factures pour permettre a tes clients de payer par virement.
            </DialogDescription>
          </DialogHeader>
          <BankAccountForm
            variant="dialog"
            forceDefault={accounts.length === 0}
            onSaved={handleSaved}
            onCancel={() => setShowAddDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
