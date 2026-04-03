'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  Hexagon,
  Loader as Loader2,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle,
  Clock,
  Building2,
  User,
  PenLine,
  Shield,
} from 'lucide-react';
import { SignatureCanvas } from '@/components/devis/signature-canvas';

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
}

interface QuoteData {
  id: string;
  quote_number: string;
  title: string;
  description: string;
  status: string;
  total_ht: number;
  tva_rate: number;
  total_ttc: number;
  valid_until: string | null;
  signed_at: string | null;
  created_at: string;
  clients: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
  } | null;
}

interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
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
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signatureDisplayUrl, setSignatureDisplayUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // 1. Fetch send by token
    const { data: send } = await anonClient
      .from('quote_sends')
      .select('id, quote_id, client_name, expires_at, signed_at, signature_url')
      .eq('token', token)
      .maybeSingle();

    if (!send) {
      setError('Ce lien est invalide ou a expire.');
      setLoading(false);
      return;
    }

    if (new Date(send.expires_at) < new Date()) {
      setError('Ce lien a expire. Contactez votre artisan pour obtenir un nouveau lien.');
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

    // Mark viewed_at
    await anonClient
      .from('quote_sends')
      .update({ viewed_at: new Date().toISOString() })
      .eq('id', send.id)
      .is('viewed_at', null);

    // 2. Fetch quote with client
    const { data: quoteData } = await anonClient
      .from('quotes')
      .select('id, quote_number, title, description, status, total_ht, tva_rate, total_ttc, valid_until, signed_at, created_at, clients(name, email, phone, address, city, postal_code)')
      .eq('id', send.quote_id)
      .maybeSingle();

    if (quoteData) {
      setQuote(quoteData as unknown as QuoteData);
    }

    // 3. Fetch quote lines
    const { data: linesData } = await anonClient
      .from('quote_lines')
      .select('id, description, quantity, unit, unit_price, total, position')
      .eq('quote_id', send.quote_id)
      .order('position');

    if (linesData) {
      setLines(linesData as QuoteLine[]);
    }

    // 4. Fetch artisan profile via user_id from quote
    // We need user_id — get it from quote_sends
    const { data: sendFull } = await anonClient
      .from('quote_sends')
      .select('user_id')
      .eq('id', send.id)
      .single();

    if (sendFull?.user_id) {
      const { data: profile } = await anonClient
        .from('profiles')
        .select('company_name, full_name, siret, tva_number, company_address, company_postal_code, company_city, company_phone')
        .eq('id', sendFull.user_id)
        .maybeSingle();

      if (profile) {
        setArtisan(profile as ArtisanProfile);
      }
    }

    setLoading(false);
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

  const tvaRate = quote.tva_rate || 20;
  const tvaAmount = quote.total_ht * (tvaRate / 100);

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#e5e1da]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#d35400] flex items-center justify-center">
              <Hexagon className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-[#1a1a1a]">Hellobat</span>
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
          {/* Document header */}
          <div className="p-5 sm:p-8 border-b border-[#e5e1da]">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
              {/* Artisan info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-[#d35400]/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-5 w-5 text-[#d35400]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[#1a1a1a] truncate">
                      {artisan?.company_name || artisan?.full_name || 'Artisan'}
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

              {/* Quote meta */}
              <div className="sm:text-right flex-shrink-0">
                <p className="text-2xl sm:text-3xl font-bold text-[#d35400]">DEVIS</p>
                <p className="text-sm font-medium text-[#1a1a1a] mt-1">{quote.quote_number}</p>
                <div className="text-xs text-[#6b6560] mt-2 space-y-0.5">
                  <p>Date : {formatDate(quote.created_at)}</p>
                  {quote.valid_until && (
                    <p>Valable jusqu&apos;au : {formatDate(quote.valid_until)}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Client info */}
          {quote.clients && (
            <div className="px-5 sm:px-8 py-4 bg-[#faf9f7] border-b border-[#e5e1da]">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-[#6b6560]" />
                <p className="text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Client</p>
              </div>
              <p className="text-sm font-medium text-[#1a1a1a]">{quote.clients.name}</p>
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

          {/* Quote title & description */}
          <div className="px-5 sm:px-8 py-5 border-b border-[#e5e1da]">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">{quote.title}</h2>
            {quote.description && (
              <p className="text-sm text-[#6b6560] mt-1 leading-relaxed">{quote.description}</p>
            )}
          </div>

          {/* Lines — Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#faf9f7] border-b border-[#e5e1da]">
                  <th className="px-8 py-3 text-left text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Qte</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Unite</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Prix unit. HT</th>
                  <th className="px-8 py-3 text-right text-xs font-semibold text-[#6b6560] uppercase tracking-wider">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e1da]">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-8 py-3.5 text-sm text-[#1a1a1a]">{line.description}</td>
                    <td className="px-4 py-3.5 text-sm text-[#1a1a1a] text-center">{line.quantity}</td>
                    <td className="px-4 py-3.5 text-sm text-[#6b6560] text-center">{UNIT_LABELS[line.unit] || line.unit}</td>
                    <td className="px-4 py-3.5 text-sm text-[#1a1a1a] text-right">{formatCurrency(line.unit_price)}</td>
                    <td className="px-8 py-3.5 text-sm font-medium text-[#1a1a1a] text-right">{formatCurrency(line.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lines — Mobile cards */}
          <div className="sm:hidden divide-y divide-[#e5e1da]">
            {lines.map((line) => (
              <div key={line.id} className="px-5 py-4">
                <p className="text-sm font-medium text-[#1a1a1a]">{line.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#6b6560]">
                    {line.quantity} {UNIT_LABELS[line.unit] || line.unit} x {formatCurrency(line.unit_price)}
                  </span>
                  <span className="text-sm font-semibold text-[#1a1a1a]">{formatCurrency(line.total)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t-2 border-[#e5e1da] px-5 sm:px-8 py-5">
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center justify-between w-full sm:w-64">
                <span className="text-sm text-[#6b6560]">Total HT</span>
                <span className="text-sm font-medium text-[#1a1a1a]">{formatCurrency(quote.total_ht)}</span>
              </div>
              <div className="flex items-center justify-between w-full sm:w-64">
                <span className="text-sm text-[#6b6560]">TVA ({tvaRate}%)</span>
                <span className="text-sm font-medium text-[#1a1a1a]">{formatCurrency(tvaAmount)}</span>
              </div>
              <div className="flex items-center justify-between w-full sm:w-64 pt-2 border-t border-[#e5e1da] mt-1">
                <span className="text-base font-semibold text-[#1a1a1a]">Total TTC</span>
                <span className="text-xl font-bold text-[#d35400]">{formatCurrency(quote.total_ttc)}</span>
              </div>
            </div>
          </div>

          {/* Signature section */}
          <div className="border-t-2 border-[#e5e1da] px-5 sm:px-8 py-6">
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
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[#6b6560]">
                  En signant ce devis, vous acceptez les conditions et les prix indiques ci-dessus.
                </p>

                {signing ? (
                  <div className="flex items-center justify-center gap-3 py-10">
                    <div className="w-8 h-8 bg-[#d35400] rounded-lg flex items-center justify-center">
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
                {quote.valid_until
                  ? `Devis valable jusqu'au ${formatDate(quote.valid_until)}. `
                  : ''}
                Signature electronique realisee au sens du reglement europeen eIDAS (signature electronique simple).
                Ce document a valeur contractuelle entre les parties.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#e5e1da] py-6 mt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#d35400] flex items-center justify-center">
              <Hexagon className="h-3 w-3 text-white" />
            </div>
            <span className="text-xs font-medium text-[#6b6560]">Hellobat</span>
          </div>
          <p className="text-xs text-[#6b6560]/50">Devis professionnel</p>
        </div>
      </footer>
    </div>
  );
}
