'use client';

import { useState } from 'react';
import { Hexagon, CircleCheck as CheckCircle, Clock, PenLine, Download } from 'lucide-react';
import { DocusealSigning } from '@/components/devis/docuseal-signing';
import { getContractCategory, FREQUENCY_LABELS, type ContractFrequency } from '@/lib/contract-types';

export interface ContractSendData {
  id: string;
  recurring_contract_id: string;
  client_name: string;
  expires_at: string;
  signed_at: string | null;
  docuseal_slug: string | null;
  docuseal_submission_id: number | null;
  docuseal_certificate_url: string | null;
  docuseal_audit_log_url: string | null;
  docuseal_signed_document_url: string | null;
}

export interface ContractRecord {
  id: string;
  contract_number: string | null;
  title: string;
  category_key: string;
  client_type: 'b2b' | 'b2c';
  contract_channel: string;
  duration_mode: 'determinee' | 'indeterminee';
  initial_term_months: number;
  renewal_term_months: number;
  auto_renewal: boolean;
  notice_period_months: number;
  frequency: ContractFrequency;
  visits_per_year: number;
  weather_dependent: boolean;
  site_address: string;
  site_access_notes: string;
  included_operations: string[];
  excluded_operations: string[];
  intervention_hours: string;
  emergency_phone: string;
  response_time: string;
  payment_method: string;
  payment_timing: string;
  payment_terms_days: number;
  late_penalty_rate: number;
  recovery_fee: number;
  breach_cure_period_days: number;
  amount: number;
  start_date: string;
  end_date: string | null;
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

export interface ContractArtisanProfile {
  company_name: string | null;
  full_name: string | null;
  siret: string | null;
  tva_number: string | null;
  company_address: string | null;
  company_postal_code: string | null;
  company_city: string | null;
  company_phone: string | null;
  logo_url: string | null;
  document_config: Record<string, unknown> | null;
}

function fmtCurrency(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d));
}

