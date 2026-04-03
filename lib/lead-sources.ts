export interface LeadSource {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  source_type: 'channel' | 'partner';
  contact_name: string;
  reward_note: string;
  is_active: boolean;
  position: number;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_LEAD_SOURCES: Array<Pick<LeadSource, 'name' | 'slug' | 'source_type' | 'position'>> = [
  { name: 'Travaux.com', slug: 'travaux_com', source_type: 'channel', position: 0 },
  { name: 'Site web', slug: 'site_web', source_type: 'channel', position: 1 },
  { name: 'Google', slug: 'google', source_type: 'channel', position: 2 },
  { name: 'Meta Ads', slug: 'meta_ads', source_type: 'channel', position: 3 },
  { name: 'Bouche a oreille', slug: 'bouche_a_oreille', source_type: 'channel', position: 4 },
  { name: 'Partenaire', slug: 'partenaire', source_type: 'partner', position: 5 },
  { name: 'Autre', slug: 'autre', source_type: 'channel', position: 6 },
];

export function normalizeLeadSourceSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function buildLeadSourceLabelMap(sources: Array<Pick<LeadSource, 'slug' | 'name'>>) {
  const sourceMap = new Map<string, string>();

  DEFAULT_LEAD_SOURCES.forEach((source) => {
    sourceMap.set(source.slug, source.name);
  });

  sources.forEach((source) => {
    sourceMap.set(source.slug, source.name);
  });

  return sourceMap;
}
