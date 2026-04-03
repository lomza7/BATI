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

export interface LeadStageColorPreset {
  value: string;
  label: string;
  preview: string;
}

export const DEFAULT_LEAD_STAGES: Array<Pick<LeadStageConfig, 'slug' | 'label' | 'color' | 'position' | 'is_terminal'>> = [
  { slug: 'nouveau', label: 'Nouveau', color: 'bg-slate-100 text-slate-700', position: 0, is_terminal: false },
  { slug: 'contacte', label: 'Contacte', color: 'bg-blue-50 text-blue-700', position: 1, is_terminal: false },
  { slug: 'devis_envoye', label: 'Devis envoye', color: 'bg-amber-50 text-amber-700', position: 2, is_terminal: false },
  { slug: 'negocie', label: 'En nego', color: 'bg-orange-50 text-orange-700', position: 3, is_terminal: false },
  { slug: 'gagne', label: 'Gagne', color: 'bg-emerald-50 text-emerald-700', position: 4, is_terminal: true },
  { slug: 'perdu', label: 'Perdu', color: 'bg-red-50 text-red-700', position: 5, is_terminal: true },
];

export const LEAD_STAGE_COLOR_PRESETS: LeadStageColorPreset[] = [
  { value: 'bg-slate-100 text-slate-700', label: 'Ardoise', preview: 'bg-slate-500' },
  { value: 'bg-zinc-100 text-zinc-700', label: 'Zinc', preview: 'bg-zinc-500' },
  { value: 'bg-blue-50 text-blue-700', label: 'Bleu', preview: 'bg-blue-500' },
  { value: 'bg-sky-50 text-sky-700', label: 'Ciel', preview: 'bg-sky-500' },
  { value: 'bg-cyan-50 text-cyan-700', label: 'Cyan', preview: 'bg-cyan-500' },
  { value: 'bg-violet-50 text-violet-700', label: 'Violet', preview: 'bg-violet-500' },
  { value: 'bg-fuchsia-50 text-fuchsia-700', label: 'Fuchsia', preview: 'bg-fuchsia-500' },
  { value: 'bg-amber-50 text-amber-700', label: 'Ambre', preview: 'bg-amber-500' },
  { value: 'bg-orange-50 text-orange-700', label: 'Orange', preview: 'bg-orange-500' },
  { value: 'bg-emerald-50 text-emerald-700', label: 'Emeraude', preview: 'bg-emerald-500' },
  { value: 'bg-lime-50 text-lime-700', label: 'Lime', preview: 'bg-lime-500' },
  { value: 'bg-red-50 text-red-700', label: 'Rouge', preview: 'bg-red-500' },
];

export const CORE_LEAD_STAGE_SLUGS = new Set(DEFAULT_LEAD_STAGES.map((stage) => stage.slug));

export function normalizeLeadStageSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

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
