'use client';

/**
 * Carte "Facturation" pour un devis accepté : résumé chiffré (facturé /
 * reste à facturer), timeline des factures liées (acomptes + solde) et
 * actions contextuelles (demander un acompte, facturer en totalité,
 * facturer le solde).
 *
 * Gère son propre fetch du billing via `fetchQuoteBilling` et expose
 * `onBillingChanged` pour que le parent puisse rafraîchir sa propre
 * liste après une action. Prévue pour être embarquée dans un dialog
 * "Facturation" depuis la page Devis ou la page Factures.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CircleCheck as CheckCircle,
  Loader as Loader2,
  Plus,
  Receipt,
  Send,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, INVOICE_STATUSES } from '@/lib/constants';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  fetchQuoteBilling,
  type QuoteBillingSummary,
  type DepositInvoice,
} from '@/lib/invoices/deposits';
import { RequestDepositDialog } from '@/components/factures/request-deposit-dialog';
import { CreateFinalInvoiceDialog } from '@/components/factures/create-final-invoice-dialog';

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

interface CardQuote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_ht: number;
  total_ttc: number;
  tva_rate: number;
  bank_account_id: string | null;
  client_id: string | null;
  project_id?: string | null;
  quote_lines: QuoteLine[];
}

interface Props {
  quote: CardQuote;
  /** Appelée après création d'une facture (acompte/solde/standard) ou action sur une facture existante */
  onBillingChanged?: () => void;
  /** Permet au parent de demander l'ouverture immédiate de l'action "Envoyer" sur une facture donnée */
  onSendInvoice?: (invoice: DepositInvoice) => void;
  /** Appelé pour prévisualiser une facture (navigation ou preview dialog) */
  onPreviewInvoice?: (invoice: DepositInvoice) => void;
}

export function QuoteBillingCard({
  quote,
  onBillingChanged,
  onSendInvoice,
  onPreviewInvoice,
}: Props) {
  const { user } = useAuth();
  const [billing, setBilling] = useState<QuoteBillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingStandard, setCreatingStandard] = useState(false);
  const [error, setError] = useState('');

  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [showFinalDialog, setShowFinalDialog] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const summary = await fetchQuoteBilling(supabase, quote.id, quote.total_ht, quote.total_ttc);
    setBilling(summary);
    setLoading(false);
  }, [quote.id, quote.total_ht, quote.total_ttc]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const progress = useMemo(() => {
    if (!billing || billing.quoteTotalTtc <= 0) return 0;
    return Math.min(100, Math.round((billing.invoicedTtc / billing.quoteTotalTtc) * 100));
  }, [billing]);

  async function handleCreateStandardInvoice() {
    if (!user || !billing) return;
    setCreatingStandard(true);
    setError('');

    try {
      // Import dynamique pour éviter de polluer le bundle client avec
      // les helpers TVA et numérotation si le bouton n'est pas utilisé.
      const { computeTvaBreakdown } = await import('@/lib/tva');
      const { getNextInvoiceNumber } = await import('@/lib/document-numbers');

      const invNumber = await getNextInvoiceNumber(supabase, user.id);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

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
          invoice_type: 'standard',
          quote_id: quote.id,
          client_id: quote.client_id,
          project_id: quote.project_id || null,
          bank_account_id: quote.bank_account_id,
          title: quote.title || `Facture ${quote.quote_number}`,
          total_ht: tva.total_ht || quote.total_ht,
          total_tva: tva.total_tva,
          total_ttc: tva.total_ttc || quote.total_ttc,
          tva_rate: tva.primary_rate,
          tva_breakdown: tva.tva_breakdown,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'brouillon',
        })
        .select('id')
        .single();

      if (insertError || !invoice) {
        throw insertError || new Error('Impossible de créer la facture.');
      }

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
        // Devis importé sans lignes détaillées : créer une ligne avec le total
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

      await refresh();
      onBillingChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création de la facture.');
    } finally {
      setCreatingStandard(false);
    }
  }

  async function handleDialogCreated() {
    await refresh();
    onBillingChanged?.();
  }

  if (loading || !billing) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement de la facturation…
        </div>
      </div>
    );
  }

  const hasDeposits = billing.invoices.some((i) => i.invoice_type === 'acompte');
  const isQuoteAccepted = quote.status === 'accepte';

  return (
    <>
      <div className="rounded-2xl border border-[#d35400]/30 bg-card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff7f0] text-[#d35400]">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Facturation</p>
            <p className="text-xs text-muted-foreground">
              Devis {quote.quote_number} • {quote.title}
            </p>
          </div>
        </div>

        {/* Résumé chiffré */}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#fff7f0] border border-[#d35400]/15 p-3">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Total devis</p>
            <p className="text-base font-semibold tabular-nums">
              {formatCurrency(billing.quoteTotalTtc)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Facturé</p>
            <p className="text-base font-semibold tabular-nums text-[#d35400]">
              {formatCurrency(billing.invoicedTtc)}
            </p>
            <p className="text-[10px] text-muted-foreground">{progress}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Reste</p>
            <p className="text-base font-semibold tabular-nums">
              {formatCurrency(billing.remainingTtc)}
            </p>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="h-2 w-full rounded-full bg-[#fff1e8] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#d35400] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Timeline des factures */}
        {billing.invoices.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Factures émises
            </p>
            {billing.invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                onSend={onSendInvoice}
                onPreview={onPreviewInvoice}
              />
            ))}
            <div className="flex justify-between pt-2 text-xs">
              <span className="text-muted-foreground">Total encaissé</span>
              <span className="font-medium tabular-nums text-emerald-600">
                {formatCurrency(billing.collectedTtc)}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Aucune facture émise pour ce devis. Démarrez par un acompte ou facturez directement
              en totalité.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        {/* Actions */}
        {isQuoteAccepted && (
          <div className="flex flex-col sm:flex-row gap-2">
            {!billing.hasFinalInvoice && !billing.hasStandardInvoice && billing.remainingTtc > 0 && (
              <Button
                variant="outline"
                className="gap-2 flex-1"
                onClick={() => setShowDepositDialog(true)}
              >
                <Plus className="h-4 w-4" /> Demander un acompte
              </Button>
            )}
            {!hasDeposits && !billing.hasFinalInvoice && !billing.hasStandardInvoice && (
              <Button
                className="gap-2 flex-1"
                onClick={handleCreateStandardInvoice}
                disabled={creatingStandard}
              >
                {creatingStandard ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Facturer en totalité
              </Button>
            )}
            {hasDeposits && !billing.hasFinalInvoice && (
              <Button className="gap-2 flex-1" onClick={() => setShowFinalDialog(true)}>
                <Receipt className="h-4 w-4" /> Facturer le solde
              </Button>
            )}
          </div>
        )}

        {!isQuoteAccepted && (
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 p-2">
            Le devis doit être accepté avant d&apos;émettre des factures.
          </p>
        )}
      </div>

      <RequestDepositDialog
        open={showDepositDialog}
        onOpenChange={setShowDepositDialog}
        quote={quote}
        billing={billing}
        onCreated={handleDialogCreated}
      />

      <CreateFinalInvoiceDialog
        open={showFinalDialog}
        onOpenChange={setShowFinalDialog}
        quote={quote}
        billing={billing}
        onCreated={handleDialogCreated}
      />
    </>
  );
}

