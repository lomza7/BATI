'use client';

/**
 * Dialog d'émission d'un avoir (facture rectificative) sur une facture déjà
 * émise.
 *
 * En droit français on ne modifie ni ne supprime une facture émise
 * (art. L.102 B LPF) : la seule correction possible est l'avoir, qui est
 * lui-même une facture à part entière (art. 289 CGI), numérotée dans sa
 * propre série `AV-YYYY-NNN` et rattachée de façon non équivoque à la
 * facture rectifiée.
 *
 * Deux modes :
 *  - **avoir total** : miroir exact des lignes de la facture, signes inversés
 *    (on conserve la structure en sections et le taux de TVA ligne à ligne,
 *    sinon un chantier à 10 % régulariserait de la TVA à 20 %). Exception : une
 *    facture de solde avec acomptes, dont les lignes décrivent le devis entier —
 *    on rectifie alors le seul net réclamé, ventilé par taux de TVA ;
 *  - **avoir partiel** : une ligne unique au montant et au taux choisis, pour
 *    un geste commercial ou une régularisation.
 *
 * L'avoir est créé directement en statut `creee` avec son `issued_at` : un
 * numéro de la série AV ne doit pas être réservé par un brouillon qui ne
 * partirait jamais, la séquence doit rester continue. Il n'a ni échéance ni
 * RIB : il n'y a rien à encaisser.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader as Loader2, TriangleAlert as AlertTriangle, Undo2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/constants';
import {
  LINE_TVA_RATES,
  computeTvaBreakdown,
  formatTvaRate,
  parseTvaBreakdown,
  type TvaBreakdownEntry,
} from '@/lib/tva';
import { getNextCreditNoteNumber } from '@/lib/document-numbers';
import {
  CREDIT_REASONS,
  buildCreditNoteLegalMention,
  buildFullCreditNoteLines,
  buildPartialCreditNoteLine,
  creditReasonLabel,
  claimedHt,
  claimedTtc,
  fetchCreditNotesByInvoice,
  netDueTtc,
  remainingCreditableTtc,
  sumCreditNotesTtc,
  type CreditNoteRef,
  type SourceInvoiceLine,
} from '@/lib/invoices/credit-notes';

/** Facture à rectifier, telle que la liste des factures la connaît. */
export interface CreditNoteSourceInvoice {
  id: string;
  invoice_number: string;
  title: string;
  total_ht: number;
  total_ttc: number;
  issued_at: string | null;
  created_at: string;
  /** Une facture de solde stocke le total BRUT du devis — cf. `claimedTtc`. */
  invoice_type?: string | null;
  quote_id?: string | null;
  clients?: { name: string; email?: string | null } | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: CreditNoteSourceInvoice;
  onCreated?: (creditNoteId: string) => void;
}

type Mode = 'total' | 'partiel';

/** Le Select de TVA n'affiche que les taux connus — on rabat les autres sur 20 %. */
function safeTvaRate(rate: unknown): number {
  const value = Number(rate);
  return (LINE_TVA_RATES as readonly number[]).includes(value) ? value : 20;
}

function parseAmount(raw: string): number {
  const value = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Ventile un montant HT sur les taux de TVA du document, au prorata de la base
 * HT portée par chaque taux.
 *
 * Une facture de rénovation mélange couramment 10 % et 20 %. Rectifier son net
 * réclamé par une ligne unique au taux majoritaire imputerait toute la TVA
 * régularisée à ce seul taux, et le TTC de l'avoir ne retomberait pas sur le
 * montant réellement réclamé au client (trop bas à 10 %, au-dessus du plafond
 * de créditation à 20 %). Une ligne par taux rétablit les deux.
 *
 * La dernière part reçoit le solde : la somme des lignes retombe au centime sur
 * le montant à créditer.
 */
function splitHtByRate(
  amountHt: number,
  breakdown: TvaBreakdownEntry[],
  fallbackRate: number,
): Array<{ amountHt: number; tvaRate: number }> {
  const target = round2(Math.abs(amountHt));
  const weights = breakdown
    .map((entry) => ({ rate: Number(entry.rate), weight: Math.abs(Number(entry.base_ht) || 0) }))
    .filter((entry) => Number.isFinite(entry.rate) && entry.weight > 0);
  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0);

  if (weights.length <= 1 || totalWeight <= 0) {
    return [{ amountHt: target, tvaRate: weights.length === 1 ? weights[0].rate : fallbackRate }];
  }

  let allocated = 0;
  return weights
    .map((entry, index) => {
      const share =
        index === weights.length - 1
          ? round2(target - allocated)
          : round2((target * entry.weight) / totalWeight);
      allocated = round2(allocated + share);
      return { amountHt: share, tvaRate: entry.rate };
    })
    .filter((part) => part.amountHt > 0);
}

