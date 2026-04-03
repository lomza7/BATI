export interface LeadStageConfig {
  id: string;
  user_id: string;
  slug: string;
  label: string;
  color: string;
  position: number;
  is_terminal: boolean;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_LEAD_STAGES: Array<Pick<LeadStageConfig, 'slug' | 'label' | 'color' | 'position' | 'is_terminal'>> = [
  { slug: 'nouveau', label: 'Nouveau', color: 'bg-slate-100 text-slate-700', position: 0, is_terminal: false },
  { slug: 'contacte', label: 'Contacte', color: 'bg-blue-50 text-blue-700', position: 1, is_terminal: false },
  { slug: 'devis_envoye', label: 'Devis envoye', color: 'bg-amber-50 text-amber-700', position: 2, is_terminal: false },
  { slug: 'negocie', label: 'En nego', color: 'bg-orange-50 text-orange-700', position: 3, is_terminal: false },
  { slug: 'gagne', label: 'Gagne', color: 'bg-emerald-50 text-emerald-700', position: 4, is_terminal: true },
  { slug: 'perdu', label: 'Perdu', color: 'bg-red-50 text-red-700', position: 5, is_terminal: true },
];

export function buildLeadStageMap(stages: Array<Pick<LeadStageConfig, 'slug' | 'label' | 'color'>>) {
  const map = new Map<string, { label: string; color: string }>();

  DEFAULT_LEAD_STAGES.forEach((stage) => {
    map.set(stage.slug, { label: stage.label, color: stage.color });
  });

  stages.forEach((stage) => {
    map.set(stage.slug, { label: stage.label, color: stage.color });
  });

  return map;
}
