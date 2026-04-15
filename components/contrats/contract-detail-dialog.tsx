'use client';

import { useState } from 'react';
import { Download, Edit, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/constants';
import { FREQUENCY_LABELS, getContractCategory, type ContractCategoryKey, type ContractFrequency } from '@/lib/contract-types';
import { supabase } from '@/lib/supabase';

interface ContractLineItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
}

export interface ContractDetail {
  id: string;
  contract_number: string | null;
  title: string;
  description: string;
  status: string;
  amount: number;
  tva_rate: number;
  frequency: string;
  start_date: string | null;
  end_date: string | null;
  next_billing: string | null;
  notes: string;
  line_items: ContractLineItem[];
  clients: { id: string; name: string; email: string | null } | null;
  // Optional rich fields (read from JSON on the row)
  category_key?: ContractCategoryKey;
  visits_per_year?: number;
  site_address?: string;
  site_access_notes?: string;
  included_operations?: string[];
  excluded_operations?: string[];
  intervention_hours?: string;
  emergency_phone?: string;
  response_time?: string;
  duration_mode?: 'determinee' | 'indeterminee';
  initial_term_months?: number;
  renewal_term_months?: number;
  auto_renewal?: boolean;
  notice_period_months?: number;
  payment_method?: string;
  payment_timing?: string;
  payment_terms_days?: number;
}

