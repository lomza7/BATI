'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Landmark, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  BANK_CATEGORY_LABELS,
  FRENCH_BANKS,
  formatIban,
  isValidBic,
  isValidIban,
  normalizeBic,
  normalizeIban,
  type BankAccountRow,
  type BankOption,
} from '@/lib/banks';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface BankAccountFormProps {
  /** When provided, the form edits this account instead of creating a new one. */
  initialAccount?: BankAccountRow | null;
  /** Called after a successful save. Receives the saved row. */
  onSaved: (account: BankAccountRow) => void;
  /** Called when the user cancels. Hides cancel button if omitted. */
  onCancel?: () => void;
  /** Auto-mark this new account as default (first-RIB modal uses this). */
  forceDefault?: boolean;
  /** Render inside a dialog or inline — changes padding/outer layout. */
  variant?: 'inline' | 'dialog';
}

interface FormState {
  label: string;
  bank_name: string;
  bank_slug: string | null;
  account_holder: string;
  iban: string;
  bic: string;
  is_default: boolean;
}

function emptyForm(): FormState {
  return {
    label: '',
    bank_name: '',
    bank_slug: null,
    account_holder: '',
    iban: '',
    bic: '',
    is_default: false,
  };
}

export function BankAccountForm({
  initialAccount = null,
  onSaved,
  onCancel,
  forceDefault = false,
  variant = 'inline',
}: BankAccountFormProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(() => {
    if (initialAccount) {
      return {
        label: initialAccount.label,
        bank_name: initialAccount.bank_name,
        bank_slug: initialAccount.bank_slug,
        account_holder: initialAccount.account_holder,
        iban: formatIban(initialAccount.iban),
        bic: initialAccount.bic,
        is_default: initialAccount.is_default,
      };
    }
    return { ...emptyForm(), is_default: forceDefault };
  });
  const [bankOpen, setBankOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill account holder from profile if we're creating a brand-new account.
  useEffect(() => {
    if (initialAccount || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('company_name, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const holder = data?.company_name || data?.full_name || '';
      if (holder) setForm((prev) => (prev.account_holder ? prev : { ...prev, account_holder: holder }));
    })();
    return () => { cancelled = true; };
  }, [user, initialAccount]);

  const ibanClean = normalizeIban(form.iban);
  const bicClean = normalizeBic(form.bic);
  const ibanValid = ibanClean.length === 0 || isValidIban(ibanClean);
  const bicValid = bicClean.length === 0 || isValidBic(bicClean);

  const canSubmit =
    form.label.trim().length > 0 &&
    form.bank_name.trim().length > 0 &&
    form.account_holder.trim().length > 0 &&
    ibanClean.length > 0 &&
    bicClean.length > 0 &&
    ibanValid &&
    bicValid &&
    !saving;

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase();
    if (!q) return FRENCH_BANKS;
    return FRENCH_BANKS.filter((b) => b.name.toLowerCase().includes(q));
  }, [bankSearch]);

  async function handleSubmit() {
    if (!canSubmit || !user) return;
    setSaving(true);
    setError(null);

    const payload = {
      label: form.label.trim(),
      bank_name: form.bank_name.trim(),
      bank_slug: form.bank_slug,
      account_holder: form.account_holder.trim(),
      iban: ibanClean,
      bic: bicClean,
      is_default: form.is_default,
    };

    try {
      // If this one should become the default, clear any existing default
      // first to sidestep the unique partial index.
      if (payload.is_default) {
        await supabase
          .from('bank_accounts')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('is_default', true)
          .is('deleted_at', null);
      }

      let saved: BankAccountRow | null = null;

      if (initialAccount) {
        const { data, error: updateError } = await supabase
          .from('bank_accounts')
          .update(payload)
          .eq('id', initialAccount.id)
          .select()
          .single();
        if (updateError) throw updateError;
        saved = data as BankAccountRow;
      } else {
        const { data, error: insertError } = await supabase
          .from('bank_accounts')
          .insert({ ...payload, user_id: user.id })
          .select()
          .single();
        if (insertError) throw insertError;
        saved = data as BankAccountRow;
      }

      if (saved) onSaved(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  function selectBank(bank: BankOption) {
    setForm((prev) => ({ ...prev, bank_name: bank.name, bank_slug: bank.slug }));
    setBankOpen(false);
    setBankSearch('');
  }

  function useCustomBank() {
    const custom = bankSearch.trim();
    if (!custom) return;
    setForm((prev) => ({ ...prev, bank_name: custom, bank_slug: null }));
    setBankOpen(false);
    setBankSearch('');
  }

  return (
    <div className={cn('space-y-4', variant === 'dialog' ? '' : 'rounded-xl border border-border bg-card p-4')}>
      {/* Label */}
      <div>
        <Label htmlFor="bank-label" className="text-xs font-medium text-muted-foreground">
          Libelle *
        </Label>
        <Input
          id="bank-label"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="Compte pro, Compte SARL…"
          className="mt-1"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Comment tu reconnais ce compte dans la liste.
        </p>
      </div>

      {/* Bank combobox */}
      <div>
        <Label className="text-xs font-medium text-muted-foreground">Banque *</Label>
        <div className="relative mt-1">
          <button
            type="button"
            onClick={() => setBankOpen((v) => !v)}
            className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm ring-offset-background transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <span className="flex items-center gap-2 truncate">
              <Landmark className="h-4 w-4 text-[#d35400]" />
              <span className={cn('truncate', !form.bank_name && 'text-muted-foreground')}>
                {form.bank_name || 'Choisis ta banque'}
              </span>
            </span>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', bankOpen && 'rotate-180')} />
          </button>

          {bankOpen && (
            <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    value={bankSearch}
                    onChange={(e) => setBankSearch(e.target.value)}
                    placeholder="Rechercher une banque…"
                    className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="max-h-[260px] overflow-y-auto py-1">
                {filteredBanks.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Aucune banque ne correspond a ta recherche.
                  </div>
                ) : (
                  filteredBanks.map((bank) => (
                    <button
                      key={bank.slug}
                      type="button"
                      onClick={() => selectBank(bank)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                        form.bank_slug === bank.slug && 'bg-accent',
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d35400]/10 text-[#d35400]">
                          <Landmark className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{bank.name}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {BANK_CATEGORY_LABELS[bank.category]}
                          </p>
                        </div>
                      </div>
                      {form.bank_slug === bank.slug && <Check className="h-4 w-4 text-[#d35400]" />}
                    </button>
                  ))
                )}
              </div>
              {bankSearch.trim().length > 0 && (
                <div className="border-t border-border p-2">
                  <button
                    type="button"
                    onClick={useCustomBank}
                    className="flex w-full items-center justify-center rounded-md px-3 py-2 text-xs font-medium text-[#d35400] hover:bg-[#d35400]/5"
                  >
                    Utiliser &laquo;&nbsp;{bankSearch.trim()}&nbsp;&raquo; comme nom de banque
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Titulaire */}
      <div>
        <Label htmlFor="bank-holder" className="text-xs font-medium text-muted-foreground">
          Titulaire du compte *
        </Label>
        <Input
          id="bank-holder"
          value={form.account_holder}
          onChange={(e) => setForm({ ...form, account_holder: e.target.value })}
          placeholder="Nom ou raison sociale"
          className="mt-1"
        />
      </div>

      {/* IBAN */}
      <div>
        <Label htmlFor="bank-iban" className="text-xs font-medium text-muted-foreground">
          IBAN *
        </Label>
        <Input
          id="bank-iban"
          value={form.iban}
          onChange={(e) => setForm({ ...form, iban: formatIban(e.target.value) })}
          placeholder="FR76 0000 0000 0000 0000 0000 000"
          className={cn('mt-1 font-mono uppercase tracking-wide', !ibanValid && 'border-destructive focus-visible:ring-destructive')}
          spellCheck={false}
          autoCapitalize="characters"
        />
        {ibanClean.length > 0 && !ibanValid && (
          <p className="mt-1 text-[11px] text-destructive">Format IBAN invalide (cle de controle).</p>
        )}
        {ibanClean.length > 0 && ibanValid && (
          <p className="mt-1 text-[11px] text-emerald-600">IBAN valide.</p>
        )}
      </div>

      {/* BIC */}
      <div>
        <Label htmlFor="bank-bic" className="text-xs font-medium text-muted-foreground">
          BIC / SWIFT *
        </Label>
        <Input
          id="bank-bic"
          value={form.bic}
          onChange={(e) => setForm({ ...form, bic: e.target.value.toUpperCase() })}
          placeholder="AGRIFRPP"
          className={cn('mt-1 font-mono uppercase', !bicValid && 'border-destructive focus-visible:ring-destructive')}
          spellCheck={false}
          maxLength={11}
        />
        {bicClean.length > 0 && !bicValid && (
          <p className="mt-1 text-[11px] text-destructive">Le BIC doit faire 8 ou 11 caracteres.</p>
        )}
      </div>

      {/* Default toggle */}
      {!forceDefault && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Compte par defaut</p>
            <p className="text-[11px] text-muted-foreground">
              Pre-selectionne sur les nouveaux devis et factures.
            </p>
          </div>
          <Switch
            checked={form.is_default}
            onCheckedChange={(checked) => setForm({ ...form, is_default: checked })}
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Annuler
          </Button>
        )}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-[#d35400] text-white hover:bg-[#b94800]"
        >
          {saving ? 'Enregistrement…' : initialAccount ? 'Enregistrer' : 'Ajouter ce RIB'}
        </Button>
      </div>
    </div>
  );
}
