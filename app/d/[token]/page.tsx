'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Hexagon,
  Loader as Loader2,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle,
  Clock,
  Calendar,
  Building2,
  User,
  PenLine,
  Shield,
  Download,
  Landmark,
} from 'lucide-react';
import { SignatureCanvas } from '@/components/devis/signature-canvas';
import { DocusealSigning } from '@/components/devis/docuseal-signing';
import { InsuranceFooter } from '@/components/shared/insurance-footer';
import { parseTvaBreakdown, formatTvaRate, type TvaBreakdownEntry } from '@/lib/tva';
import { formatIban } from '@/lib/banks';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

interface SendData {
  id: string;
  quote_id: string;
  client_name: string;
  expires_at: string;
  signed_at: string | null;
  signature_url: string;
  docuseal_slug: string | null;
  docuseal_submission_id: number | null;
  docuseal_certificate_url: string | null;
  docuseal_audit_log_url: string | null;
  docuseal_signed_document_url: string | null;
}

interface QuoteData {
  id: string;
  quote_number: string;
  title: string;
  description: string;
  status: string;
  total_ht: number;
  tva_rate: number;
  total_tva: number | null;
  tva_breakdown: unknown;
  total_ttc: number;
  valid_until: string | null;
  signed_at: string | null;
  created_at: string;
  bank_account_id: string | null;
  clients: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
  } | null;
}

interface BankAccountData {
  label: string;
  bank_name: string;
  account_holder: string;
  iban: string;
  bic: string;
}

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
    template?: string;
  } | null;
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

