'use client';

import React, { useEffect, useState } from 'react';
import { Hexagon, Building2, User, PenLine, Shield, X, Landmark } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { QUOTE_UNIT_LABELS } from '@/lib/constants';
import { computeTvaBreakdown, formatTvaRate } from '@/lib/tva';
import { hasSections, groupLinesBySectionAndSubsection } from '@/lib/quote-sections';
import { formatIban } from '@/lib/banks';
import { InsuranceFooter } from '@/components/shared/insurance-footer';

interface PreviewBankAccount {
  label: string;
  bank_name: string;
  account_holder: string;
  iban: string;
  bic: string;
}

interface PreviewLine {
  description: string;
  detail?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate?: number;
  section?: string | null;
  subsection?: string | null;
}

interface PreviewClient {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
}

interface LinkedDeposit {
  id: string;
  invoice_number: string;
  total_ttc: number;
  issued_at: string | null;
  created_at: string;
  status: string;
  deposit_percentage: number | null;
}

type PreviewInvoiceType = 'standard' | 'acompte' | 'solde';

interface ArtisanProfile {
  company_name: string | null;
  full_name: string | null;
  siret: string | null;
  tva_number: string | null;
  company_address: string | null;
  company_postal_code: string | null;
  company_city: string | null;
  company_phone: string | null;
  logo_url: string | null;
  insurance_company: string | null;
  insurance_address: string | null;
  insurance_coverage_zone: string | null;
  insurance_contract_number: string | null;
  insurance_warranty_type: string | null;
  document_config: {
    primary_color?: string;
    secondary_color?: string;
    font?: string;
    show_logo?: boolean;
    header_style?: string;
    show_watermark?: boolean;
    footer_text?: string;
    mentions_legales?: string;
  } | null;
}

export type DocumentPreviewMode = 'quote' | 'invoice';

interface Props {
  open: boolean;
  onClose: () => void;
  mode?: DocumentPreviewMode;
  // In-memory mode (used by the create/edit form before the row exists)
  title?: string;
  description?: string;
  lines?: PreviewLine[];
  clientId?: string | null;
  documentNumber?: string;
  validUntil?: string | null;
  dueDate?: string | null;
  bankAccountId?: string | null;
  depositPercentage?: number | null;
  // DB-load mode (used by list rows — fetches the saved quote/invoice)
  documentId?: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function DocumentPreviewDialog({
  open,
  onClose,
  mode = 'quote',
  title: titleProp,
  description: descriptionProp,
  lines: linesProp,
  clientId: clientIdProp,
  documentNumber: documentNumberProp,
  validUntil: validUntilProp,
  dueDate: dueDateProp,
  bankAccountId: bankAccountIdProp,
  depositPercentage: depositPercentageProp,
  documentId,
}: Props) {
  const { user } = useAuth();
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [client, setClient] = useState<PreviewClient | null>(null);
  const [loading, setLoading] = useState(false);

  // Resolved values — either from DB (when documentId is set) or from props.
  const [resolvedTitle, setResolvedTitle] = useState<string>(titleProp || '');
  const [resolvedDescription, setResolvedDescription] = useState<string>(descriptionProp || '');
  const [resolvedLines, setResolvedLines] = useState<PreviewLine[]>(linesProp || []);
  const [resolvedNumber, setResolvedNumber] = useState<string | undefined>(documentNumberProp);
  const [resolvedValidUntil, setResolvedValidUntil] = useState<string | null | undefined>(validUntilProp);
  const [resolvedDueDate, setResolvedDueDate] = useState<string | null | undefined>(dueDateProp);
  const [resolvedCreatedAt, setResolvedCreatedAt] = useState<Date>(new Date());
  const [bankAccount, setBankAccount] = useState<PreviewBankAccount | null>(null);

  // Facturation d'acompte — spécifiques aux invoices de type 'acompte' ou 'solde'
  const [invoiceType, setInvoiceType] = useState<PreviewInvoiceType>('standard');
  const [depositPercentage, setDepositPercentage] = useState<number | null>(null);
  const [linkedQuoteNumber, setLinkedQuoteNumber] = useState<string | null>(null);
  const [linkedDeposits, setLinkedDeposits] = useState<LinkedDeposit[]>([]);

  // PDF d'origine (devis/facture importes depuis l'ancien logiciel) — si present,
  // on l'affiche dans un iframe au lieu de reconstruire la mise en page.
  const [importPdfUrl, setImportPdfUrl] = useState<string | null>(null);

  // Keep in-memory props in sync when the dialog is used without documentId.
  useEffect(() => {
    if (documentId) return;
    setResolvedTitle(titleProp || '');
    setResolvedDescription(descriptionProp || '');
    setResolvedLines(linesProp || []);
    setResolvedNumber(documentNumberProp);
    setResolvedValidUntil(validUntilProp);
    setResolvedDueDate(dueDateProp);
    setResolvedCreatedAt(new Date());
    setInvoiceType('standard');
    setDepositPercentage(depositPercentageProp ?? null);
    setLinkedQuoteNumber(null);
    setLinkedDeposits([]);
    setImportPdfUrl(null);
  }, [documentId, titleProp, descriptionProp, linesProp, documentNumberProp, validUntilProp, dueDateProp, depositPercentageProp]);

  async function fetchImportPdfUrl(path: string): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) return null;
      const res = await fetch('/api/import/attach-pdfs/signed-url', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { url?: string };
      return json.url || null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);