export function CreateCreditNoteDialog({ open, onOpenChange, invoice, onCreated }: Props) {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>('total');
  const [loading, setLoading] = useState(true);
  const [sourceLines, setSourceLines] = useState<SourceInvoiceLine[]>([]);
  const [sourceClientId, setSourceClientId] = useState<string | null>(null);
  const [sourceProjectId, setSourceProjectId] = useState<string | null>(null);
  const [sourceTvaRate, setSourceTvaRate] = useState<number>(20);
  /** Taux de TVA portés par la facture, avec leur base HT (colonne `tva_breakdown`). */
  const [sourceBreakdown, setSourceBreakdown] = useState<TvaBreakdownEntry[]>([]);
  const [existingNotes, setExistingNotes] = useState<CreditNoteRef[]>([]);
  const [amountHt, setAmountHt] = useState('');
  const [tvaRate, setTvaRate] = useState<number>(20);
  const [customLabel, setCustomLabel] = useState('');
  const [reason, setReason] = useState<string>(CREDIT_REASONS[0].value);
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  /** Chargement impossible : on bloque la création plutôt que de plafonner à l'aveugle. */
  const [loadError, setLoadError] = useState('');
  /**
   * Acomptes deja factures sur le meme devis, nets de leurs propres avoirs.
   * Seule une facture de solde en a : son `total_ttc` porte le total brut du
   * devis, pas ce qu'elle a reellement reclame au client.
   */
  const [depositsTtc, setDepositsTtc] = useState(0);

  // Rechargement complet à chaque ouverture : les avoirs déjà émis servent de
  // garde-fou, ils doivent être frais et non hérités d'un rendu précédent.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setMode('total');
    setAmountHt('');
    setCustomLabel('');
    setReason(CREDIT_REASONS[0].value);
    setCustomReason('');
    setError('');
    setLoadError('');
    setDepositsTtc(0);
    setSourceBreakdown([]);
    setSubmitting(false);
    setLoading(true);

    (async () => {
      const [detailRes, linesRes, notesMap] = await Promise.all([
        supabase
          .from('invoices')
          // `tva_breakdown` : indispensable pour ventiler un avoir sur une
          // facture multi-taux sans tout imputer au taux majoritaire.
          .select('client_id, project_id, tva_rate, tva_breakdown')
          .eq('id', invoice.id)
          .maybeSingle(),
        // Tous les champs de ligne : sans `section` / `subsection` / `tva_rate`
        // l'avoir perd la structure du document et la TVA à régulariser.
        supabase
          .from('invoice_lines')
          .select('description, detail, quantity, unit, unit_price, tva_rate, section, subsection, total, position')
          .eq('invoice_id', invoice.id)
          .order('position', { ascending: true }),
        fetchCreditNotesByInvoice(supabase, [invoice.id]),
      ]);

      if (cancelled) return;

      // Le plafond de créditation est le seul garde-fou contre un avoir qui
      // dépasserait la facture. S'il n'a pas pu être calculé (lecture des
      // lignes ou des avoirs existants en échec), on refuse d'ouvrir le
      // formulaire plutôt que de laisser passer un montant non plafonné.
      if (detailRes.error || linesRes.error) {
        setLoadError(
          "Impossible de charger la facture. Rechargez la page avant de créer un avoir.",
        );
        setLoading(false);
        return;
      }

      const detail = detailRes.data as {
        client_id?: string | null;
        project_id?: string | null;
        tva_rate?: number | null;
        tva_breakdown?: unknown;
      } | null;
      setSourceClientId(detail?.client_id || null);
      setSourceProjectId(detail?.project_id || null);
      const rate = safeTvaRate(detail?.tva_rate);
      setSourceTvaRate(rate);
      setTvaRate(rate);
      setSourceBreakdown(parseTvaBreakdown(detail?.tva_breakdown));
      setSourceLines((linesRes.data as SourceInvoiceLine[] | null) || []);
      setExistingNotes(notesMap.get(invoice.id) || []);

      // Facture de solde : son `total_ttc` est le total BRUT du devis. Ce
      // qu'elle a reellement reclame au client, c'est ce total moins les
      // acomptes deja factures — eux-memes nets de leurs propres avoirs.
      if (invoice.invoice_type === 'solde' && invoice.quote_id) {
        const { data: deposits, error: depositsError } = await supabase
          .from('invoices')
          .select('id, total_ttc')
          .eq('quote_id', invoice.quote_id)
          .eq('invoice_type', 'acompte')
          .neq('status', 'annulee');

        if (cancelled) return;

        if (depositsError) {
          setLoadError(
            "Impossible de calculer les acomptes deja factures. Rechargez la page avant de creer un avoir.",
          );
          setLoading(false);
          return;
        }

        const rows = (deposits as Array<{ id: string; total_ttc: number | null }> | null) || [];
        const depositNotes = await fetchCreditNotesByInvoice(supabase, rows.map((d) => d.id));
        if (cancelled) return;

        // On borne à 0 acompte par acompte (netDueTtc), et non sur la somme :
        // c'est exactement la règle de `fetchDepositsNetTtc` côté serveur et des
        // routes de paiement. Avec un plafonnement global, un acompte
        // sur-crédité viendrait en déduction des autres et autoriserait un avoir
        // plus élevé ici que ce que le serveur accepte.
        const net = rows.reduce(
          (sum, d) => sum + netDueTtc({ total_ttc: Number(d.total_ttc) || 0 }, depositNotes.get(d.id) || []),
          0,
        );
        setDepositsTtc(Math.round(net * 100) / 100);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, invoice.id]);

  /** Somme (négative) des avoirs déjà émis sur cette facture. */
  const alreadyCreditedTtc = useMemo(() => sumCreditNotesTtc(existingNotes), [existingNotes]);
  /** Montant TTC encore créditable — plafond absolu de l'avoir en cours. */
  const remainingTtc = useMemo(
    () => remainingCreditableTtc(invoice, existingNotes, depositsTtc),
    [invoice, existingNotes, depositsTtc],
  );
  /** Ce que cette facture a reellement reclame au client, avant tout avoir. */
  const claimedTtcValue = useMemo(
    () => claimedTtc(invoice, depositsTtc),
    [invoice, depositsTtc],
  );
  const claimedHtValue = useMemo(
    () => claimedHt(invoice, depositsTtc),
    [invoice, depositsTtc],
  );
  /**
   * Une facture de solde ne peut pas etre avoiree par miroir de ses lignes :
   * celles-ci decrivent le devis entier, acomptes compris. On rectifie le
   * montant net reellement reclame, ventile en une ligne par taux de TVA.
   */
  const mirrorForbidden = invoice.invoice_type === 'solde' && depositsTtc > 0;
  /** Des acomptes ont déjà été facturés sur le devis : le bandeau doit le dire. */
  const hasDeposits = depositsTtc > 0;

  const parsedAmountHt = useMemo(() => parseAmount(amountHt), [amountHt]);

  /**
   * Taux de TVA de la facture avec leur base HT. On préfère le `tva_breakdown`
   * stocké sur le document ; à défaut (import ancien, colonne vide) on le
   * reconstruit depuis les lignes.
   */
  const effectiveBreakdown = useMemo<TvaBreakdownEntry[]>(() => {
    if (sourceBreakdown.length > 0) return sourceBreakdown;
    if (sourceLines.length === 0) return [];
    return computeTvaBreakdown(
      sourceLines.map((line) => ({
        quantity: Number(line.quantity) || 0,
        unit_price: Number(line.unit_price) || 0,
        tva_rate: line.tva_rate === null || line.tva_rate === undefined ? sourceTvaRate : Number(line.tva_rate),
      })),
    ).tva_breakdown;
  }, [sourceBreakdown, sourceLines, sourceTvaRate]);

  /**
   * Lignes de l'avoir quand le miroir ligne à ligne est interdit (solde avec
   * acomptes) : le net réellement réclamé, ventilé sur les taux de TVA que la
   * facture a collectés. L'aperçu et l'insert partent du même tableau, ils ne
   * peuvent pas diverger.
   */
  const netCreditLines = useMemo(() => {
    if (!mirrorForbidden) return [];
    const parts = splitHtByRate(claimedHtValue, effectiveBreakdown, sourceTvaRate);
    const multiRate = parts.length > 1;
    return parts.map((part, index) => ({
      amountHt: part.amountHt,
      tvaRate: part.tvaRate,
      label: multiRate
        ? `Annulation de la facture ${invoice.invoice_number} (net des acomptes) — TVA ${formatTvaRate(part.tvaRate)}`
        : `Annulation de la facture ${invoice.invoice_number} (net des acomptes)`,
      position: index,
    }));
  }, [mirrorForbidden, claimedHtValue, effectiveBreakdown, sourceTvaRate, invoice.invoice_number]);

  /**
   * Totaux de l'avoir, négatifs. En mode total on calcule à partir des lignes
   * réellement insérées : la prévisualisation et l'écriture partent du même
   * tableau, elles ne peuvent pas diverger.
   */
  const creditLinesPreview = useMemo(() => {
    if (mode !== 'total') return [];
    return buildFullCreditNoteLines(sourceLines, 'preview', 'preview');
  }, [mode, sourceLines]);

  const totals = useMemo(() => {
    if (mode === 'total') {
      if (mirrorForbidden) {
        // Les lignes decrivent le devis entier : les refleter crediterait aussi
        // les acomptes, qui ont leur propre facture. On rectifie le net reclame,
        // ventile sur les taux de TVA reellement collectes par la facture.
        return computeTvaBreakdown(
          netCreditLines.map((line) => ({
            quantity: 1,
            unit_price: -Math.abs(line.amountHt),
            tva_rate: line.tvaRate,
          })),
        );
      }
      if (creditLinesPreview.length > 0) {
        return computeTvaBreakdown(
          creditLinesPreview.map((line) => ({
            quantity: line.quantity,
            unit_price: line.unit_price,
            tva_rate: line.tva_rate,
          })),
        );
      }
      // Facture sans lignes détaillées (import CSV, saisie ancienne) : on
      // rectifie le total au taux de TVA porté par la facture.
      return computeTvaBreakdown([
        { quantity: 1, unit_price: -Math.abs(Number(invoice.total_ht) || 0), tva_rate: sourceTvaRate },
      ]);
    }
    return computeTvaBreakdown([
      { quantity: 1, unit_price: -Math.abs(parsedAmountHt), tva_rate: tvaRate },
    ]);
  }, [mode, mirrorForbidden, netCreditLines, creditLinesPreview, invoice.total_ht, sourceTvaRate, parsedAmountHt, tvaRate]);

  /** Valeur absolue du TTC crédité — le stockage, lui, reste négatif. */
  const creditTtc = Math.abs(totals.total_ttc);
  const netDueAfter = Math.max(0, Math.round((remainingTtc - creditTtc) * 100) / 100);

  const effectiveReason = reason === 'autre' ? customReason.trim() : reason;

  const suggestedLabel = useMemo(() => {
    const label = creditReasonLabel(reason === 'autre' ? '' : reason);
    return label
      ? `${label} — facture ${invoice.invoice_number}`
      : `Avoir sur la facture ${invoice.invoice_number}`;
  }, [reason, invoice.invoice_number]);

  const effectiveLabel = customLabel.trim() || suggestedLabel;

  const validationError: string | null = useMemo(() => {
    if (loadError) return loadError;
    if (loading) return null;
    if (remainingTtc <= 0.01) {
      return `La facture ${invoice.invoice_number} est déjà intégralement créditée : aucun nouvel avoir n'est possible.`;
    }
    if (mode === 'partiel' && parsedAmountHt <= 0) {
      return 'Saisissez un montant HT supérieur à 0.';
    }
    if (creditTtc <= 0) {
      return "Le montant de l'avoir doit être supérieur à 0.";
    }
    // Tolérance d'un centime pour absorber les arrondis de TVA.
    if (creditTtc > remainingTtc + 0.01) {
      const dejaCredite = alreadyCreditedTtc < 0
        ? ` (${formatCurrency(Math.abs(alreadyCreditedTtc))} déjà crédités)`
        : '';
      return `Le cumul des avoirs ne peut pas dépasser le montant de la facture : il reste ${formatCurrency(remainingTtc)} créditables sur ${invoice.invoice_number}${dejaCredite}.`;
    }
    if (!effectiveReason) {
      return "Précisez le motif de l'avoir : il figure sur le document remis au client.";
    }
    return null;
  }, [
    loadError,
    loading,
    remainingTtc,
    mode,
    parsedAmountHt,
    creditTtc,
    alreadyCreditedTtc,
    effectiveReason,
    invoice.invoice_number,
  ]);

  const legalMention = useMemo(
    () =>
      buildCreditNoteLegalMention({
        creditedInvoiceNumber: invoice.invoice_number,
        creditedInvoiceDate: invoice.issued_at || invoice.created_at,
      }),
    [invoice.invoice_number, invoice.issued_at, invoice.created_at],
  );

  async function handleCreate() {
    if (!user || submitting || validationError) return;
    setSubmitting(true);
    setError('');

    try {
      const creditNumber = await getNextCreditNoteNumber(supabase, user.id);

      const { data: created, error: insertError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          invoice_number: creditNumber,
          invoice_type: 'avoir',
          credited_invoice_id: invoice.id,
          credit_reason: effectiveReason,
          client_id: sourceClientId,
          project_id: sourceProjectId,
          title: `Avoir sur la facture ${invoice.invoice_number}`,
          description: legalMention,
          // Montants négatifs : les agrégats de l'app sont des sommes
          // additives sur total_ttc, le signe les rend justes par défaut.
          total_ht: totals.total_ht,
          total_tva: totals.total_tva,
          total_ttc: totals.total_ttc,
          tva_rate: totals.primary_rate,
          tva_breakdown: totals.tva_breakdown,
          status: 'creee',
          issued_at: new Date().toISOString(),
          // Ni due_date ni bank_account_id : un avoir n'est jamais payable.
        })
        .select('id')
        .single();

      if (insertError || !created) {
        throw insertError || new Error("Impossible de créer l'avoir.");
      }

      const linesToInsert = (() => {
        // Solde avec acomptes : une ligne par taux de TVA, portant le net
        // réclamé. Ce sont exactement les lignes prévisualisées.
        if (mode === 'total' && mirrorForbidden) {
          return netCreditLines.map((line) => ({
            ...buildPartialCreditNoteLine({
              amountHt: line.amountHt,
              tvaRate: line.tvaRate,
              label: line.label,
              userId: user.id,
              creditNoteId: created.id,
            }),
            // Plusieurs lignes : les positions doivent rester distinctes.
            position: line.position,
          }));
        }
        if (mode === 'total' && sourceLines.length > 0) {
          return buildFullCreditNoteLines(sourceLines, user.id, created.id);
        }
        return [
          buildPartialCreditNoteLine({
            amountHt: mode === 'total' ? claimedHtValue : parsedAmountHt,
            tvaRate: mode === 'total' ? sourceTvaRate : tvaRate,
            label: mode === 'total' ? `Annulation de la facture ${invoice.invoice_number}` : effectiveLabel,
            userId: user.id,
            creditNoteId: created.id,
          }),
        ];
      })();

      const { error: linesError } = await supabase.from('invoice_lines').insert(linesToInsert);
      if (linesError) {
        // Compensation : sans ses lignes, l'avoir est un document vide qui
        // pèserait quand même sur le plafond de créditation et interdirait
        // toute nouvelle tentative sur cette facture. On le retire.
        await supabase.from('invoices').delete().eq('id', created.id);
        throw linesError;
      }

      onCreated?.(created.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la création de l'avoir.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-rose-600" />
            Créer un avoir
          </DialogTitle>
          <DialogDescription className="text-xs">
            Facture <span className="font-medium text-foreground">{invoice.invoice_number}</span> —{' '}
            {invoice.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bandeau facture rectifiée */}
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {hasDeposits ? 'Total du devis TTC' : 'Montant de la facture TTC'}
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(invoice.total_ttc)}</span>
            </div>
            {/* Une facture de solde porte le total BRUT du devis : sans ces deux
                lignes, l'artisan lit un montant qui n'a jamais été réclamé au
                client et croit à un plafonnement arbitraire. */}
            {hasDeposits && (
              <>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">dont acomptes déjà facturés</span>
                  <span className="font-semibold tabular-nums text-rose-700">
                    − {formatCurrency(depositsTtc)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Montant réclamé TTC</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(claimedTtcValue)}
                  </span>
                </div>
              </>
            )}
            {alreadyCreditedTtc < 0 && (
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Déjà crédité</span>
                <span className="font-semibold tabular-nums text-rose-700">
                  − {formatCurrency(Math.abs(alreadyCreditedTtc))}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between gap-2 border-t border-rose-200 pt-1">
              <span className="text-muted-foreground">Créditable restant TTC</span>
              <span className="font-semibold tabular-nums">{formatCurrency(remainingTtc)}</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-rose-800">
              La facture {invoice.invoice_number}
              {invoice.issued_at ? ` du ${formatDate(invoice.issued_at)}` : ''} reste inchangée :
              l&apos;avoir vient s&apos;y ajouter en négatif, comme l&apos;exige la loi.
            </p>
          </div>

          {/* Sélecteur de mode */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="total" className="flex-1">
                Avoir total
              </TabsTrigger>
              <TabsTrigger value="partiel" className="flex-1">
                Avoir partiel
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          ) : mode === 'total' ? (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {mirrorForbidden ? (
                <>
                  Les lignes de cette facture décrivent le devis entier, acomptes compris.
                  L&apos;avoir ne reprend donc pas ces lignes : il porte le montant réellement
                  réclamé après acomptes, soit {formatCurrency(claimedTtcValue)} TTC,{' '}
                  {netCreditLines.length > 1
                    ? `ventilé en ${netCreditLines.length} lignes, une par taux de TVA de la facture.`
                    : `en une ligne à la TVA ${formatTvaRate(netCreditLines[0]?.tvaRate ?? sourceTvaRate)}.`}{' '}
                  Les acomptes déjà facturés se rectifient depuis leur propre facture.
                </>
              ) : sourceLines.length > 0 ? (
                <>
                  L&apos;avoir reprend les {sourceLines.length} ligne
                  {sourceLines.length > 1 ? 's' : ''} de la facture avec les signes inversés,
                  en conservant les taux de TVA et la structure du document.
                </>
              ) : (
                <>
                  Cette facture n&apos;a pas de lignes détaillées : l&apos;avoir portera une ligne
                  unique au montant total, à la TVA {formatTvaRate(sourceTvaRate)}.
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="credit-amount" className="text-sm font-medium">
                  Montant HT à créditer
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="credit-amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={amountHt}
                    onChange={(e) => setAmountHt(e.target.value)}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                </div>
              </div>

              <div>
                <Label htmlFor="credit-tva" className="text-sm font-medium">
                  Taux de TVA à régulariser
                </Label>
                <Select value={String(tvaRate)} onValueChange={(v) => setTvaRate(Number(v))}>
                  <SelectTrigger id="credit-tva" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_TVA_RATES.map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>
                        TVA {formatTvaRate(rate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reprenez le taux appliqué sur la facture d&apos;origine, sinon la TVA
                  régularisée sera fausse.
                </p>
              </div>

              <div>
                <Label htmlFor="credit-label" className="text-sm font-medium">
                  Libellé de la ligne
                </Label>
                <Input
                  id="credit-label"
                  className="mt-1"
                  placeholder={suggestedLabel}
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                />
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  Sera enregistré comme : <span className="text-foreground">{effectiveLabel}</span>
                </p>
              </div>
            </div>
          )}

          {/* Motif */}
          <div>
            <Label htmlFor="credit-reason" className="text-sm font-medium">
              Motif de l&apos;avoir
            </Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="credit-reason" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREDIT_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason === 'autre' && (
              <Textarea
                className="mt-2 min-h-[64px]"
                placeholder="Précisez le motif (visible par le client)"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}
          </div>

          {/* Récap chiffré */}
          <div className="space-y-1 rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Montant HT</span>
              <span className="font-medium tabular-nums text-rose-700">
                {formatCurrency(totals.total_ht)}
              </span>
            </div>
            {totals.tva_breakdown.length === 0 ? (
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">TVA</span>
                <span className="font-medium tabular-nums text-rose-700">
                  {formatCurrency(0)}
                </span>
              </div>
            ) : (
              totals.tva_breakdown.map((entry) => (
                <div key={entry.rate} className="flex justify-between gap-2">
                  <span className="text-muted-foreground">TVA {formatTvaRate(entry.rate)}</span>
                  <span className="font-medium tabular-nums text-rose-700">
                    {formatCurrency(entry.tva_amount)}
                  </span>
                </div>
              ))
            )}
            <div className="mt-1 flex justify-between gap-2 border-t border-border pt-1">
              <span className="font-semibold">Total de l&apos;avoir TTC</span>
              <span className="font-semibold tabular-nums text-rose-700">
                {formatCurrency(totals.total_ttc)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Net restant dû sur la facture</span>
              <span className="font-semibold tabular-nums">{formatCurrency(netDueAfter)}</span>
            </div>
          </div>

          {/* Mention légale portée par le document */}
          <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">{legalMention}</p>
          </div>

          {validationError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {validationError}
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || loading || validationError !== null}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
              {submitting ? 'Création…' : "Créer l'avoir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