export default function PublicQuotePage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendData, setSendData] = useState<SendData | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [bankAccount, setBankAccount] = useState<BankAccountData | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signatureDisplayUrl, setSignatureDisplayUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // 1. Fetch send by token
      const { data: send, error: sendError } = await anonClient
        .from('quote_sends')
        .select('id, quote_id, client_name, expires_at, signed_at, signature_url, docuseal_slug, docuseal_submission_id, docuseal_certificate_url, docuseal_audit_log_url, docuseal_signed_document_url')
        .eq('token', token)
        .maybeSingle();

      if (sendError) {
        console.error('[d/token] quote_sends fetch error:', sendError);
        setError('Une erreur technique est survenue. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      if (!send) {
        setError('Ce lien est invalide ou a expiré.');
        setLoading(false);
        return;
      }

      if (new Date(send.expires_at) < new Date()) {
        setError('Ce lien a expiré. Contactez votre artisan pour obtenir un nouveau lien.');
        setLoading(false);
        return;
      }

      setSendData(send);

      // Deja signe ?
      if (send.signed_at) {
        setSigned(true);
        setSignedAt(send.signed_at);
        if (send.signature_url) {
          setSignatureDisplayUrl(send.signature_url);
        }
      }

      // Mark viewed_at + log view (non-blocking, ne doit pas bloquer le chargement)
      anonClient
        .from('quote_sends')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', send.id)
        .is('viewed_at', null)
        .then(({ error }) => { if (error) console.warn('[d/token] viewed_at update:', error.message); });

      anonClient.from('quote_send_views').insert({
        send_id: send.id,
        user_agent: navigator.userAgent,
      }).then(({ error }) => { if (error) console.warn('[d/token] view log:', error.message); });

      // 2. Fetch quote with client
      const { data: quoteData, error: quoteError } = await anonClient
        .from('quotes')
        .select('id, quote_number, title, description, status, total_ht, tva_rate, total_tva, tva_breakdown, total_ttc, valid_until, signed_at, created_at, bank_account_id, clients(name, email, phone, address, city, postal_code)')
        .eq('id', send.quote_id)
        .is('deleted_at', null)
        .maybeSingle();

      if (quoteError) {
        console.error('[d/token] quotes fetch error:', quoteError);
        setError('Une erreur technique est survenue. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      if (!quoteData) {
        setError("Ce devis n'est plus disponible.");
        setLoading(false);
        return;
      }

      setQuote(quoteData as unknown as QuoteData);

      // 3. Fetch quote lines
      const { data: linesData } = await anonClient
        .from('quote_lines')
        .select('id, description, quantity, unit, unit_price, tva_rate, total, position')
        .eq('quote_id', send.quote_id)
        .order('position');

      if (linesData) {
        setLines(linesData as QuoteLine[]);
      }

      // 4. Fetch artisan profile via user_id from quote
      const { data: sendFull } = await anonClient
        .from('quote_sends')
        .select('user_id')
        .eq('id', send.id)
        .single();

      if (sendFull?.user_id) {
        const { data: profile } = await anonClient
          .from('profiles')
          .select('company_name, full_name, siret, tva_number, company_address, company_postal_code, company_city, company_phone, logo_url, insurance_company, insurance_address, insurance_coverage_zone, insurance_contract_number, insurance_warranty_type, document_config')
          .eq('id', sendFull.user_id)
          .maybeSingle();

        if (profile) {
          setArtisan(profile as ArtisanProfile);
        }
      }

      // 5. Fetch bank account if attached to the quote
      const quoteBankId = (quoteData as unknown as QuoteData).bank_account_id;
      if (quoteBankId) {
        const { data: bankData } = await anonClient
          .from('bank_accounts')
          .select('label, bank_name, account_holder, iban, bic')
          .eq('id', quoteBankId)
          .maybeSingle();
        if (bankData) setBankAccount(bankData as BankAccountData);
      }

      setLoading(false);
    } catch (err) {
      console.error('[d/token] unexpected error:', err);
      setError('Une erreur technique est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSign(dataUrl: string) {
    if (!sendData || signing) return;
    setSigning(true);

    // Convert data URL to blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    // Upload to Supabase Storage
    const filePath = `${sendData.id}.png`;
    const { error: uploadError } = await anonClient.storage
      .from('signatures')
      .upload(filePath, blob, { contentType: 'image/png', upsert: true });

    if (uploadError) {
      setSigning(false);
      return;
    }

    // Get public URL
    const { data: urlData } = anonClient.storage.from('signatures').getPublicUrl(filePath);
    const signatureUrl = urlData.publicUrl;

    // Call RPC
    const { data: result } = await anonClient.rpc('sign_quote', {
      p_token: token,
      p_signature_url: signatureUrl,
      p_signer_user_agent: navigator.userAgent,
    });

    if (result?.success) {
      setSigned(true);
      setSignedAt(new Date().toISOString());
      setSignatureDisplayUrl(signatureUrl);
    }

    setSigning(false);
  }

  async function handleDocuSealComplete() {
    setSigned(true);
    setSignedAt(new Date().toISOString());

    // Appeler le sync comme fallback au webhook
    if (sendData?.docuseal_submission_id) {
      fetch('/api/docuseal/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: sendData.docuseal_submission_id }),
      }).catch(() => {});
    }

    // Poll pour recuperer l'URL du document signe
    // On appelle sync-status à chaque iteration pour que l'URL en DB
    // soit rafraîchie avec la version contenant la signature incrustée
    // (le webhook stocke parfois une URL avant que le PDF soit finalisé).
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      if (attempts > 20) { clearInterval(poll); return; }
      // Re-sync depuis DocuSeal pour mettre à jour l'URL en DB
      if (sendData?.docuseal_submission_id) {
        await fetch('/api/docuseal/sync-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submission_id: sendData.docuseal_submission_id }),
        }).catch(() => {});
      }
      const { data: fresh } = await anonClient
        .from('quote_sends')
        .select('docuseal_signed_document_url, docuseal_audit_log_url, docuseal_certificate_url')
        .eq('token', token)
        .maybeSingle();
      if (fresh?.docuseal_signed_document_url) {
        setSendData(prev => prev ? { ...prev, ...fresh } : prev);
        clearInterval(poll);
      }
    }, 3000);
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-[#d35400] rounded-lg flex items-center justify-center">
            <Hexagon className="h-5 w-5 text-white animate-nut-ratchet" />
          </div>
          <p className="text-sm text-[#6b6560]">Chargement du devis...</p>
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

  if (!quote) return null;

  const legacyRate = quote.tva_rate || 20;
  const parsedBreakdown: TvaBreakdownEntry[] = parseTvaBreakdown(quote.tva_breakdown);
  const tvaBreakdown: TvaBreakdownEntry[] = parsedBreakdown.length > 0
    ? parsedBreakdown
    : [{
        rate: legacyRate,
        base_ht: quote.total_ht,
        tva_amount: quote.total_ht * (legacyRate / 100),
      }];
  const totalTva = quote.total_tva ?? tvaBreakdown.reduce((s, b) => s + b.tva_amount, 0);
  const singleRate = tvaBreakdown.length === 1 ? tvaBreakdown[0].rate : null;

  // Document template config from artisan profile
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
              Devis pour {sendData.client_name}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Signed banner */}
        {signed && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-4 animate-fade-up">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-800">Devis signe</h3>
              <p className="text-xs text-emerald-600 mt-1">
                Ce devis a ete signe electroniquement le {signedAt ? formatDate(signedAt) : ''}.
              </p>
            </div>
          </div>
        )}

        {/* Document card */}
        <div className="bg-white rounded-2xl border border-[#e5e1da] overflow-hidden shadow-sm">
          {/* Document header — Banner style */}
          {headerStyle === 'banner' ? (
            <div className="p-5 sm:p-8" style={{ backgroundColor: accent }}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  {showLogo && logoUrl ? (
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
                  <p className="text-2xl sm:text-3xl font-bold text-white">DEVIS</p>
                  <p className="text-sm font-medium text-white/80 mt-1">{quote.quote_number}</p>
                  <p className="text-xs text-white/60 mt-1">Date : {formatDate(quote.created_at)}</p>
                </div>
              </div>
            </div>
          ) : headerStyle === 'compact' ? (
            /* Compact header */
            <div className="px-5 sm:px-8 py-3 border-b border-[#e5e1da] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-3">
                {showLogo && logoUrl ? (
                  <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : null}
                <span className="text-sm font-semibold" style={{ color: textColor }}>{companyName}</span>
                {artisan?.siret && <span className="text-xs text-[#6b6560]">SIRET {artisan.siret}</span>}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold" style={{ color: accent }}>DEVIS</span>
                <span className="text-sm font-medium" style={{ color: textColor }}>{quote.quote_number}</span>
                <span className="text-xs text-[#6b6560]">{formatDate(quote.created_at)}</span>
              </div>
            </div>
          ) : (
            /* Standard header */
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
                  <p className="text-2xl sm:text-3xl font-bold" style={{ color: accent }}>DEVIS</p>
                  <p className="text-sm font-medium mt-1" style={{ color: textColor }}>{quote.quote_number}</p>
                  <div className="text-xs text-[#6b6560] mt-2 space-y-0.5">
                    <p>Date : {formatDate(quote.created_at)}</p>
                    {quote.valid_until && (
                      <p>Valable jusqu&apos;au : {formatDate(quote.valid_until)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Accent line for banner/compact */}
          {(headerStyle === 'compact') && (
            <div className="h-0.5" style={{ backgroundColor: accent }} />
          )}

          {/* Artisan details (for banner/compact where they're not in the header) */}
          {headerStyle !== 'standard' && (artisan?.company_address || artisan?.company_phone || artisan?.tva_number) && (
            <div className="px-5 sm:px-8 py-3 border-b border-[#e5e1da] text-xs text-[#6b6560] flex flex-wrap gap-x-4 gap-y-0.5">
              {artisan?.company_address && <span>{artisan.company_address}, {artisan?.company_postal_code} {artisan?.company_city}</span>}
              {artisan?.company_phone && <span>Tel : {artisan.company_phone}</span>}
              {artisan?.tva_number && <span>TVA : {artisan.tva_number}</span>}
            </div>
          )}

          {/* Client info */}
          {quote.clients && (
            <div className="px-5 sm:px-8 py-4 bg-[#faf9f7] border-b border-[#e5e1da]">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-[#6b6560]" />
                <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Client</p>
              </div>
              <p className="text-sm font-medium" style={{ color: textColor }}>{quote.clients.name}</p>
              <div className="text-xs text-[#6b6560] mt-1 space-y-0.5">
                {quote.clients.email && <p>{quote.clients.email}</p>}
                {quote.clients.phone && <p>{quote.clients.phone}</p>}
                {quote.clients.address && <p>{quote.clients.address}</p>}
                {(quote.clients.postal_code || quote.clients.city) && (
                  <p>{[quote.clients.postal_code, quote.clients.city].filter(Boolean).join(' ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Quote dates — prominent for the client */}
          {(() => {
            const createdLabel = formatDate(quote.created_at);
            let expiryBlock: ReactNode = null;
            if (quote.valid_until) {
              const expiry = new Date(quote.valid_until + 'T23:59:59');
              const now = new Date();
              const isExpired = expiry.getTime() < now.getTime();
              const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isSoon = !isExpired && daysLeft <= 7;
              const badgeColor = isExpired ? '#dc2626' : isSoon ? '#b45309' : accent;
              const bgColor = isExpired ? '#fee2e2' : isSoon ? '#fef3c7' : accent + '15';
              const expiryLabel = isExpired ? 'Expiré le' : 'Valable jusqu\'au';
              const helperText = isExpired
                ? 'Ce devis a expiré'
                : daysLeft === 0
                  ? "Expire aujourd'hui"
                  : daysLeft === 1
                    ? 'Expire demain'
                    : isSoon
                      ? `Plus que ${daysLeft} jours`
                      : null;
              expiryBlock = (
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: bgColor }}
                  >
                    <Clock className="h-5 w-5" style={{ color: badgeColor }} />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: badgeColor }}
                    >
                      {expiryLabel}
                    </p>
                    <p className="text-base font-semibold mt-0.5" style={{ color: textColor }}>
                      {formatDate(quote.valid_until)}
                    </p>
                    {helperText && (
                      <p className="text-xs mt-0.5 font-medium" style={{ color: badgeColor }}>
                        {helperText}
                      </p>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <div className="px-5 sm:px-8 py-5 border-b border-[#e5e1da] bg-white">
                <div className="flex flex-col sm:flex-row gap-5 sm:gap-8">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: accent + '15' }}
                    >
                      <Calendar className="h-5 w-5" style={{ color: accent }} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: accent }}
                      >
                        Émis le
                      </p>
                      <p className="text-base font-semibold mt-0.5" style={{ color: textColor }}>
                        {createdLabel}
                      </p>
                    </div>
                  </div>
                  {expiryBlock}
                </div>
              </div>
            );
          })()}

          {/* Quote title & description */}
          <div className="px-5 sm:px-8 py-5 border-b border-[#e5e1da]">
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>{quote.title}</h2>
            {quote.description && (
              <p className="text-sm text-[#6b6560] mt-1 leading-relaxed">{quote.description}</p>
            )}
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
                <span className="text-sm font-medium" style={{ color: textColor }}>{formatCurrency(quote.total_ht)}</span>
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
                <span className="text-xl font-bold" style={{ color: accent }}>{formatCurrency(quote.total_ttc)}</span>
              </div>
            </div>
          </div>

          {/* Coordonnees bancaires */}
          {bankAccount && (
            <div className="border-t border-[#e5e1da] px-5 sm:px-8 py-5">
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="h-4 w-4" style={{ color: accent }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
                  Règlement par virement
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

          {/* Signature section — no horizontal padding on mobile for max canvas width */}
          <div id="signature-section" className="border-t-2 border-[#e5e1da] px-2 sm:px-8 py-6">
            <div className="flex items-center gap-2 mb-4">
              <PenLine className="h-4 w-4 text-[#6b6560]" />
              <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-wider">
                Signature electronique
              </p>
            </div>

            {signed ? (
              <div className="space-y-4">
                {signatureDisplayUrl && (
                  <div className="rounded-xl border border-[#e5e1da] bg-white p-4 inline-block">
                    <img
                      src={signatureDisplayUrl}
                      alt="Signature"
                      className="h-24 object-contain"
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    Signe electroniquement le {signedAt ? formatDate(signedAt) : ''}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sendData?.docuseal_signed_document_url && (
                    <a
                      href={sendData.docuseal_signed_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white transition-colors"
                      style={{ backgroundColor: accent }}
                    >
                      <Download className="h-3 w-3" />
                      Telecharger le devis signe
                    </a>
                  )}
                  {sendData?.docuseal_audit_log_url && (
                    <a
                      href={sendData.docuseal_audit_log_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-[#e5e1da] hover:bg-[#f5f3f0] transition-colors"
                      style={{ color: accent }}
                    >
                      <Shield className="h-3 w-3" />
                      Certificat de signature
                    </a>
                  )}
                </div>
              </div>
            ) : sendData?.docuseal_slug ? (
              <div className="space-y-4">
                <p className="text-sm text-[#6b6560]">
                  En signant ce devis, vous acceptez les conditions et les prix indiques ci-dessus.
                </p>
                <DocusealSigning
                  slug={sendData.docuseal_slug}
                  onComplete={handleDocuSealComplete}
                  accentColor={accent}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#6b6560]">
                  En signant ce devis, vous acceptez les conditions et les prix indiques ci-dessus.
                </p>

                {signing ? (
                  <div className="flex items-center justify-center gap-3 py-10">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent }}>
                      <Hexagon className="h-4 w-4 text-white animate-nut-ratchet" />
                    </div>
                    <p className="text-sm text-[#6b6560]">Signature en cours...</p>
                  </div>
                ) : (
                  <SignatureCanvas onSign={handleSign} disabled={signing} />
                )}
              </div>
            )}
          </div>

          {/* Legal mentions */}
          <div className="border-t border-[#e5e1da] px-5 sm:px-8 py-4 bg-[#faf9f7]">
            <div className="flex items-start gap-2">
              <Shield className="h-3.5 w-3.5 text-[#6b6560]/50 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-[#6b6560]/60 leading-relaxed">
                {mentionsLegales || (
                  <>
                    {quote.valid_until
                      ? `Devis valable jusqu'au ${formatDate(quote.valid_until)}. `
                      : ''}
                    Signature electronique realisee au sens du reglement europeen eIDAS{sendData?.docuseal_slug ? ' (signature electronique avancee)' : ' (signature electronique simple)'}.
                    Ce document a valeur contractuelle entre les parties.
                  </>
                )}
              </p>
            </div>
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
