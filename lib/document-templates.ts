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
  /**
   * Payment conditions block — required by French law on every invoice
   * (delai de paiement, penalites de retard, indemnite forfaitaire).
   * We pre-fill it with the most common BTP wording so a "validate-and-go"
   * user is automatically compliant.
   */
  payment_terms: string;
  payment_terms_preset: string; // identifier of the active preset, or 'custom'
  payment_terms_on_quotes: boolean;
  payment_terms_on_invoices: boolean;
}

/**
 * Standard French legal mentions that the law (LME, Code de commerce art.
 * D. 441-5) requires on every B2B invoice. Appended to every preset so the
 * artisan stays compliant without having to think about it.
 */
export const PAYMENT_TERMS_LEGAL_MENTIONS =
  'En cas de retard de paiement, des pénalités égales à 3 fois le taux d\'intérêt légal seront exigibles, ainsi qu\'une indemnité forfaitaire pour frais de recouvrement de 40 € (art. D. 441-5 du Code de commerce). Pas d\'escompte pour paiement anticipé.';

/**
 * Four BTP-standard payment condition presets. Order = visibility:
 * "30 jours nets" is the de-facto standard in the French construction sector
 * and the one we offer as default.
 */
export const PAYMENT_TERMS_PRESETS: {
  value: string;
  label: string;
  short: string;
  body: string;
}[] = [
  {
    value: '30j_net',
    label: '30 jours nets',
    short: 'Standard BTP — recommandé',
    body: `Paiement à 30 jours nets à compter de la date d'émission de la facture, par virement bancaire.\n\n${PAYMENT_TERMS_LEGAL_MENTIONS}`,
  },
  {
    value: '30j_fdm',
    label: '30 jours fin de mois',
    short: 'Délai administratif classique',
    body: `Paiement à 30 jours fin de mois à compter de la date d'émission de la facture, par virement bancaire.\n\n${PAYMENT_TERMS_LEGAL_MENTIONS}`,
  },
  {
    value: 'reception',
    label: 'Paiement à réception',
    short: 'Pour les petits chantiers',
    body: `Paiement à réception de facture, par virement bancaire ou chèque.\n\n${PAYMENT_TERMS_LEGAL_MENTIONS}`,
  },
  {
    value: 'acompte_solde',
    label: 'Acompte 30% + solde',
    short: 'Idéal pour les gros chantiers',
    body: `Acompte de 30 % à la signature du devis. Solde à la fin des travaux, payable à 30 jours nets à compter de la date d'émission de la facture finale.\n\n${PAYMENT_TERMS_LEGAL_MENTIONS}`,
  },
];

export const DEFAULT_PAYMENT_TERMS_BODY = PAYMENT_TERMS_PRESETS[0].body;

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
  mentions_legales: 'Devis valable 30 jours. En cas de litige, le tribunal compétent sera celui du siège social du prestataire.',
  payment_terms: DEFAULT_PAYMENT_TERMS_BODY,
  payment_terms_preset: '30j_net',
  payment_terms_on_quotes: true,
  payment_terms_on_invoices: true,
};

export const TEMPLATE_PRESETS: { value: string; label: string; description: string; colors: { primary: string; secondary: string } }[] = [
  {
    value: 'classique',
    label: 'Classique',
    description: 'Sobre et professionnel, idéal pour le BTP',
    colors: { primary: '#d35400', secondary: '#1a1a1a' },
  },
  {
    value: 'moderne',
    label: 'Moderne',
    description: 'Design épuré avec touches de couleur',
    colors: { primary: '#2563eb', secondary: '#0f172a' },
  },
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Très simple, tout en noir et blanc',
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
