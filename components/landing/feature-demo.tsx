'use client';

import { Hexagon } from 'lucide-react';
import { DemoViewContent } from './demo-app';

const SLUG_TO_VIEW: Record<string, string> = {
  'devis-ia': 'devis',
  'devis-factures': 'devis',
  'facture-electronique': 'factures',
  'prestations': 'prestations',
  'contacts': 'contacts',
  'signature-electronique': 'devis',
  'suivi-chantiers': 'chantiers',
  'planning-equipe': 'planning',
  'google-calendar': 'calendrier',
  'equipe': 'equipe',
  'carte-interactive': 'carte',
  'catalogues': 'catalogues',
  'site-vitrine': 'site-web',
  'prospection-crm': 'prospection',
  'gmail-integre': 'mail',
  'avis-google': 'avis',
  'paiements-stripe': 'paiements',
  'contrats-recurrents': 'contrats',
  'comptabilite-ia': 'comptabilite',
  'agents-ia': 'agents',
  'rendus-ia': 'plans-rendus',
};

const SLUG_TO_PATH: Record<string, string> = {
  'devis-ia': 'hellobat.app/devis',
  'devis-factures': 'hellobat.app/devis',
  'facture-electronique': 'hellobat.app/factures',
  'prestations': 'hellobat.app/prestations',
  'contacts': 'hellobat.app/clients',
  'signature-electronique': 'hellobat.app/devis',
  'suivi-chantiers': 'hellobat.app/chantiers',
  'planning-equipe': 'hellobat.app/planning',
  'google-calendar': 'hellobat.app/calendrier',
  'equipe': 'hellobat.app/equipe',
  'carte-interactive': 'hellobat.app/carte',
  'catalogues': 'hellobat.app/catalogues',
  'site-vitrine': 'hellobat.app/site-web',
  'prospection-crm': 'hellobat.app/prospection',
  'gmail-integre': 'hellobat.app/mail',
  'avis-google': 'hellobat.app/avis',
  'paiements-stripe': 'hellobat.app/paiements',
  'contrats-recurrents': 'hellobat.app/contrats',
  'comptabilite-ia': 'hellobat.app/comptabilite',
  'agents-ia': 'hellobat.app/agents',
  'rendus-ia': 'hellobat.app/rendus',
};

export function FeatureDemo({ slug }: { slug: string }) {
  const viewId = SLUG_TO_VIEW[slug];
  if (!viewId) return null;

  const urlPath = SLUG_TO_PATH[slug] || 'hellobat.app';

  return (
    <div className="rounded-xl sm:rounded-2xl border border-[var(--landing-border)] bg-white shadow-2xl shadow-black/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-3 border-b border-[var(--landing-border)] bg-[var(--landing-off)]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[10px] sm:text-xs text-[var(--landing-muted)] ml-2 sm:ml-3 font-mono">{urlPath}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-5 h-5 bg-[var(--landing-accent)] rounded flex items-center justify-center">
            <Hexagon className="h-2.5 w-2.5 text-white" />
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6 min-h-[350px]">
        <DemoViewContent view={viewId} />
      </div>
    </div>
  );
}
