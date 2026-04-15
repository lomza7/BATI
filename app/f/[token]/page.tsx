'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Hexagon,
  Loader as Loader2,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle,
  Clock,
  Building2,
  User,
  Shield,
  CreditCard,
  PartyPopper,
  XCircle,
  Landmark,
} from 'lucide-react';
import { parseTvaBreakdown, formatTvaRate, type TvaBreakdownEntry } from '@/lib/tva';
import { formatIban } from '@/lib/banks';
import { InsuranceFooter } from '@/components/shared/insurance-footer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

interface SendData {
  id: string;
  invoice_id: string;
  user_id: string;
  client_name: string;
  expires_at: string;
  viewed_at: string | null;
  paid_at: string | null;
  enable_stripe_payment: boolean;
}

interface InvoiceData {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  total_ht: number;
  tva_rate: number;
  total_tva: number | null;
  tva_breakdown: unknown;
  total_ttc: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  payment_method: string;
  bank_account_id: string | null;
  invoice_type: 'standard' | 'acompte' | 'solde';
  deposit_percentage: number | null;
  quote_id: string | null;
  clients: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
  } | null;
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

interface BankAccountData {
  label: string;
  bank_name: string;
  account_holder: string;
  iban: string;
  bic: string;
}

interface InvoiceLine {
  id: string;
  description: string;
  detail?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  total: number;
  position: number;
}

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