export function ContractDetailDialog({
  contract,
  onClose,
  onEdit,
}: {
  contract: ContractDetail;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const cat = getContractCategory((contract.category_key as ContractCategoryKey) || 'autre');
  const totalTtc = contract.amount * (1 + (contract.tva_rate ?? 20) / 100);

  async function downloadPdf() {
    setDownloadingPdf(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/contrats/${contract.id}/pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        alert('Erreur lors de la génération du PDF');
        return;
      }
      const json = await res.json();
      if (json.url) window.open(json.url, '_blank');
    } finally {
      setDownloadingPdf(false);
    }
  }

  const editable = contract.status === 'brouillon';

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="text-2xl">{cat.emoji}</span>
            {contract.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Header info */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {contract.contract_number && (
              <span className="rounded-full bg-muted px-2.5 py-1 font-mono">{contract.contract_number}</span>
            )}
            <span className="rounded-full bg-muted px-2.5 py-1">{cat.label}</span>
            <span className="rounded-full bg-muted px-2.5 py-1">{FREQUENCY_LABELS[contract.frequency as ContractFrequency] || contract.frequency}</span>
            {contract.status === 'brouillon' && <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-1">Brouillon</span>}
            {contract.status === 'en_attente' && <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-1">En attente de signature</span>}
            {contract.status === 'actif' && <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1">Actif</span>}
            {contract.status === 'suspendu' && <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-1">Suspendu</span>}
            {contract.status === 'resilie' && <span className="rounded-full bg-red-100 text-red-800 px-2.5 py-1">Résilié</span>}
          </div>

          {/* Client */}
          {contract.clients && (
            <Section label="Client">
              <p className="font-medium">{contract.clients.name}</p>
              {contract.clients.email && <p className="text-sm text-muted-foreground">{contract.clients.email}</p>}
              {contract.site_address && (
                <p className="text-sm text-muted-foreground mt-1">📍 {contract.site_address}</p>
              )}
              {contract.site_access_notes && (
                <p className="text-xs text-muted-foreground mt-1 italic">Accès : {contract.site_access_notes}</p>
              )}
            </Section>
          )}

          {/* Tarif */}
          <Section label="Tarif">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Cell label="Montant HT" value={formatCurrency(contract.amount)} />
              <Cell label="TVA" value={`${contract.tva_rate ?? 20} %`} />
              <Cell label={`Total TTC ${FREQUENCY_LABELS[contract.frequency as ContractFrequency] ? `(${FREQUENCY_LABELS[contract.frequency as ContractFrequency].toLowerCase()})` : ''}`} value={formatCurrency(totalTtc)} accent />
            </div>
            {contract.line_items && contract.line_items.length > 0 && (
              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                      <th className="px-3 py-2 text-right font-medium">Qté</th>
                      <th className="px-3 py-2 text-right font-medium">PU HT</th>
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.line_items.map((l, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2">{l.description}</td>
                        <td className="px-3 py-2 text-right">{l.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(l.unit_price)}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(l.quantity * l.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Prestations */}
          {(contract.included_operations?.length || contract.excluded_operations?.length) && (
            <Section label="Prestations">
              <div className="grid sm:grid-cols-2 gap-3">
                {!!contract.included_operations?.length && (
                  <div className="rounded-lg border border-border bg-emerald-50/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1.5">Incluses</p>
                    <ul className="text-sm space-y-1">
                      {contract.included_operations.map((op, i) => <li key={i} className="flex gap-1.5"><span className="text-emerald-600">✓</span>{op}</li>)}
                    </ul>
                  </div>
                )}
                {!!contract.excluded_operations?.length && (
                  <div className="rounded-lg border border-border bg-red-50/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-700 mb-1.5">Exclues</p>
                    <ul className="text-sm space-y-1">
                      {contract.excluded_operations.map((op, i) => <li key={i} className="flex gap-1.5"><span className="text-red-500">×</span>{op}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Logistique */}
          <Section label="Logistique">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <Cell label="Visites / an" value={String(contract.visits_per_year ?? '—')} />
              <Cell label="Horaires" value={contract.intervention_hours || '—'} />
              <Cell label="Délai intervention" value={contract.response_time || '—'} />
              {contract.emergency_phone && <Cell label="Astreinte" value={contract.emergency_phone} />}
            </div>
          </Section>

          {/* Durée + paiement */}
          <Section label="Durée et conditions">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <Cell label="Début" value={contract.start_date ? formatDate(contract.start_date) : '—'} />
              <Cell label="Fin" value={contract.end_date ? formatDate(contract.end_date) : 'Indéterminée'} />
              <Cell label="Prochaine facture" value={contract.next_billing ? formatDate(contract.next_billing) : '—'} />
              <Cell label="Durée" value={contract.duration_mode === 'indeterminee' ? 'Indéterminée' : `${contract.initial_term_months ?? 12} mois`} />
              <Cell label="Reconduction" value={contract.auto_renewal === false ? 'Non' : `Tacite (${contract.renewal_term_months ?? 12} mois)`} />
              <Cell label="Préavis" value={`${contract.notice_period_months ?? 2} mois`} />
              <Cell label="Paiement" value={paymentMethodLabel(contract.payment_method)} />
              <Cell label="Cadence" value={contract.payment_timing === 'terme_a_echoir' ? 'Terme à échoir' : 'Terme échu'} />
              <Cell label="Délai paiement" value={`${contract.payment_terms_days ?? 30} j`} />
            </div>
          </Section>

          {(contract.description || contract.notes) && (
            <Section label="Notes">
              {contract.description && <p className="text-sm text-muted-foreground">{contract.description}</p>}
              {contract.notes && <p className="text-xs text-muted-foreground mt-1 italic">{contract.notes}</p>}
            </Section>
          )}

          {!editable && (
            <p className="text-xs text-muted-foreground italic">
              Le contrat est {contract.status === 'actif' ? 'actif et signé' : `au statut « ${contract.status} »`} — l&apos;édition est limitée.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 pt-5 border-t mt-5">
          <Button variant="outline" onClick={downloadPdf} disabled={downloadingPdf} className="gap-2">
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Télécharger le PDF
          </Button>
          <Button onClick={onEdit} className="gap-2">
            <Edit className="h-4 w-4" /> Modifier
          </Button>
          <Button variant="ghost" onClick={onClose} className="sm:ml-auto">Fermer</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm mt-0.5 font-medium ${accent ? 'text-[#d35400]' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

function paymentMethodLabel(m?: string) {
  switch (m) {
    case 'virement': return 'Virement';
    case 'sepa': return 'Prélèvement SEPA';
    case 'cb': return 'Carte bancaire';
    case 'cheque': return 'Chèque';
    case 'especes': return 'Espèces';
    default: return '—';
  }
}
