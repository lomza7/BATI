'use client';

/**
 * Dialog de création d'une facture de solde à partir d'un devis et de ses
 * acomptes déjà émis. La facture de solde :
 *
 *  - reprend toutes les lignes du devis (pour traçabilité légale),
 *  - stocke en DB le total BRUT du devis (pas le reste à payer),
 *  - affiche au rendu (PDF + vue publique) la déduction des acomptes payés
 *    ou émis, calculée à partir des factures d'acompte liées (voir
 *    `lib/invoices/deposits.ts` et `components/shared/document-preview-dialog.tsx`).
 *
 * Pourquoi le brut en DB plutôt que le net : si un acompte est annulé
 * après coup, la facture de solde reste correcte sans besoin de la
 * modifier. La déduction est une vue, pas une donnée persistante.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Loader as Loader2, Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/constants';
import { computeTvaBreakdown } from '@/lib/tva';
import { getNextInvoiceNumber } from '@/lib/document-numbers';
import type { QuoteBillingSummary } from '@/lib/invoices/deposits';

interface QuoteLine {
  id: string;
  description: string;
  detail?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  total: number;
  position: number;
  section?: string | null;
}

interface DialogQuote {
  id: string;
  quote_number: string;
  title: string;
  total_ht: number;
  total_ttc: number;
  tva_rate: number;
  bank_account_id: string | null;
  client_id: string | null;
  project_id?: string | null;
  quote_lines: QuoteLine[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: DialogQuote;
  billing: QuoteBillingSummary;
  onCreated?: (invoiceId: string) => void;
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function CreateFinalInvoiceDialog({
  open,
  onOpenChange,
  quote,
  billing,
  onCreated,
}: Props) {
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  const deposits = useMemo(
    () => billing.invoices.filter((i) => i.invoice_type === 'acompte'),
    [billing.invoices],
  );

  const deductedTtc = useMemo(
    () => deposits.reduce((sum, d) => sum + Number(d.total_ttc || 0), 0),
    [deposits],
  );

  const remainingToPayTtc = Math.max(0, quote.total_ttc - deductedTtc);

  const hasUnpaidDeposit = deposits.some((d) => d.status !== 'payee');

  async function handleCreate() {
    if (!user || !confirmed || submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const invNumber = await getNextInvoiceNumber(supabase, user.id);

      // Recalcule les totaux à partir des lignes du devis pour un
      // tva_breakdown garanti cohérent, même si le devis stocke un total
      // legacy légèrement différent.
      const tvaInput = quote.quote_lines.length > 0
        ? quote.quote_lines.map((l) => ({
            quantity: l.quantity,
            unit_price: l.unit_price,
            tva_rate: l.tva_rate ?? 20,
          }))
        : [{ quantity: 1, unit_price: quote.total_ht, tva_rate: quote.tva_rate ?? 20 }];
      const tva = computeTvaBreakdown(tvaInput);

      const { data: invoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          invoice_number: invNumber,
          invoice_type: 'solde',
          quote_id: quote.id,
          client_id: quote.client_id,
          project_id: quote.project_id || null,
          bank_account_id: quote.bank_account_id,
          title: `Solde — ${quote.title}`,
          description: `Facture de solde du devis ${quote.quote_number}`,
          total_ht: tva.total_ht || quote.total_ht,
          total_tva: tva.total_tva,
          total_ttc: tva.total_ttc || quote.total_ttc,
          tva_rate: tva.primary_rate,
          tva_breakdown: tva.tva_breakdown,
          due_date: addDays(30),
          status: 'brouillon',
        })
        .select('id')
        .single();

      if (insertError || !invoice) {
        throw insertError || new Error('Impossible de créer la facture de solde.');
      }

      // Copie toutes les lignes du devis (important pour traçabilité)
      if (quote.quote_lines.length > 0) {
        await supabase.from('invoice_lines').insert(
          quote.quote_lines.map((line, idx) => ({
            user_id: user.id,
            invoice_id: invoice.id,
            description: line.description,
            detail: line.detail || null,
            quantity: line.quantity,
            unit: line.unit,
            unit_price: line.unit_price,
            tva_rate: line.tva_rate ?? 20,
            section: line.section || null,
            total: line.total || line.quantity * line.unit_price,
            position: typeof line.position === 'number' ? line.position : idx,
          })),
        );
      } else if (quote.total_ht > 0) {
        await supabase.from('invoice_lines').insert({
          user_id: user.id,
          invoice_id: invoice.id,
          description: quote.title || 'Prestation',
          quantity: 1,
          unit: 'forfait',
          unit_price: quote.total_ht,
          tva_rate: quote.tva_rate ?? 20,
          total: quote.total_ht,
          position: 0,
        });
      }

      // Phase projet "Facture de solde envoyée"
      await maybeMarkProjectPhase(quote.id, 'facture_solde');

      onCreated?.(invoice.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création de la facture de solde.');
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
            Facturer le solde
          </DialogTitle>
          <DialogDescription className="text-xs">
            Devis <span className="font-medium text-foreground">{quote.quote_number}</span> —{' '}
            {quote.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Récap des montants */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total devis HT</span>
              <span className="tabular-nums">{formatCurrency(quote.total_ht)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total devis TTC</span>
              <span className="font-semibold tabular-nums">{formatCurrency(quote.total_ttc)}</span>
            </div>
          </div>

          {/* Liste des acomptes */}
          {deposits.length > 0 ? (
            <div className="rounded-xl border border-[#d35400]/20 bg-[#fff7f0] p-3 space-y-2">
              <p className="text-xs font-semibold text-[#d35400] uppercase tracking-wide">
                Acomptes à déduire
              </p>
              {deposits.map((d) => {
                const dateStr = d.issued_at || d.created_at;
                return (
                  <div key={d.id} className="flex items-center justify-between text-sm gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{d.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(dateStr)}
                        {d.status !== 'payee' && (
                          <span className="ml-1 text-amber-700">• Non payé</span>
                        )}
                      </p>
                    </div>
                    <span className="tabular-nums font-medium">
                      − {formatCurrency(Number(d.total_ttc))}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-2 border-t border-[#d35400]/20 text-sm">
                <span className="font-semibold">Total déduit</span>
                <span className="font-semibold tabular-nums">
                  − {formatCurrency(deductedTtc)}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
              Aucun acompte n&apos;a encore été émis sur ce devis. La facture de solde reprendra
              le total complet du devis.
            </div>
          )}

          {/* Reste à payer */}
          <div className="rounded-xl border border-[#d35400] bg-[#fff7f0] p-4 text-center">
            <p className="text-xs text-[#d35400] uppercase tracking-wide">Reste à payer TTC</p>
            <p className="text-2xl font-bold text-[#d35400] tabular-nums mt-1">
              {formatCurrency(remainingToPayTtc)}
            </p>
          </div>

          {/* Warning acompte non payé */}
          {hasUnpaidDeposit && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Attention : un ou plusieurs acomptes ne sont pas encore marqués comme payés.
                Vous pouvez créer la facture de solde, mais vérifiez bien les encaissements avant
                l&apos;envoi au client.
              </p>
            </div>
          )}

          {/* Confirmation obligatoire */}
          <label
            htmlFor="final-confirm"
            className="flex items-start gap-2 rounded-lg border border-border bg-background p-3 cursor-pointer"
          >
            <Checkbox
              id="final-confirm"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="final-confirm" className="text-sm cursor-pointer leading-snug">
              Je confirme que tous les acomptes ci-dessus seront déduits sur cette facture de solde.
            </Label>
          </label>

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
              disabled={!confirmed || submitting}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="h-4 w-4" />
              )}
              {submitting ? 'Création…' : 'Créer la facture de solde'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Coche la phase projet "facture_solde" — même logique que dans
 * request-deposit-dialog.tsx. Non bloquant en cas d'échec.
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