function InvoiceRow({
  invoice,
  onSend,
  onPreview,
}: {
  invoice: DepositInvoice;
  onSend?: (invoice: DepositInvoice) => void;
  onPreview?: (invoice: DepositInvoice) => void;
}) {
  const status = INVOICE_STATUSES[invoice.status as keyof typeof INVOICE_STATUSES];
  const typeLabel =
    invoice.invoice_type === 'acompte'
      ? invoice.deposit_percentage
        ? `Acompte ${
            Number.isInteger(invoice.deposit_percentage)
              ? invoice.deposit_percentage
              : invoice.deposit_percentage.toFixed(2).replace('.', ',')
          }%`
        : 'Acompte'
      : invoice.invoice_type === 'solde'
        ? 'Solde'
        : 'Facture';

  const typeColor =
    invoice.invoice_type === 'acompte'
      ? 'bg-[#fff7f0] text-[#d35400]'
      : invoice.invoice_type === 'solde'
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-slate-100 text-slate-700';

  const isPaid = invoice.status === 'payee';

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`${typeColor} border-0`}>
            {typeLabel}
          </Badge>
          <span className="text-xs font-medium text-foreground">{invoice.invoice_number}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatCurrency(Number(invoice.total_ttc))}
          {isPaid && invoice.paid_at && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-emerald-600">
              <CheckCircle className="h-3 w-3" /> Payé le {formatDate(invoice.paid_at)}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {status && <StatusBadge label={status.label} color={status.color} />}
        {onPreview && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onPreview(invoice)}
            title="Visualiser"
          >
            <Receipt className="h-3.5 w-3.5" />
          </Button>
        )}
        {onSend && invoice.status !== 'payee' && invoice.status !== 'annulee' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[#d35400]"
            onClick={() => onSend(invoice)}
            title="Envoyer"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
