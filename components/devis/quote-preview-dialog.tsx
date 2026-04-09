'use client';

import { useEffect, useState } from 'react';
import { Hexagon, Building2, User, PenLine, Shield, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { QUOTE_UNIT_LABELS } from '@/lib/constants';

interface PreviewLine {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

interface PreviewClient {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
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

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  lines: PreviewLine[];
  clientId: string | null;
  quoteNumber?: string;
  validUntil?: string | null;
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

export function QuotePreviewDialog({
  open,
  onClose,
  title,
  description,
  lines,
  clientId,
  quoteNumber,
  validUntil,
}: Props) {
  const { user } = useAuth();
  const [artisan, setArtisan] = useState<ArtisanProfile | null>(null);
  const [client, setClient] = useState<PreviewClient | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [profileRes, clientRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('company_name, full_name, siret, tva_number, company_address, company_postal_code, company_city, company_phone, logo_url, document_config')
          .eq('id', user!.id)
          .maybeSingle(),
        clientId
          ? supabase
              .from('clients')
              .select('name, email, phone, address, city, postal_code')
              .eq('id', clientId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (cancelled) return;

      if (profileRes.data) setArtisan(profileRes.data as ArtisanProfile);
      if (clientRes.data) setClient(clientRes.data as PreviewClient);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, user, clientId]);

  // Totaux calculés à partir des lignes en mémoire
  const validLines = lines.filter((l) => l.description.trim());
  const totalHt = validLines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);
  const tvaRate = 20;
  const tvaAmount = totalHt * (tvaRate / 100);
  const totalTtc = totalHt + tvaAmount;

  // Template config depuis le profil artisan
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

  const displayQuoteNumber = quoteNumber || 'D-AAAA-XXX';
  const createdAt = new Date();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-[#faf9f7]">
        <DialogTitle className="sr-only">Aperçu du devis</DialogTitle>

        {/* Header preview bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-md border-b border-[#e5e1da]">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs font-medium text-[#6b6560]">
              Aperçu — non envoyé
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
                    <p className="text-2xl sm:text-3xl font-bold text-white">DEVIS</p>
                    <p className="text-sm font-medium text-white/80 mt-1">{displayQuoteNumber}</p>
                    <p className="text-xs text-white/60 mt-1">Date : {formatDate(createdAt)}</p>
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
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold" style={{ color: accent }}>DEVIS</span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>{displayQuoteNumber}</span>
                  <span className="text-xs text-[#6b6560]">{formatDate(createdAt)}</span>
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
                    <p className="text-2xl sm:text-3xl font-bold" style={{ color: accent }}>DEVIS</p>
                    <p className="text-sm font-medium mt-1" style={{ color: textColor }}>{displayQuoteNumber}</p>
                    <div className="text-xs text-[#6b6560] mt-2 space-y-0.5">
                      <p>Date : {formatDate(createdAt)}</p>
                      {validUntil && (
                        <p>Valable jusqu&apos;au : {formatDate(validUntil)}</p>
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
                {title || <span className="text-[#6b6560] font-normal italic">Titre du devis</span>}
              </h2>
              {description && (
                <p className="text-sm text-[#6b6560] mt-1 leading-relaxed whitespace-pre-wrap">{description}</p>
              )}
            </div>

            {/* Lignes — Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e5e1da]" style={{ backgroundColor: accent + '08' }}>
                    <th className="px-8 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Qté</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Unité</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Prix unit. HT</th>
                    <th className="px-8 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Total HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e1da]">
                  {validLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-8 text-center text-sm text-[#6b6560] italic">
                        Aucune ligne saisie
                      </td>
                    </tr>
                  ) : (
                    validLines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-8 py-3.5 text-sm" style={{ color: textColor }}>{line.description}</td>
                        <td className="px-4 py-3.5 text-sm text-center" style={{ color: textColor }}>{line.quantity}</td>
                        <td className="px-4 py-3.5 text-sm text-[#6b6560] text-center">{QUOTE_UNIT_LABELS[line.unit] || line.unit}</td>
                        <td className="px-4 py-3.5 text-sm text-right" style={{ color: textColor }}>{formatCurrency(line.unit_price)}</td>
                        <td className="px-8 py-3.5 text-sm font-medium text-right" style={{ color: textColor }}>{formatCurrency(line.quantity * line.unit_price)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Lignes — Mobile */}
            <div className="sm:hidden divide-y divide-[#e5e1da]">
              {validLines.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-[#6b6560] italic">
                  Aucune ligne saisie
                </div>
              ) : (
                validLines.map((line, idx) => (
                  <div key={idx} className="px-5 py-4">
                    <p className="text-sm font-medium" style={{ color: textColor }}>{line.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-[#6b6560]">
                        {line.quantity} {QUOTE_UNIT_LABELS[line.unit] || line.unit} × {formatCurrency(line.unit_price)}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: textColor }}>{formatCurrency(line.quantity * line.unit_price)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totaux */}
            <div className="border-t-2 border-[#e5e1da] px-5 sm:px-8 py-5">
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center justify-between w-full sm:w-64">
                  <span className="text-sm text-[#6b6560]">Total HT</span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>{formatCurrency(totalHt)}</span>
                </div>
                <div className="flex items-center justify-between w-full sm:w-64">
                  <span className="text-sm text-[#6b6560]">TVA ({tvaRate}%)</span>
                  <span className="text-sm font-medium" style={{ color: textColor }}>{formatCurrency(tvaAmount)}</span>
                </div>
                <div className="flex items-center justify-between w-full sm:w-64 pt-2 border-t border-[#e5e1da] mt-1">
                  <span className="text-base font-semibold" style={{ color: textColor }}>Total TTC</span>
                  <span className="text-xl font-bold" style={{ color: accent }}>{formatCurrency(totalTtc)}</span>
                </div>
              </div>
            </div>

            {/* Signature placeholder */}
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

            {/* Legal mentions */}
            <div className="border-t border-[#e5e1da] px-5 sm:px-8 py-4 bg-[#faf9f7]">
              <div className="flex items-start gap-2">
                <Shield className="h-3.5 w-3.5 text-[#6b6560]/50 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-[#6b6560]/60 leading-relaxed">
                  {mentionsLegales || (
                    <>
                      {validUntil
                        ? `Devis valable jusqu'au ${formatDate(validUntil)}. `
                        : ''}
                      Signature électronique réalisée au sens du règlement européen eIDAS.
                      Ce document a valeur contractuelle entre les parties.
                    </>
                  )}
                </p>
              </div>
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
