export interface DocumentConfig {
  template: string; // 'classique' | 'moderne' | 'minimal'
  primary_color: string;
  secondary_color: string;
  font: string; // 'inter' | 'geist' | 'serif'
  show_logo: boolean;
  logo_position: 'left' | 'center';
  header_style: 'standard' | 'banner' | 'compact';
  show_watermark: boolean;
  footer_text: string;
  mentions_legales: string;
}

export const DEFAULT_DOCUMENT_CONFIG: DocumentConfig = {
  template: 'classique',
  primary_color: '#d35400',
  secondary_color: '#1a1a1a',
  font: 'inter',
  show_logo: true,
  logo_position: 'left',
  header_style: 'standard',
  show_watermark: false,
  footer_text: '',
  mentions_legales: 'Devis valable 30 jours. En cas de litige, le tribunal competent sera celui du siege social du prestataire.',
};

export const TEMPLATE_PRESETS: { value: string; label: string; description: string; colors: { primary: string; secondary: string } }[] = [
  {
    value: 'classique',
    label: 'Classique',
    description: 'Sobre et professionnel, ideal pour le BTP',
    colors: { primary: '#d35400', secondary: '#1a1a1a' },
  },
  {
    value: 'moderne',
    label: 'Moderne',
    description: 'Design epure avec touches de couleur',
    colors: { primary: '#2563eb', secondary: '#0f172a' },
  },
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Tres simple, tout en noir et blanc',
    colors: { primary: '#18181b', secondary: '#3f3f46' },
  },
];

export const COLOR_PRESETS = [
  { value: '#d35400', label: 'Orange BTP' },
  { value: '#2563eb', label: 'Bleu' },
  { value: '#059669', label: 'Vert' },
  { value: '#7c3aed', label: 'Violet' },
  { value: '#dc2626', label: 'Rouge' },
  { value: '#0891b2', label: 'Cyan' },
  { value: '#18181b', label: 'Noir' },
  { value: '#6d28d9', label: 'Indigo' },
];

export const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter (sans-serif)' },
  { value: 'geist', label: 'Geist (moderne)' },
  { value: 'serif', label: 'Georgia (serif)' },
];

export function mergeDocConfig(saved: Partial<DocumentConfig> | null | undefined): DocumentConfig {
  return { ...DEFAULT_DOCUMENT_CONFIG, ...(saved || {}) };
}