export function ContractPublicView({
  contract,
  send,
  artisan,
  onSigned,
}: {
  contract: ContractRecord;
  send: ContractSendData;
  artisan: ContractArtisanProfile | null;
  onSigned: () => void;
}) {
  const [signed, setSigned] = useState(Boolean(send.signed_at));
  const [showSigning, setShowSigning] = useState(false);

  const category = getContractCategory(contract.category_key);
  const dc = (artisan?.document_config || {}) as Record<string, string | boolean>;
  const accent = (dc.primary_color as string) || '#d35400';
  const companyName = artisan?.company_name || artisan?.full_name || 'Artisan';
  const logoUrl = artisan?.logo_url || '';
  const showLogo = dc.show_logo !== false;

  const tvaRate = 20;
  const amountHt = Number(contract.amount) || 0;
  const amountTva = +(amountHt * (tvaRate / 100)).toFixed(2);
  const amountTtc = +(amountHt + amountTva).toFixed(2);

  async function handleComplete() {
    setSigned(true);
    setShowSigning(false);
    if (send.docuseal_submission_id) {
      fetch('/api/docuseal/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: send.docuseal_submission_id, token: window.location.pathname.split('/').pop() }),
      }).catch(() => {});
    }
    onSigned();
  }

  return (
    <div className="min-h-screen bg-[#faf9f7]">
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
            <span className="text-sm font-semibold">{companyName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6b6560]">
            <Clock className="h-3.5 w-3.5" />
            Contrat pour {send.client_name}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {signed && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-emerald-800">Contrat signé</h3>
              <p className="text-xs text-emerald-600 mt-1">Votre contrat est désormais actif. Un exemplaire signé vous a été envoyé par email.</p>
              {send.docuseal_signed_document_url && (
                <a href={send.docuseal_signed_document_url} target="_blank" rel="noreferrer"
                   className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700 hover:text-emerald-900">
                  <Download className="h-3.5 w-3.5" /> Télécharger le contrat signé
                </a>
              )}
            </div>
          </div>
        )}

        {/* Carte entête contrat */}
        <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 sm:p-7 mb-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#6b6560]">{category.label}</div>
              <h1 className="text-2xl font-bold mt-1">{contract.title || 'Contrat de maintenance'}</h1>
              <p className="text-sm text-[#6b6560] mt-1">N° {contract.contract_number || '—'}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-[#6b6560]">Montant annuel TTC</div>
              <div className="text-2xl font-extrabold" style={{ color: accent }}>{fmtCurrency(amountTtc)}</div>
              <div className="text-[11px] text-[#6b6560]">soit {fmtCurrency(amountHt)} HT + TVA {tvaRate}%</div>
            </div>
          </div>
        </div>

        {/* Caractéristiques clefs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          {[
            ['Fréquence', FREQUENCY_LABELS[contract.frequency]],
            ['Visites/an', `${contract.visits_per_year}`],
            ['Durée', contract.duration_mode === 'determinee' ? `${contract.initial_term_months} mois` : 'Indéterminée'],
            ['Reconduction', contract.auto_renewal ? 'Tacite' : 'Aucune'],
            ['Préavis', `${contract.notice_period_months} mois`],
            ['Paiement', contract.payment_method],
          ].map(([label, value]) => (
            <div key={label} className="bg-white rounded-xl border border-[#e5e1da] p-3">
              <div className="text-[10px] uppercase tracking-wider text-[#6b6560] font-semibold">{label}</div>
              <div className="text-sm font-medium mt-1">{value}</div>
            </div>
          ))}
        </div>

        {/* Lieu d'intervention */}
        <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 mb-5">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-[#6b6560]">Lieu d&apos;intervention</h3>
          <p className="text-sm mt-2">{contract.site_address || '—'}</p>
          {contract.site_access_notes && <p className="text-xs text-[#6b6560] mt-1">{contract.site_access_notes}</p>}
        </div>

        {/* Prestations incluses / exclues */}
        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <div className="bg-white rounded-2xl border border-[#e5e1da] p-5">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-emerald-700">Prestations incluses</h3>
            {contract.included_operations.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm">
                {contract.included_operations.map((op, i) => (
                  <li key={i} className="flex gap-2"><span className="text-emerald-600">✓</span><span>{op}</span></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#6b6560] mt-2 italic">À définir</p>
            )}
          </div>
          <div className="bg-white rounded-2xl border border-[#e5e1da] p-5">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-red-700">Prestations exclues</h3>
            {contract.excluded_operations.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm">
                {contract.excluded_operations.map((op, i) => (
                  <li key={i} className="flex gap-2"><span className="text-red-500">×</span><span>{op}</span></li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[#6b6560] mt-2 italic">Aucune exclusion</p>
            )}
          </div>
        </div>

        {/* Calendrier */}
        <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 mb-5">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-[#6b6560]">Calendrier</h3>
          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <div><div className="text-xs text-[#6b6560]">Démarrage</div><div className="font-medium">{fmtDate(contract.start_date)}</div></div>
            <div><div className="text-xs text-[#6b6560]">Horaires</div><div className="font-medium">{contract.intervention_hours}</div></div>
            {contract.emergency_phone && <div><div className="text-xs text-[#6b6560]">Astreinte</div><div className="font-medium">{contract.emergency_phone}</div></div>}
            <div><div className="text-xs text-[#6b6560]">Délai intervention</div><div className="font-medium">{contract.response_time}</div></div>
          </div>
          {contract.weather_dependent && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ☁️ Prestations dépendantes des conditions météorologiques — report sans frais en cas d&apos;intempéries.
            </p>
          )}
        </div>

        {/* Zone signature */}
        {!signed && (
          <div className="bg-white rounded-2xl border border-[#e5e1da] p-5 sm:p-7">
            {!showSigning ? (
              <div className="text-center">
                <PenLine className="h-8 w-8 mx-auto mb-3" style={{ color: accent }} />
                <h3 className="text-lg font-bold">Signer mon contrat</h3>
                <p className="text-sm text-[#6b6560] mt-1 max-w-md mx-auto">
                  En cliquant sur le bouton ci-dessous, je prends connaissance et j&apos;accepte l&apos;intégralité des clauses du contrat pour un montant annuel de <strong>{fmtCurrency(amountTtc)} TTC</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => setShowSigning(true)}
                  disabled={!send.docuseal_slug}
                  className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  <PenLine className="h-4 w-4" /> Signer maintenant
                </button>
                {!send.docuseal_slug && <p className="mt-3 text-xs text-red-600">Lien de signature non disponible. Contactez {companyName}.</p>}
              </div>
            ) : send.docuseal_slug ? (
              <DocusealSigning slug={send.docuseal_slug} onComplete={handleComplete} accentColor={accent} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
