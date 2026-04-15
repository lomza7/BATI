'use client';

/**
 * Dialog de création d'une facture d'acompte à partir d'un devis accepté.
 *
 * Saisie en % du total HT du devis OU en montant HT libre, preview live
 * HT/TVA/TTC avec le taux majoritaire du devis. Crée une facture de type
 * `acompte` liée au `quote_id`, avec une ligne unique "Acompte X% sur devis
 * D-YYYY-NNN". Coche automatiquement la phase projet `acompte_demande`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader as Loader2, Plus, Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/constants';
import { getNextInvoiceNumber } from '@/lib/document-numbers';
import { computeDepositAmount, type QuoteBillingSummary } from '@/lib/invoices/deposits';

interface DialogQuote {
  id: string;
  quote_number: string;
  title: string;
  total_ht: number;
  total_ttc: number;
  /** Taux de TVA majoritaire du devis (pour calculer l'acompte) */
  tva_rate: number;
  bank_account_id: string | null;
  client_id: string | null;
  project_id?: string | null;
  /** % d'acompte prévu à la création du devis — utilisé pour préremplir */
  deposit_percentage?: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: DialogQuote;
  billing: QuoteBillingSummary;
  onCreated?: (invoiceId: string) => void;
}

type Mode = 'percentage' | 'amount_ht';

const PERCENT_SHORTCUTS = [30, 40, 50];

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().split('T')[0];
}

