'use client';

import { type DocumentConfig } from '@/lib/document-templates';
import { cn } from '@/lib/utils';

interface DocumentPreviewProps {
  config: DocumentConfig;
  logoUrl?: string;
  companyName?: string;
  type?: 'devis' | 'facture';
}

export function DocumentPreview({ config, logoUrl, companyName = 'Mon Entreprise', type = 'devis' }: DocumentPreviewProps) {
  const docTitle = type === 'devis' ? 'DEVIS' : 'FACTURE';
  const docNumber = type === 'devis' ? 'D-2026-042' : 'F-2026-018';

  const fontClass =
    config.font === 'serif' ? 'font-serif' :
    config.font === 'geist' ? 'font-sans' : 'font-sans';

  const isModerne = config.template === 'moderne';
  const isMinimal = config.template === 'minimal';

  return (
    <div
      className={cn('w-full rounded-lg border shadow-sm overflow-hidden', fontClass)}
      style={{ fontSize: '10px', lineHeight: '1.4' }}
    >
      {/* Header */}
      {config.header_style === 'banner' ? (
        <div className="px-4 py-3" style={{ backgroundColor: config.primary_color }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {config.show_logo && logoUrl ? (
                <img src={logoUrl} alt="" className="h-6 w-6 rounded object-cover" />
              ) : config.show_logo ? (
                <div className="h-6 w-6 rounded flex items-center justify-center text-white font-bold text-[10px]" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  {companyName.charAt(0)}
                </div>
              ) : null}
              <span className="font-semibold text-white text-[11px]">{companyName}</span>
            </div>
            <div className="text-right text-white">
              <p className="font-bold text-[12px]">{docTitle}</p>
              <p className="text-[9px] opacity-80">{docNumber}</p>
            </div>
          </div>
        </div>
      ) : config.header_style === 'compact' ? (
        <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: config.primary_color + '30' }}>
          <div className="flex items-center gap-2">
            {config.show_logo && logoUrl ? (
              <img src={logoUrl} alt="" className="h-5 w-5 rounded object-cover" />
            ) : null}
            <span className="font-medium text-[10px]" style={{ color: config.secondary_color }}>{companyName}</span>
          </div>
          <span className="font-bold text-[11px]" style={{ color: config.primary_color }}>{docTitle} {docNumber}</span>
        </div>
      ) : (
        /* Standard header */
        <div className="px-4 py-3 bg-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                {config.show_logo && logoUrl ? (
                  <img src={logoUrl} alt="" className="h-7 w-7 rounded object-cover" />
                ) : config.show_logo ? (
                  <div className="h-7 w-7 rounded flex items-center justify-center font-bold text-white text-[11px]" style={{ backgroundColor: config.primary_color }}>
                    {companyName.charAt(0)}
                  </div>
                ) : null}
                <span className="font-semibold text-[11px]" style={{ color: config.secondary_color }}>{companyName}</span>
              </div>
              <p className="text-[8px] mt-1 text-gray-400">12 Rue du Batiment, 75001 Paris</p>
              <p className="text-[8px] text-gray-400">SIRET: 123 456 789 00012</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-[14px]" style={{ color: config.primary_color }}>{docTitle}</p>
              <p className="text-[9px] text-gray-500">{docNumber}</p>
              <p className="text-[8px] text-gray-400 mt-1">04/04/2026</p>
            </div>
          </div>
        </div>
      )}

      {/* Separator line for moderne */}
      {isModerne && config.header_style === 'standard' && (
        <div className="h-0.5" style={{ backgroundColor: config.primary_color }} />
      )}

      {/* Client block */}
      <div className="px-4 py-2" style={{ backgroundColor: isMinimal ? '#ffffff' : '#fafaf9' }}>
        <p className="text-[8px] uppercase tracking-wider text-gray-400 mb-0.5">Client</p>
        <p className="font-medium text-[10px]" style={{ color: config.secondary_color }}>Jean Dupont</p>
        <p className="text-[8px] text-gray-400">15 Avenue de la Republique, 69001 Lyon</p>
      </div>

      {/* Lines */}
      <div className="px-4 py-2">
        <table className="w-full text-[9px]">
          <thead>
            <tr style={{ borderBottom: `1px solid ${config.primary_color}20` }}>
              <th className="text-left py-1 font-medium" style={{ color: config.primary_color }}>Description</th>
              <th className="text-right py-1 font-medium w-10" style={{ color: config.primary_color }}>Qte</th>
              <th className="text-right py-1 font-medium w-14" style={{ color: config.primary_color }}>Prix HT</th>
              <th className="text-right py-1 font-medium w-14" style={{ color: config.primary_color }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-1">Pose carrelage 60x60</td>
              <td className="text-right py-1">25 m²</td>
              <td className="text-right py-1">45,00 €</td>
              <td className="text-right py-1 font-medium">1 125,00 €</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1">Fourniture carrelage gres cerame</td>
              <td className="text-right py-1">27 m²</td>
              <td className="text-right py-1">32,00 €</td>
              <td className="text-right py-1 font-medium">864,00 €</td>
            </tr>
            <tr>
              <td className="py-1">Depose ancien sol + evacuation</td>
              <td className="text-right py-1">1 forf.</td>
              <td className="text-right py-1">350,00 €</td>
              <td className="text-right py-1 font-medium">350,00 €</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="px-4 py-2 flex justify-end">
        <div className="w-32 text-[9px]">
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">Total HT</span>
            <span>2 339,00 €</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="text-gray-500">TVA 20%</span>
            <span>467,80 €</span>
          </div>
          <div
            className="flex justify-between py-1 font-bold border-t mt-0.5"
            style={{ color: config.primary_color, borderColor: config.primary_color + '40' }}
          >
            <span>Total TTC</span>
            <span>2 806,80 €</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t" style={{ borderColor: '#e5e5e5', backgroundColor: isMinimal ? '#ffffff' : '#fafaf9' }}>
        <p className="text-[7px] text-gray-400 text-center">
          {config.footer_text || config.mentions_legales || 'Devis valable 30 jours.'}
        </p>
        {config.show_watermark && (
          <p className="text-[7px] text-center mt-0.5" style={{ color: config.primary_color + '60' }}>
            Cree avec Hellobat
          </p>
        )}
      </div>
    </div>
  );
}