interface StripeConnection {
  charges_enabled: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

const UNIT_LABELS: Record<string, string> = {
  u: 'Unite',
  m2: 'm²',
  ml: 'ml',
  h: 'Heure',
  forfait: 'Forfait',
};

export default function PublicInvoicePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendData, setSendData] = useState<SendData | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccountData | null>(null);
  const [stripeAvailable, setStripeAvailable] = useState(false);
  const [stripeEnabledForSend, setStripeEnabledForSend] = useState(false);
  const [paying, setPaying] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [linkedDeposits, setLinkedDeposits] = useState<LinkedDeposit[]>([]);
  const [linkedQuoteNumber, setLinkedQuoteNumber] = useState<string | null>(null);

  const paymentStatus = searchParams.get('payment');

  const fetchData = useCallback(async () => {
    try {
      const { data: payload, error: rpcError } = await anonClient
        .rpc('get_public_invoice_by_token', { p_token: token });

      if (rpcError) {
        console.error('[f/token] rpc error:', rpcError);
        setError('Une erreur technique est survenue. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      if (!payload) {
        setError('Ce lien est invalide ou a expiré.');
        setLoading(false);
        return;
      }

      const send = payload.send;
      setSendData(send);
      setStripeEnabledForSend(Boolean(send.enable_stripe_payment));
      if (send.paid_at) setIsPaid(true);

      const invoiceData = payload.invoice as InvoiceData | null;
      if (invoiceData) {
        setInvoice(invoiceData);
        if (invoiceData.status === 'payee' || invoiceData.paid_at) setIsPaid(true);
      }

      if (payload.linked_quote_number) setLinkedQuoteNumber(payload.linked_quote_number);
      if (payload.linked_deposits) setLinkedDeposits(payload.linked_deposits as LinkedDeposit[]);

      setLines((payload.lines || []) as InvoiceLine[]);
      if (payload.artisan) setArtisan(payload.artisan as ArtisanProfile);
      if (payload.bank_account) setBankAccount(payload.bank_account as BankAccountData);
      if (payload.stripe_charges_enabled) setStripeAvailable(true);

      setLoading(false);
    } catch (err) {
      console.error('[f/token] unexpected error:', err);
      setError('Une erreur technique est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handlePay() {
    if (paying) return;
    setPaying(true);

    try {
      const res = await fetch('/api/stripe/connect/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setPaying(false);
      }
    } catch {
      setPaying(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-[#d35400] rounded-lg flex items-center justify-center">
            <Hexagon className="h-5 w-5 text-white animate-nut-ratchet" />
          </div>
          <p className="text-sm text-[#6b6560]">Chargement de la facture...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Lien invalide</h1>
          <p className="text-sm text-[#6b6560] mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const legacyRate = invoice.tva_rate || 20;
  const parsedBreakdown: TvaBreakdownEntry[] = parseTvaBreakdown(invoice.tva_breakdown);
  const tvaBreakdown: TvaBreakdownEntry[] = parsedBreakdown.length > 0
    ? parsedBreakdown
    : [{
        rate: legacyRate,
        base_ht: invoice.total_ht,
        tva_amount: invoice.total_ht * (legacyRate / 100),
      }];
  const totalTva = invoice.total_tva ?? tvaBreakdown.reduce((s, b) => s + b.tva_amount, 0);
  const singleRate = tvaBreakdown.length === 1 ? tvaBreakdown[0].rate : null;

  const dc = artisan?.document_config || {};
  const accent = dc.primary_color || '#d35400';
  const textColor = dc.secondary_color || '#1a1a1a';
  const logoUrl = artisan?.logo_url || '';
  const showLogo = dc.show_logo !== false;
  const showWatermark = dc.show_watermark || false;
  const footerText = dc.footer_text || '';
  const mentionsLegales = dc.mentions_legales || '';
  const companyName = artisan?.company_name || artisan?.full_name || 'Artisan';

  const fontClass = dc.font === 'serif' ? 'font-serif' : 'font-sans';

  const isDepositInvoice = invoice.invoice_type === 'acompte';
  const isFinalInvoice = invoice.invoice_type === 'solde';
  const documentLabel = isDepositInvoice
    ? "FACTURE D'ACOMPTE"
    : isFinalInvoice
      ? 'FACTURE DE SOLDE'
      : 'FACTURE';
  const depositPercentageLabel = invoice.deposit_percentage
    ? Number.isInteger(invoice.deposit_percentage)
      ? String(invoice.deposit_percentage)
      : invoice.deposit_percentage.toFixed(2).replace('.', ',')
    : null;

  // Montant à déduire (calcul au rendu pour rester cohérent si un acompte est
  // annulé après coup). Ne compte que les acomptes non annulés (déjà filtré).
  const deductedTtc = linkedDeposits.reduce((sum, d) => sum + Number(d.total_ttc || 0), 0);
  const finalRemainingTtc = Math.max(0, invoice.total_ttc - deductedTtc);
  // Montant réellement à encaisser en ligne : pour un solde c'est le reste,
  // sinon c'est le total de la facture courante.
  const payableAmount = isFinalInvoice ? finalRemainingTtc : invoice.total_ttc;

  return (
    <div className={`min-h-screen bg-[#faf9f7] ${fontClass}`}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e1da]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {showLogo && logoUrl ? (
              <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent }}>
                <Hexagon className="h-4 w-4 text-white" />
              </div>
            )}
            <span className="text-sm font-semibold" style={{ color: textColor }}>{companyName}</span>
          </div>
          {sendData && (
            <div className="flex items-center gap-2 text-xs text-[#6b6560]">
              <Clock className="h-3.5 w-3.5" />
              Facture pour {sendData.client_name}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Payment success banner */}
        {paymentStatus === 'success' && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-4 animate-fade-up">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <PartyPopper className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-800">Paiement recu !</h3>
              <p className="text-xs text-emerald-600 mt-1">
                Merci pour votre paiement. Votre facture a ete reglee avec succes.
              </p>
            </div>
          </div>
        )}

        {/* Payment cancelled banner */}
        {paymentStatus === 'cancel' && !isPaid && (
          <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-4 animate-fade-up">
            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <XCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-800">Paiement annule</h3>
              <p className="text-xs text-amber-600 mt-1">
                Le paiement a ete annule. Vous pouvez reessayer a tout moment.
              </p>
            </div>
          </div>
        )}

        {/* Paid banner */}
        {isPaid && paymentStatus !== 'success' && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-4 animate-fade-up">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-800">Facture payee</h3>
              <p className="text-xs text-emerald-600 mt-1">
                Cette facture a ete reglee{invoice.paid_at ? ` le ${formatDate(invoice.paid_at)}` : ''}.
              </p>
            </div>
          </div>
        )}

        {/* Document card */}
        <div className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden shadow-sm">
          {/* Document header — Standard */}
          <div className="p-5 sm:p-8 border-b border-[#e5e1da]">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  {showLogo && logoUrl ? (
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
                  {artisan?.company_phone && <p>Tel : {artisan.company_phone}</p>}
                  {artisan?.tva_number && <p>TVA : {artisan.tva_number}</p>}
                </div>
              </div>
              <div className="sm:text-right flex-shrink-0">
                <p className="text-2xl sm:text-3xl font-bold" style={{ color: accent }}>{documentLabel}</p>
                <p className="text-sm font-medium mt-1" style={{ color: textColor }}>{invoice.invoice_number}</p>
                {(isDepositInvoice || isFinalInvoice) && linkedQuoteNumber && (
                  <p className="text-xs mt-1" style={{ color: accent }}>
                    {isDepositInvoice
                      ? `Acompte${depositPercentageLabel ? ` ${depositPercentageLabel}%` : ''} sur devis ${linkedQuoteNumber}`
                      : `Solde du devis ${linkedQuoteNumber}`}
                  </p>
                )}
                <div className="text-xs text-[#6b6560] mt-2 space-y-0.5">
                  <p>Date : {formatDate(invoice.created_at)}</p>
                  {invoice.due_date && (
                    <p>Echeance : {formatDate(invoice.due_date)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Client info */}
          {invoice.clients && (
            <div className="px-5 sm:px-8 py-4 bg-[#faf9f7] border-b border-[#e5e1da]">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-[#6b6560]" />
                <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Client</p>
              </div>
              <p className="text-sm font-medium" style={{ color: textColor }}>{invoice.clients.name}</p>
              <div className="text-xs text-[#6b6560] mt-1 space-y-0.5">
                {invoice.clients.email && <p>{invoice.clients.email}</p>}
                {invoice.clients.phone && <p>{invoice.clients.phone}</p>}
                {invoice.clients.address && <p>{invoice.clients.address}</p>}
                {(invoice.clients.postal_code || invoice.clients.city) && (
                  <p>{[invoice.clients.postal_code, invoice.clients.city].filter(Boolean).join(' ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Invoice title */}
          <div className="px-5 sm:px-8 py-5 border-b border-[#e5e1da]">
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>{invoice.title}</h2>
          </div>

          {/* Lines — Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#e5e1da]" style={{ backgroundColor: accent + '08' }}>
                  <th className="px-8 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Description</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Qte</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Unite</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>P.U. HT</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>TVA</th>
                  <th className="px-8 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e1da]">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-8 py-3.5 text-sm" style={{ color: textColor }}>
                      {line.description}
                      {line.detail && <p className="text-xs text-[#6b6560] mt-0.5 leading-relaxed">{line.detail}</p>}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-center" style={{ color: textColor }}>{line.quantity}</td>
                    <td className="px-3 py-3.5 text-sm text-[#6b6560] text-center">{UNIT_LABELS[line.unit] || line.unit}</td>
                    <td className="px-3 py-3.5 text-sm text-right" style={{ color: textColor }}>{formatCurrency(line.unit_price)}</td>
                    <td className="px-3 py-3.5 text-xs text-center text-[#6b6560]">{formatTvaRate(line.tva_rate ?? legacyRate)}</td>
                    <td className="px-8 py-3.5 text-sm font-medium text-right" style={{ color: textColor }}>{formatCurrency(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lines — Mobile cards */}
          <div className="sm:hidden divide-y divide-[#e5e1da]">
            {lines.map((line) => (
              <div key={line.id} className="px-5 py-4">
                <p className="text-sm font-medium" style={{ color: textColor }}>{line.description}</p>
                {line.detail && <p className="text-xs text-[#6b6560] mt-0.5">{line.detail}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#6b6560]">
                    {line.quantity} {UNIT_LABELS[line.unit] || line.unit} x {formatCurrency(line.unit_price)} · TVA {formatTvaRate(line.tva_rate ?? legacyRate)}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: textColor }}>{formatCurrency(line.total)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t-2 border-[#e5e1da] px-5 sm:px-8 py-5">
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center justify-between w-full sm:w-72">
                <span className="text-sm text-[#6b6560]">Total HT</span>
                <span className="text-sm font-medium" style={{ color: textColor }}>{formatCurrency(invoice.total_ht)}</span>
              </div>
              {tvaBreakdown.length <= 1 ? (
                <div className="flex items-center justify-between w-full sm:w-72">
                  <span className="text-sm text-[#6b6560]">TVA {formatTvaRate(singleRate ?? legacyRate)}</span>
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
                <span className="text-xl font-bold" style={{ color: accent }}>{formatCurrency(invoice.total_ttc)}</span>
              </div>
            </div>
          </div>

          {/* Acomptes déduits — factures de solde uniquement */}
          {isFinalInvoice && linkedDeposits.length > 0 && (
            <div className="border-t-2 border-dashed px-5 sm:px-8 py-5" style={{ borderColor: accent + '4d' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: accent }}>
                Acomptes déjà versés
              </p>
              <div className="flex flex-col items-end gap-1.5">
                {linkedDeposits.map((d) => {
                  const dateStr = d.issued_at || d.created_at;
                  const isDepositPaid = d.status === 'payee';
                  return (
                    <div key={d.id} className="flex items-center justify-between w-full sm:w-[22rem] text-sm">
                      <span className="text-[#6b6560] truncate mr-2">
                        {d.invoice_number}
                        {dateStr && (
                          <span className="text-[11px] ml-1">({formatDate(dateStr)})</span>
                        )}
                        {!isDepositPaid && (
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

          {/* Coordonnees bancaires */}
          {bankAccount && (
            <div className="border-t border-[#e5e1da] px-5 sm:px-8 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="h-4 w-4" style={{ color: accent }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
                  Coordonnées bancaires pour le virement
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
                <p className="mt-3 text-[11px] text-[#6b6560]/70">
                  Merci d&apos;indiquer le numéro de facture <span className="font-medium">{invoice.invoice_number}</span> en référence du virement.
                </p>
              </div>
            </div>
          )}

          {/* Payment section */}
          {!isPaid && stripeAvailable && stripeEnabledForSend && payableAmount > 0 && (
            <div className="border-t-2 border-[#e5e1da] px-5 sm:px-8 py-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4 text-[#6b6560]" />
                <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-wider">
                  Paiement en ligne
                </p>
              </div>
              <p className="text-sm text-[#6b6560] mb-4">
                {isDepositInvoice
                  ? 'Réglez cet acompte en ligne de manière sécurisée pour démarrer les travaux.'
                  : 'Payez cette facture en ligne de manière sécurisée par carte bancaire, Apple Pay ou Google Pay.'}
              </p>
              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-white font-semibold text-sm px-8 py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                {paying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {paying ? 'Redirection vers Stripe...' : `Payer ${formatCurrency(payableAmount)}`}
              </button>
              <p className="text-[11px] text-[#6b6560]/60 mt-3 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Paiement securise par Stripe. Aucune donnee bancaire ne transite par cette plateforme.
              </p>
            </div>
          )}

          {/* Legal mentions */}
          <div className="border-t border-[#e5e1da] px-5 sm:px-8 py-4 bg-[#faf9f7]">
            <div className="flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-[#6b6560]/50 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-[#6b6560]/60 leading-relaxed">
                {mentionsLegales || (
                  <>
                    {invoice.due_date
                      ? `Echeance de paiement : ${formatDate(invoice.due_date)}. `
                      : ''}
                    En cas de retard de paiement, des penalites seront exigibles (taux directeur BCE + 10 points). Indemnite forfaitaire de recouvrement : 40 EUR.
                  </>
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
      </div>

      {/* Footer */}
      <footer className="border-t border-[#e5e1da] py-6 mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {showLogo && logoUrl ? (
              <img src={logoUrl} alt="" className="h-6 w-6 rounded object-cover" />
            ) : (
              <div className="h-6 w-6 rounded flex items-center justify-center" style={{ backgroundColor: accent }}>
                <Hexagon className="h-3 w-3 text-white" />
              </div>
            )}
            <span className="text-xs font-medium text-[#6b6560]">{companyName}</span>
          </div>
          {showWatermark && (
            <p className="text-xs" style={{ color: accent + '60' }}>Cree avec Hellobat</p>
          )}
        </div>
      </footer>
    </div>
  );
}