export function RequestDepositDialog({ open, onOpenChange, quote, billing, onCreated }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('percentage');
  const [percentValue, setPercentValue] = useState<string>('30');
  const [amountHtValue, setAmountHtValue] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>(defaultDueDate());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Reset local state chaque fois qu'on réouvre le dialog
  useEffect(() => {
    if (!open) return;
    setMode('percentage');
    // Prérempli avec le % d'acompte défini sur le devis si présent,
    // sinon 30 par défaut.
    const prefillPct = quote.deposit_percentage && quote.deposit_percentage > 0
      ? String(quote.deposit_percentage)
      : '30';
    setPercentValue(prefillPct);
    setAmountHtValue('');
    setCustomTitle('');
    setDueDate(defaultDueDate());
    setError('');
    setSubmitting(false);
  }, [open]);

  const numericValue = useMemo(() => {
    const raw = mode === 'percentage' ? percentValue : amountHtValue;
    const n = parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [mode, percentValue, amountHtValue]);

  const preview = useMemo(
    () => computeDepositAmount(mode, numericValue, quote.total_ht, quote.tva_rate),
    [mode, numericValue, quote.total_ht, quote.tva_rate],
  );

  // Reste à facturer HT (on borne la saisie en HT sur cette valeur).
  // billing.remainingTtc est déjà en TTC → on convertit en HT via le taux majoritaire.
  const remainingHt = useMemo(() => {
    const rate = 1 + (quote.tva_rate || 0) / 100;
    return rate > 0 ? Math.max(0, billing.remainingTtc / rate) : 0;
  }, [billing.remainingTtc, quote.tva_rate]);

  const suggestedTitle = useMemo(() => {
    const pct = preview.percentage;
    if (pct !== null && pct > 0) {
      return `Acompte ${Number.isInteger(pct) ? pct : pct.toFixed(2).replace('.', ',')}% — ${quote.title}`;
    }
    return `Acompte — ${quote.title}`;
  }, [preview.percentage, quote.title]);

  const effectiveTitle = customTitle.trim() || suggestedTitle;

  // Garde-fous de validation affichés en temps réel
  const validationError: string | null = useMemo(() => {
    if (numericValue <= 0) return 'Saisissez un montant supérieur à 0.';
    if (mode === 'percentage' && numericValue > 100) return 'Le pourcentage ne peut pas dépasser 100 %.';
    if (preview.total_ht <= 0) return 'Le montant HT calculé doit être supérieur à 0.';
    // On accepte une petite marge d'arrondi (1 centime)
    if (preview.total_ht > remainingHt + 0.01) {
      return `Le montant dépasse le reste à facturer (${formatCurrency(remainingHt)} HT).`;
    }
    return null;
  }, [numericValue, mode, preview.total_ht, remainingHt]);

  // Warning soft : si l'acompte + les précédents dépasse 90% du devis, suggérer
  // d'utiliser plutôt "Facturer le solde".
  const nearFullWarning = useMemo(() => {
    const futureInvoicedTtc = billing.invoicedTtc + preview.total_ttc;
    if (billing.quoteTotalTtc > 0 && futureInvoicedTtc > billing.quoteTotalTtc * 0.9 && !billing.hasFinalInvoice) {
      return 'Astuce : pour le dernier paiement, utilisez "Facturer le solde" plutôt qu\'un nouvel acompte.';
    }
    return null;
  }, [billing, preview.total_ttc]);

  async function handleCreate() {
    if (!user) return;
    if (validationError) return;

    setSubmitting(true);
    setError('');

    try {
      const invNumber = await getNextInvoiceNumber(supabase, user.id);

      const { data: invoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          invoice_number: invNumber,
          invoice_type: 'acompte',
          deposit_percentage: preview.percentage,
          quote_id: quote.id,
          client_id: quote.client_id,
          project_id: quote.project_id || null,
          bank_account_id: quote.bank_account_id,
          title: effectiveTitle,
          description: `Acompte sur le devis ${quote.quote_number}`,
          total_ht: preview.total_ht,
          total_tva: preview.total_tva,
          total_ttc: preview.total_ttc,
          tva_rate: quote.tva_rate,
          tva_breakdown: [
            { rate: quote.tva_rate, base_ht: preview.total_ht, tva_amount: preview.total_tva },
          ],
          due_date: dueDate,
          status: 'brouillon',
        })
        .select('id')
        .single();

      if (insertError || !invoice) {
        throw insertError || new Error('Impossible de créer la facture d\'acompte.');
      }

      // Ligne unique "Acompte X% sur devis D-YYYY-NNN" — les acomptes n'ont pas
      // de détail ligne par ligne, c'est le principe légal.
      const lineDescription =
        preview.percentage !== null && preview.percentage > 0
          ? `Acompte de ${
              Number.isInteger(preview.percentage)
                ? preview.percentage
                : preview.percentage.toFixed(2).replace('.', ',')
            } % sur devis ${quote.quote_number}`
          : `Acompte sur devis ${quote.quote_number}`;

      await supabase.from('invoice_lines').insert({
        user_id: user.id,
        invoice_id: invoice.id,
        description: lineDescription,
        quantity: 1,
        unit: 'forfait',
        unit_price: preview.total_ht,
        tva_rate: quote.tva_rate,
        total: preview.total_ht,
        position: 0,
      });

      // Coche la phase projet "Acompte demandé" si elle existe et n'est pas déjà cochée
      await maybeMarkProjectPhase(quote.id, 'acompte_demande');

      onCreated?.(invoice.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création de l\'acompte.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#d35400]" />
            Demander un acompte
          </DialogTitle>
          <DialogDescription className="text-xs">
            Devis <span className="font-medium text-foreground">{quote.quote_number}</span> —{' '}
            {quote.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bandeau résumé du devis */}
          <div className="rounded-xl bg-[#fff7f0] border border-[#d35400]/15 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total devis TTC</span>
              <span className="font-semibold">{formatCurrency(quote.total_ttc)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">Déjà facturé</span>
              <span className="font-semibold text-[#d35400]">
                {formatCurrency(billing.invoicedTtc)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-[#d35400]/20">
              <span className="text-muted-foreground">Reste à facturer TTC</span>
              <span className="font-semibold">{formatCurrency(billing.remainingTtc)}</span>
            </div>
          </div>

          {/* Sélecteur de mode */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="percentage" className="flex-1">
                Pourcentage
              </TabsTrigger>
              <TabsTrigger value="amount_ht" className="flex-1">
                Montant HT
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Input */}
          {mode === 'percentage' ? (
            <div>
              <Label htmlFor="deposit-percent" className="text-sm font-medium">
                Pourcentage du devis
              </Label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="deposit-percent"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="100"
                    step="0.01"
                    value={percentValue}
                    onChange={(e) => setPercentValue(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {PERCENT_SHORTCUTS.map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPercentValue(String(pct))}
                    className="min-h-[44px] px-4 rounded-full border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
                  >
                    {pct} %
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="deposit-amount" className="text-sm font-medium">
                Montant HT de l&apos;acompte
              </Label>
              <div className="mt-1 relative">
                <Input
                  id="deposit-amount"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={amountHtValue}
                  onChange={(e) => setAmountHtValue(e.target.value)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  €
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Max : {formatCurrency(remainingHt)} HT restant à facturer
              </p>
            </div>
          )}

          {/* Preview live */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant HT</span>
              <span className="font-medium tabular-nums">{formatCurrency(preview.total_ht)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                TVA {quote.tva_rate}
                {quote.tva_rate % 1 !== 0 ? '' : ''} %
              </span>
              <span className="font-medium tabular-nums">{formatCurrency(preview.total_tva)}</span>
            </div>
            <div className="flex justify-between pt-1 mt-1 border-t border-border">
              <span className="font-semibold">Montant TTC</span>
              <span className="font-semibold tabular-nums text-[#d35400]">
                {formatCurrency(preview.total_ttc)}
              </span>
            </div>
          </div>

          {/* Titre */}
          <div>
            <Label htmlFor="deposit-title" className="text-sm font-medium">
              Titre de la facture
            </Label>
            <Input
              id="deposit-title"
              className="mt-1"
              placeholder={suggestedTitle}
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground truncate">
              Sera enregistré comme : <span className="text-foreground">{effectiveTitle}</span>
            </p>
          </div>

          {/* Échéance */}
          <div>
            <Label htmlFor="deposit-due" className="text-sm font-medium">
              Date d&apos;échéance
            </Label>
            <Input
              id="deposit-due"
              type="date"
              className="mt-1"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Warnings & erreurs */}
          {nearFullWarning && !validationError && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              {nearFullWarning}
            </p>
          )}
          {validationError && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {validationError}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || validationError !== null}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {submitting ? 'Création…' : 'Créer la facture d\'acompte'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Coche une phase projet si le projet existe pour ce devis et que la phase
 * n'est pas déjà validée. Silencieux en cas d'échec — la facture reste créée.
 *
 * Le schéma `projects.completed_phases` est un JSONB array de
 * `{ key, completed_at }`. On calcule aussi la progress en sommant les
 * poids des phases cochées par rapport à la config utilisateur.
 */
async function maybeMarkProjectPhase(quoteId: string, phaseKey: string): Promise<void> {
  try {
    const { data: project } = await supabase
      .from('projects')
      .select('id, completed_phases')
      .eq('quote_id', quoteId)
      .maybeSingle();

    if (!project?.id) return;

    const completed = Array.isArray(project.completed_phases)
      ? (project.completed_phases as Array<{ key: string; completed_at: string }>)
      : [];

    if (completed.some((p) => p.key === phaseKey)) return;

    const updated = [...completed, { key: phaseKey, completed_at: new Date().toISOString() }];

    // Recalcule la progress à partir de la config utilisateur si disponible
    const { data: profile } = await supabase
      .from('profiles')
      .select('project_phases_config')
      .maybeSingle();

    const phasesConfig =
      profile?.project_phases_config && Array.isArray(profile.project_phases_config)
        ? (profile.project_phases_config as Array<{ key: string; weight: number }>)
        : [];

    const progress = phasesConfig
      .filter((phase) => updated.some((p) => p.key === phase.key))
      .reduce((sum, phase) => sum + (Number(phase.weight) || 0), 0);

    await supabase
      .from('projects')
      .update({
        completed_phases: updated,
        progress: phasesConfig.length > 0 ? progress : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);
  } catch {
    // Non bloquant
  }
}