      // 1. Always load the artisan profile
      const profileRes = await supabase
        .from('profiles')
        .select('company_name, full_name, siret, tva_number, company_address, company_postal_code, company_city, company_phone, logo_url, insurance_company, insurance_address, insurance_coverage_zone, insurance_contract_number, insurance_warranty_type, document_config')
        .eq('id', user!.id)
        .maybeSingle();

      if (cancelled) return;
      if (profileRes.data) setArtisan(profileRes.data as ArtisanProfile);

      // 2. Load the document + lines + client when documentId is provided
      let resolvedBankAccountId: string | null = bankAccountIdProp ?? null;
      if (documentId) {
        if (mode === 'quote') {
          const { data: quote } = await supabase
            .from('quotes')
            .select('quote_number, title, description, valid_until, created_at, client_id, bank_account_id, import_pdf_path')
            .eq('id', documentId)
            .maybeSingle();
          if (cancelled) return;
          if (quote) {
            setResolvedTitle(quote.title || '');
            setResolvedDescription(quote.description || '');
            setResolvedNumber(quote.quote_number);
            setResolvedValidUntil(quote.valid_until);
            setResolvedDueDate(null);
            setResolvedCreatedAt(new Date(quote.created_at));
            resolvedBankAccountId = quote.bank_account_id || null;
            setDepositPercentage(null);

            if (quote.import_pdf_path) {
              const url = await fetchImportPdfUrl(quote.import_pdf_path);
              if (!cancelled) setImportPdfUrl(url);
            } else if (!cancelled) {
              setImportPdfUrl(null);
            }

            const { data: linesData, error: linesErr } = await supabase
              .from('quote_lines')
              .select('description, detail, quantity, unit, unit_price, tva_rate, position, section, subsection')
              .eq('quote_id', documentId)
              .order('position', { ascending: true });
            if (linesErr) console.error('[preview] quote_lines error:', linesErr);
            console.log('[preview] quote_lines fetched for', documentId, ':', linesData?.length ?? 0, 'rows');
            if (!cancelled) {
              setResolvedLines((linesData as PreviewLine[]) || []);
            }

            if (quote.client_id) {
              const { data: clientData } = await supabase
                .from('clients')
                .select('name, email, phone, address, city, postal_code')
                .eq('id', quote.client_id)
                .maybeSingle();
              if (!cancelled && clientData) setClient(clientData as PreviewClient);
            } else if (!cancelled) {
              setClient(null);
            }
          }
        } else {
          const { data: invoice } = await supabase
            .from('invoices')
            .select('invoice_number, title, description, due_date, created_at, issued_at, client_id, bank_account_id, invoice_type, deposit_percentage, quote_id, import_pdf_path')
            .eq('id', documentId)
            .maybeSingle();
          if (cancelled) return;
          if (invoice) {
            setResolvedTitle(invoice.title || '');
            setResolvedDescription(invoice.description || '');
            setResolvedNumber(invoice.invoice_number);
            setResolvedValidUntil(null);
            setResolvedDueDate(invoice.due_date);
            setResolvedCreatedAt(new Date(invoice.issued_at || invoice.created_at));
            resolvedBankAccountId = invoice.bank_account_id || null;

            if (invoice.import_pdf_path) {
              const url = await fetchImportPdfUrl(invoice.import_pdf_path);
              if (!cancelled) setImportPdfUrl(url);
            } else if (!cancelled) {
              setImportPdfUrl(null);
            }

            const invType = (invoice.invoice_type || 'standard') as PreviewInvoiceType;
            setInvoiceType(invType);
            setDepositPercentage(
              typeof invoice.deposit_percentage === 'number' ? invoice.deposit_percentage : null,
            );

            const { data: linesData } = await supabase
              .from('invoice_lines')
              .select('description, quantity, unit, unit_price, tva_rate, position, section, subsection')
              .eq('invoice_id', documentId)
              .order('position', { ascending: true });
            if (!cancelled && linesData) {
              setResolvedLines(linesData as PreviewLine[]);
            }

            if (invoice.client_id) {
              const { data: clientData } = await supabase
                .from('clients')
                .select('name, email, phone, address, city, postal_code')
                .eq('id', invoice.client_id)
                .maybeSingle();
              if (!cancelled && clientData) setClient(clientData as PreviewClient);
            } else if (!cancelled) {
              setClient(null);
            }

            // Pour les factures d'acompte : on affiche le numéro de devis source
            if (invType === 'acompte' && invoice.quote_id) {
              const { data: srcQuote } = await supabase
                .from('quotes')
                .select('quote_number')
                .eq('id', invoice.quote_id)
                .maybeSingle();
              if (!cancelled) setLinkedQuoteNumber(srcQuote?.quote_number || null);
            } else if (!cancelled) {
              setLinkedQuoteNumber(null);
            }

            // Pour les factures de solde : on charge les acomptes déjà émis pour
            // les déduire au rendu (non stockés en DB, calcul à la lecture).
            if (invType === 'solde' && invoice.quote_id) {
              const { data: depositRows } = await supabase
                .from('invoices')
                .select('id, invoice_number, total_ttc, issued_at, created_at, status, deposit_percentage')
                .eq('quote_id', invoice.quote_id)
                .eq('invoice_type', 'acompte')
                .neq('status', 'annulee')
                .order('issued_at', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: true });
              if (!cancelled) setLinkedDeposits((depositRows || []) as LinkedDeposit[]);

              // On récupère aussi le numéro du devis pour le header/mentions
              const { data: srcQuote } = await supabase
                .from('quotes')
                .select('quote_number')
                .eq('id', invoice.quote_id)
                .maybeSingle();
              if (!cancelled) setLinkedQuoteNumber(srcQuote?.quote_number || null);
            } else if (invType !== 'acompte' && !cancelled) {
              setLinkedDeposits([]);
            }
          }
        }
      } else if (clientIdProp) {
        // In-memory mode — load the selected client if any
        const { data: clientData } = await supabase
          .from('clients')
          .select('name, email, phone, address, city, postal_code')
          .eq('id', clientIdProp)
          .maybeSingle();
        if (!cancelled && clientData) setClient(clientData as PreviewClient);
      } else if (!cancelled) {
        setClient(null);
      }

      // 3. Load the bank account (from DB documentId or from in-memory prop)
      if (resolvedBankAccountId) {
        const { data: bankData } = await supabase
          .from('bank_accounts')
          .select('label, bank_name, account_holder, iban, bic')
          .eq('id', resolvedBankAccountId)
          .maybeSingle();
        if (!cancelled) setBankAccount((bankData as PreviewBankAccount) || null);
      } else if (!cancelled) {
        setBankAccount(null);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, user, documentId, mode, clientIdProp, bankAccountIdProp]);

  // Totals computed from filled lines only (empty placeholders contribute 0
  // anyway, but filtering keeps the math explicit).
  const validLines = resolvedLines.filter((l) => l.description.trim());
  const tvaTotals = computeTvaBreakdown(
    validLines.map((l) => ({
      quantity: l.quantity,
      unit_price: l.unit_price,
      tva_rate: l.tva_rate ?? 20,
    }))
  );
  const totalHt = tvaTotals.total_ht;
  const totalTva = tvaTotals.total_tva;
  const totalTtc = tvaTotals.total_ttc;
  const tvaBreakdown = tvaTotals.tva_breakdown;
  const singleRate = tvaBreakdown.length === 1 ? tvaBreakdown[0].rate : null;
  // For grouping we keep lines that carry structure (section/subsection) even
  // when their description is empty, so an empty section the user just created
  // still shows up as a header in the preview (WYSIWYG with the editor).
  const structuredLines = resolvedLines.filter(
    (l) => l.description.trim() || l.section || l.subsection,
  );
  const showSections = hasSections(structuredLines);
  const sectionGroups = showSections ? groupLinesBySectionAndSubsection(structuredLines) : null;

  const dc = artisan?.document_config || {};
  const accent = dc.primary_color || '#d35400';
  const textColor = dc.secondary_color || '#1a1a1a';
  const logoUrl = artisan?.logo_url || '';
  const showLogo = dc.show_logo !== false;
  const headerStyle = dc.header_style || 'standard';
  const showWatermark = dc.show_watermark || false;
  const footerText = dc.footer_text || '';
  const mentionsLegales = dc.mentions_legales || '';
  const companyName = artisan?.company_name || artisan?.full_name || 'Artisan';
  const fontClass = dc.font === 'serif' ? 'font-serif' : 'font-sans';

  const isInvoice = mode === 'invoice';
  const isDepositInvoice = isInvoice && invoiceType === 'acompte';
  const isFinalInvoice = isInvoice && invoiceType === 'solde';
  const documentLabel = isInvoice
    ? isDepositInvoice
      ? "FACTURE D'ACOMPTE"
      : isFinalInvoice
        ? 'FACTURE DE SOLDE'
        : 'FACTURE'
    : 'DEVIS';
  const fallbackNumber = isInvoice ? 'F-AAAA-XXX' : 'D-AAAA-XXX';
  const titlePlaceholder = isInvoice ? 'Titre de la facture' : 'Titre du devis';
  const displayNumber = resolvedNumber || fallbackNumber;

  // Montant total des acomptes à déduire (calcul au rendu pour rester cohérent
  // si un acompte est annulé après émission du solde).
  const deductedTtc = linkedDeposits.reduce((sum, d) => sum + Number(d.total_ttc || 0), 0);
  const finalRemainingTtc = Math.max(0, totalTtc - deductedTtc);

  // Si un PDF d'origine est attache (document importe depuis l'ancien logiciel),
  // on l'affiche tel quel dans un iframe plutot que de reconstruire la mise en
  // page a partir de lignes inexistantes en DB.
  if (importPdfUrl) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 gap-0 bg-[#faf9f7] flex flex-col">
          <DialogTitle className="sr-only">
            {isInvoice ? 'Aperçu de la facture' : 'Aperçu du devis'}
          </DialogTitle>
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#e5e1da]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span className="text-xs font-medium text-[#6b6560] truncate">
                PDF d&apos;origine — {documentLabel.toLowerCase()} importé{!isInvoice ? '' : 'e'} {displayNumber}
              </span>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6b6560] hover:bg-[#f5f3f0] transition-colors flex-shrink-0"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <iframe
            src={importPdfUrl}
            title={`${documentLabel} ${displayNumber}`}
            className="flex-1 w-full border-0 bg-white"
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-[#faf9f7]">
        <DialogTitle className="sr-only">
          {isInvoice ? 'Aperçu de la facture' : 'Aperçu du devis'}
        </DialogTitle>

        {/* Header preview bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-md border-b border-[#e5e1da]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs font-medium text-[#6b6560]">
              Aperçu — tel que le client le verra
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#6b6560] hover:bg-[#f5f3f0] transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className={`px-4 sm:px-6 py-6 ${fontClass}`}>
          {/* Document card */}
          <div className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden shadow-sm">
            {/* Document header */}
            {headerStyle === 'banner' ? (
              <div className="p-5 sm:p-8" style={{ backgroundColor: accent }}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {showLogo && logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-base font-semibold text-white">{companyName}</p>
                      {artisan?.siret && <p className="text-xs text-white/70">SIRET : {artisan.siret}</p>}
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-2xl sm:text-3xl font-bold text-white">{documentLabel}</p>
                    <p className="text-sm font-medium text-white/80 mt-1">{displayNumber}</p>
                    {(isDepositInvoice || isFinalInvoice) && linkedQuoteNumber && (
                      <p className="text-xs text-white/70 mt-1">
                        {isDepositInvoice
                          ? `Acompte${depositPercentage ? ` ${Number.isInteger(depositPercentage) ? depositPercentage : depositPercentage.toFixed(2).replace('.', ',')}%` : ''} sur devis ${linkedQuoteNumber}`
                          : `Solde du devis ${linkedQuoteNumber}`}
                      </p>
                    )}
                    <p className="text-xs text-white/60 mt-1">Date : {formatDate(resolvedCreatedAt)}</p>
                  </div>
                </div>
              </div>
            ) : headerStyle === 'compact' ? (
              <div className="px-5 sm:px-8 py-3 border-b border-[#e5e1da] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-3">
                  {showLogo && logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  ) : null}
                  <span className="text-sm font-semibold" style={{ color: textColor }}>{companyName}</span>
                  {artisan?.siret && <span className="text-xs text-[#6b6560]">SIRET {artisan.siret}</span>}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-lg font-bold" style={{ color: accent }}>{documentLabel}</span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>{displayNumber}</span>
                  {(isDepositInvoice || isFinalInvoice) && linkedQuoteNumber && (
                    <span className="text-xs text-[#6b6560]">
                      {isDepositInvoice
                        ? `Acompte${depositPercentage ? ` ${Number.isInteger(depositPercentage) ? depositPercentage : depositPercentage.toFixed(2).replace('.', ',')}%` : ''} / ${linkedQuoteNumber}`
                        : `Solde / ${linkedQuoteNumber}`}
                    </span>
                  )}
                  <span className="text-xs text-[#6b6560]">{formatDate(resolvedCreatedAt)}</span>
                </div>
              </div>
            ) : (
              <div className="p-5 sm:p-8 border-b border-[#e5e1da]">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      {showLogo && logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent + '15' }}>
                          <Building2 className="h-5 w-5" style={{ color: accent }} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-base font-semibold truncate" style={{ color: textColor }}>
                          {companyName}
                        </p>
                        {artisan?.siret && (
                          <p className="text-xs text-[#6b6560]">SIRET : {artisan.siret}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-[#6b6560] space-y-0.5 pl-[52px]">
                      {artisan?.company_address && <p>{artisan.company_address}</p>}
                      {(artisan?.company_postal_code || artisan?.company_city) && (
                        <p>{[artisan.company_postal_code, artisan.company_city].filter(Boolean).join(' ')}</p>
                      )}
                      {artisan?.company_phone && <p>Tél : {artisan.company_phone}</p>}
                      {artisan?.tva_number && <p>TVA : {artisan.tva_number}</p>}
                    </div>
                  </div>
                  <div className="sm:text-right flex-shrink-0">
                    <p className="text-2xl sm:text-3xl font-bold" style={{ color: accent }}>{documentLabel}</p>
                    <p className="text-sm font-medium mt-1" style={{ color: textColor }}>{displayNumber}</p>
                    {(isDepositInvoice || isFinalInvoice) && linkedQuoteNumber && (
                      <p className="text-xs mt-1" style={{ color: accent }}>
                        {isDepositInvoice
                          ? `Acompte${depositPercentage ? ` ${Number.isInteger(depositPercentage) ? depositPercentage : depositPercentage.toFixed(2).replace('.', ',')}%` : ''} sur devis ${linkedQuoteNumber}`
                          : `Solde du devis ${linkedQuoteNumber}`}
                      </p>
                    )}
                    <div className="text-xs text-[#6b6560] mt-2 space-y-0.5">
                      <p>Date : {formatDate(resolvedCreatedAt)}</p>
                      {isInvoice ? (
                        resolvedDueDate && <p>Échéance : {formatDate(resolvedDueDate)}</p>
                      ) : (
                        resolvedValidUntil && <p>Valable jusqu&apos;au : {formatDate(resolvedValidUntil)}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {headerStyle === 'compact' && (
              <div className="h-0.5" style={{ backgroundColor: accent }} />
            )}

            {/* Artisan details for banner/compact */}
            {headerStyle !== 'standard' && (artisan?.company_address || artisan?.company_phone || artisan?.tva_number) && (
              <div className="px-5 sm:px-8 py-3 border-b border-[#e5e1da] text-xs text-[#6b6560] flex flex-wrap gap-x-4 gap-y-0.5">
                {artisan?.company_address && <span>{artisan.company_address}, {artisan?.company_postal_code} {artisan?.company_city}</span>}
                {artisan?.company_phone && <span>Tél : {artisan.company_phone}</span>}
                {artisan?.tva_number && <span>TVA : {artisan.tva_number}</span>}
              </div>
            )}

            {/* Client info */}
            {client ? (
              <div className="px-5 sm:px-8 py-4 bg-[#faf9f7] border-b border-[#e5e1da]">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-[#6b6560]" />
                  <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Client</p>
                </div>
                <p className="text-sm font-medium" style={{ color: textColor }}>{client.name}</p>
                <div className="text-xs text-[#6b6560] mt-1 space-y-0.5">
                  {client.email && <p>{client.email}</p>}
                  {client.phone && <p>{client.phone}</p>}
                  {client.address && <p>{client.address}</p>}
                  {(client.postal_code || client.city) && (
                    <p>{[client.postal_code, client.city].filter(Boolean).join(' ')}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-5 sm:px-8 py-4 bg-amber-50/50 border-b border-[#e5e1da]">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-600" />
                  <p className="text-xs text-amber-700">
                    Aucun client sélectionné — les coordonnées du client apparaîtront ici.
                  </p>
                </div>
              </div>
            )}

            {/* Titre + description */}
            <div className="px-5 sm:px-8 py-5 border-b border-[#e5e1da]">
              <h2 className="text-lg font-semibold" style={{ color: textColor }}>
                {resolvedTitle || <span className="text-[#6b6560] font-normal italic">{titlePlaceholder}</span>}
              </h2>
              {resolvedDescription && (
                <p className="text-sm text-[#6b6560] mt-1 leading-relaxed whitespace-pre-wrap">{resolvedDescription}</p>
              )}
            </div>

            {/* Lignes — Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e1da]" style={{ backgroundColor: accent + '08' }}>
                    <th className="px-8 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Description</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Qté</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Unité</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>P.U. HT</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>TVA</th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Total HT</th>
                    <th className="px-8 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Total TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e1da]">
                  {structuredLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-8 py-8 text-center text-sm text-[#6b6560] italic">
                        Aucune ligne saisie
                      </td>
                    </tr>
                  ) : sectionGroups ? (
                    sectionGroups.map((group, gIdx) => (
                      <React.Fragment key={`g-${gIdx}-${group.sectionKey ?? '_flat'}`}>
                        <tr style={{ backgroundColor: accent + '0a' }}>
                          <td colSpan={5} className="px-8 py-2.5 text-sm font-semibold" style={{ color: accent }}>
                            {group.label}
                          </td>
                          <td className="px-3 py-2.5 text-sm font-semibold text-right" style={{ color: accent }}>
                            {formatCurrency(group.subtotalHt)}
                          </td>
                          <td className="px-8 py-2.5 text-sm font-semibold text-right" style={{ color: accent }}>
                            {formatCurrency(group.subtotalTtc)}
                          </td>
                        </tr>
                        {group.subsections.map((sub, sIdx) => (
                          <React.Fragment key={`s-${sIdx}-${sub.subsectionKey ?? '_nosub'}`}>
                            {sub.subsectionKey && (
                              <tr style={{ backgroundColor: accent + '05' }}>
                                <td colSpan={5} className="px-8 py-1.5 text-xs font-medium pl-12" style={{ color: accent }}>
                                  {sub.label}
                                </td>
                                <td className="px-3 py-1.5 text-xs font-medium text-right" style={{ color: accent }}>
                                  {formatCurrency(sub.subtotalHt)}
                                </td>
                                <td className="px-8 py-1.5 text-xs font-medium text-right" style={{ color: accent }}>
                                  {formatCurrency(sub.subtotalTtc)}
                                </td>
                              </tr>
                            )}
                            {sub.lines.filter((l) => l.description.trim()).map((line, idx) => (
                              <tr key={idx}>
                                <td className={`py-3.5 text-sm ${sub.subsectionKey ? 'pl-16 px-8' : 'px-8 pl-10'}`} style={{ color: textColor }}>
                                  {line.description}
                                  {line.detail && <p className="text-xs text-[#6b6560] mt-0.5 leading-relaxed whitespace-pre-wrap">{line.detail}</p>}
                                </td>
                                <td className="px-3 py-3.5 text-sm text-center" style={{ color: textColor }}>{line.quantity}</td>
                                <td className="px-3 py-3.5 text-sm text-[#6b6560] text-center">{QUOTE_UNIT_LABELS[line.unit] || line.unit}</td>
                                <td className="px-3 py-3.5 text-sm text-right" style={{ color: textColor }}>{formatCurrency(line.unit_price)}</td>
                                <td className="px-3 py-3.5 text-xs text-center text-[#6b6560]">{formatTvaRate(line.tva_rate ?? 20)}</td>
                                <td className="px-3 py-3.5 text-sm text-right" style={{ color: textColor }}>{formatCurrency(line.quantity * line.unit_price)}</td>
                                <td className="px-8 py-3.5 text-sm font-medium text-right" style={{ color: textColor }}>{formatCurrency(line.quantity * line.unit_price * (1 + (line.tva_rate ?? 20) / 100))}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    ))
                  ) : (
                    validLines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-8 py-3.5 text-sm" style={{ color: textColor }}>
                          {line.description}
                          {line.detail && <p className="text-xs text-[#6b6560] mt-0.5 leading-relaxed whitespace-pre-wrap">{line.detail}</p>}
                        </td>
                        <td className="px-3 py-3.5 text-sm text-center" style={{ color: textColor }}>{line.quantity}</td>
                        <td className="px-3 py-3.5 text-sm text-[#6b6560] text-center">{QUOTE_UNIT_LABELS[line.unit] || line.unit}</td>
                        <td className="px-3 py-3.5 text-sm text-right" style={{ color: textColor }}>{formatCurrency(line.unit_price)}</td>
                        <td className="px-3 py-3.5 text-xs text-center text-[#6b6560]">{formatTvaRate(line.tva_rate ?? 20)}</td>
                        <td className="px-3 py-3.5 text-sm text-right" style={{ color: textColor }}>{formatCurrency(line.quantity * line.unit_price)}</td>
                        <td className="px-8 py-3.5 text-sm font-medium text-right" style={{ color: textColor }}>{formatCurrency(line.quantity * line.unit_price * (1 + (line.tva_rate ?? 20) / 100))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Lignes — Mobile */}
            <div className="sm:hidden divide-y divide-[#e5e1da]">
              {structuredLines.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[#6b6560] italic">
                  Aucune ligne saisie
                </div>
              ) : sectionGroups ? (
                sectionGroups.map((group, gIdx) => (
                  <React.Fragment key={`g-${gIdx}-${group.sectionKey ?? '_flat'}`}>
                    <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: accent + '0a' }}>
                      <span className="text-sm font-semibold" style={{ color: accent }}>{group.label}</span>
                      <div className="flex flex-col items-end leading-tight">
                        <span className="text-[11px] font-medium text-[#6b6560]">{formatCurrency(group.subtotalHt)} HT</span>
                        <span className="text-sm font-semibold" style={{ color: accent }}>{formatCurrency(group.subtotalTtc)} TTC</span>
                      </div>
                    </div>
                    {group.subsections.map((sub, sIdx) => (
                      <React.Fragment key={`s-${sIdx}-${sub.subsectionKey ?? '_nosub'}`}>
                        {sub.subsectionKey && (
                          <div className="px-5 py-2 pl-8 flex items-center justify-between gap-3" style={{ backgroundColor: accent + '05' }}>
                            <span className="text-xs font-medium" style={{ color: accent }}>{sub.label}</span>
                            <span className="text-[11px]" style={{ color: accent }}>
                              {formatCurrency(sub.subtotalHt)} HT · {formatCurrency(sub.subtotalTtc)} TTC
                            </span>
                          </div>
                        )}
                        {sub.lines.filter((l) => l.description.trim()).map((line, idx) => (
                          <div key={idx} className={`px-5 py-4 ${sub.subsectionKey ? 'pl-8' : ''}`}>
                            <p className="text-sm font-medium" style={{ color: textColor }}>{line.description}</p>
                            {line.detail && <p className="text-xs text-[#6b6560] mt-0.5 whitespace-pre-wrap">{line.detail}</p>}
                            <div className="flex items-start justify-between gap-3 mt-2">
                              <span className="text-xs text-[#6b6560] flex-1 min-w-0">
                                {line.quantity} {QUOTE_UNIT_LABELS[line.unit] || line.unit} × {formatCurrency(line.unit_price)} · TVA {formatTvaRate(line.tva_rate ?? 20)}
                              </span>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs text-[#6b6560]">{formatCurrency(line.quantity * line.unit_price)} HT</p>
                                <p className="text-sm font-semibold" style={{ color: textColor }}>{formatCurrency(line.quantity * line.unit_price * (1 + (line.tva_rate ?? 20) / 100))} TTC</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                validLines.map((line, idx) => (
                  <div key={idx} className="px-5 py-4">
                    <p className="text-sm font-medium" style={{ color: textColor }}>{line.description}</p>
                    {line.detail && <p className="text-xs text-[#6b6560] mt-0.5 whitespace-pre-wrap">{line.detail}</p>}
                    <div className="flex items-start justify-between gap-3 mt-2">
                      <span className="text-xs text-[#6b6560] flex-1 min-w-0">
                        {line.quantity} {QUOTE_UNIT_LABELS[line.unit] || line.unit} × {formatCurrency(line.unit_price)} · TVA {formatTvaRate(line.tva_rate ?? 20)}
                      </span>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-[#6b6560]">{formatCurrency(line.quantity * line.unit_price)} HT</p>
                        <p className="text-sm font-semibold" style={{ color: textColor }}>{formatCurrency(line.quantity * line.unit_price * (1 + (line.tva_rate ?? 20) / 100))} TTC</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totaux */}
            <div className="border-t-2 border-[#e5e1da] px-5 sm:px-8 py-5">
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center justify-between w-full sm:w-72">
                  <span className="text-sm text-[#6b6560]">Total HT</span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>{formatCurrency(totalHt)}</span>
                </div>
                {tvaBreakdown.length <= 1 ? (
                  <div className="flex items-center justify-between w-full sm:w-72">
                    <span className="text-sm text-[#6b6560]">
                      TVA {formatTvaRate(singleRate ?? 20)}
                    </span>
                    <span className="text-sm font-medium" style={{ color: textColor }}>{formatCurrency(totalTva)}</span>
                  </div>
                ) : (
                  <>
                    {tvaBreakdown.map((b) => (
                      <div key={b.rate} className="flex items-center justify-between w-full sm:w-72 text-xs">
                        <span className="text-[#6b6560]">
                          TVA {formatTvaRate(b.rate)} sur {formatCurrency(b.base_ht)}
                        </span>
                        <span style={{ color: textColor }}>{formatCurrency(b.tva_amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between w-full sm:w-72 pt-1 border-t border-dashed border-[#e5e1da]/70">
                      <span className="text-sm text-[#6b6560]">Total TVA</span>
                      <span className="text-sm font-medium" style={{ color: textColor }}>{formatCurrency(totalTva)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between w-full sm:w-72 pt-2 border-t border-[#e5e1da] mt-1">
                  <span className="text-base font-semibold" style={{ color: textColor }}>Total TTC</span>
                  <span className="text-xl font-bold" style={{ color: accent }}>{formatCurrency(totalTtc)}</span>
                </div>
                {mode === 'quote' && depositPercentage && depositPercentage > 0 && (
                  <div className="flex flex-col items-end gap-0.5 w-full sm:w-72 pt-2 mt-1 border-t border-dashed border-[#e5e1da]/70">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-medium" style={{ color: accent }}>
                        Acompte de {Number.isInteger(depositPercentage) ? depositPercentage : depositPercentage.toFixed(2).replace('.', ',')}% à la signature
                      </span>
                      <span className="text-sm font-semibold" style={{ color: accent }}>
                        {formatCurrency(Math.round(totalTtc * depositPercentage) / 100)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Acomptes déduits — pour les factures de solde uniquement */}
            {isFinalInvoice && linkedDeposits.length > 0 && (
              <div className="border-t-2 border-dashed px-5 sm:px-8 py-5" style={{ borderColor: accent + '4d' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: accent }}>
                  Acomptes déjà versés
                </p>
                <div className="flex flex-col items-end gap-1.5">
                  {linkedDeposits.map((d) => {
                    const dateStr = d.issued_at || d.created_at;
                    const isPaid = d.status === 'payee';
                    return (
                      <div key={d.id} className="flex items-center justify-between w-full sm:w-[22rem] text-sm">
                        <span className="text-[#6b6560] truncate mr-2">
                          {d.invoice_number}
                          {dateStr && (
                            <span className="text-[11px] ml-1">({formatDate(dateStr)})</span>
                          )}
                          {!isPaid && (
                            <span className="ml-1.5 text-[10px] text-amber-700 uppercase tracking-wide">
                              non payé
                            </span>
                          )}
                        </span>
                        <span className="font-medium tabular-nums" style={{ color: textColor }}>
                          − {formatCurrency(Number(d.total_ttc))}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between w-full sm:w-[22rem] pt-2 border-t border-dashed border-[#e5e1da] mt-1">
                    <span className="text-sm text-[#6b6560]">Total déduit</span>
                    <span className="text-sm font-medium tabular-nums" style={{ color: textColor }}>
                      − {formatCurrency(deductedTtc)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between w-full sm:w-[22rem] pt-2 border-t-2 mt-1" style={{ borderColor: accent }}>
                    <span className="text-base font-semibold" style={{ color: textColor }}>
                      Reste à payer
                    </span>
                    <span className="text-xl font-bold tabular-nums" style={{ color: accent }}>
                      {formatCurrency(finalRemainingTtc)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Coordonnées bancaires */}
            {bankAccount && (
              <div className="border-t border-[#e5e1da] px-5 sm:px-8 py-5">
                <div className="flex items-center gap-2 mb-3">
                  <Landmark className="h-4 w-4" style={{ color: accent }} />
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
                    {isInvoice ? 'Coordonnées bancaires pour le paiement' : 'Règlement par virement'}
                  </p>
                </div>
                <div className="rounded-xl border border-[#e5e1da] bg-[#faf9f7] p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-[#6b6560]">Titulaire</p>
                      <p className="text-sm font-medium" style={{ color: textColor }}>{bankAccount.account_holder}</p>
                      <p className="mt-2 text-xs text-[#6b6560]">Banque</p>
                      <p className="text-sm" style={{ color: textColor }}>{bankAccount.bank_name}</p>
                    </div>
                    <div className="min-w-0 flex-1 sm:text-right">
                      <p className="text-xs text-[#6b6560]">IBAN</p>
                      <p className="font-mono text-[13px] tracking-wide" style={{ color: textColor }}>
                        {formatIban(bankAccount.iban)}
                      </p>
                      <p className="mt-2 text-xs text-[#6b6560]">BIC</p>
                      <p className="font-mono text-[13px]" style={{ color: textColor }}>{bankAccount.bic}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Signature placeholder — quotes only */}
            {!isInvoice && (
              <div className="border-t-2 border-[#e5e1da] px-5 sm:px-8 py-6">
                <div className="flex items-center gap-2 mb-3">
                  <PenLine className="h-4 w-4 text-[#6b6560]" />
                  <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-wider">
                    Signature électronique
                  </p>
                </div>
                <div className="rounded-xl border border-dashed border-[#e5e1da] bg-[#faf9f7] py-8 text-center">
                  <p className="text-xs text-[#6b6560]">
                    Le client signera ici depuis le lien sécurisé envoyé par email.
                  </p>
                </div>
              </div>
            )}

            {/* Legal mentions */}
            <div className="border-t border-[#e5e1da] px-5 sm:px-8 py-4 bg-[#faf9f7]">
              <div className="flex items-start gap-2">
                <Shield className="h-3.5 w-3.5 text-[#6b6560]/50 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-[#6b6560]/60 leading-relaxed">
                  {mentionsLegales || (
                    isInvoice ? (
                      <>
                        {isDepositInvoice ? 'Facture d\u2019acompte' : isFinalInvoice ? 'Facture de solde' : 'Facture'} émise le {formatDate(resolvedCreatedAt)}
                        {resolvedDueDate ? `, à régler avant le ${formatDate(resolvedDueDate)}` : ''}.
                        {tvaBreakdown.length <= 1
                          ? ` TVA applicable au taux de ${formatTvaRate(singleRate ?? 20)}.`
                          : ` TVA applicable selon plusieurs taux : ${tvaBreakdown.map(b => formatTvaRate(b.rate)).join(', ')}.`}
                        {' '}Tout retard de paiement entraîne
                        l&apos;application de pénalités de retard conformément aux conditions générales.
                      </>
                    ) : (
                      <>
                        {resolvedValidUntil
                          ? `Devis valable jusqu'au ${formatDate(resolvedValidUntil)}. `
                          : ''}
                        Signature électronique réalisée au sens du règlement européen eIDAS.
                        Ce document a valeur contractuelle entre les parties.
                      </>
                    )
                  )}
                </p>
              </div>
              {isDepositInvoice && (
                <p className="text-[11px] text-[#6b6560]/60 leading-relaxed mt-1.5 pl-5 italic">
                  TVA exigible à l&apos;encaissement conformément à l&apos;article 269-2 du CGI.
                </p>
              )}
              <InsuranceFooter insurance={artisan} />
              {footerText && (
                <p className="text-[11px] text-[#6b6560]/80 mt-2 text-center font-medium">{footerText}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 px-2">
            <div className="flex items-center gap-2">
              {showLogo && logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <div className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: accent }}>
                  <Hexagon className="h-3 w-3 text-white" />
                </div>
              )}
              <span className="text-xs font-medium text-[#6b6560]">{companyName}</span>
            </div>
            {showWatermark && (
              <p className="text-xs" style={{ color: accent + '60' }}>Créé avec Hellobat</p>
            )}
          </div>

          {loading && (
            <p className="text-[10px] text-[#6b6560]/60 text-center mt-3">Chargement des coordonnées...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
