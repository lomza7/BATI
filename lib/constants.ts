export const QUOTE_STATUSES = {
  brouillon: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700' },
  envoye: { label: 'Envoye', color: 'bg-blue-50 text-blue-700' },
  accepte: { label: 'Accepte', color: 'bg-emerald-50 text-emerald-700' },
  refuse: { label: 'Refuse', color: 'bg-red-50 text-red-700' },
  expire: { label: 'Expire', color: 'bg-amber-50 text-amber-700' },
} as const;

export const INVOICE_STATUSES = {
  brouillon: { label: 'Brouillon', color: 'bg-slate-100 text-slate-700' },
  creee: { label: 'Créée', color: 'bg-violet-50 text-violet-700' },
  envoyee: { label: 'Envoyée', color: 'bg-blue-50 text-blue-700' },
  payee: { label: 'Payée', color: 'bg-emerald-50 text-emerald-700' },
  en_retard: { label: 'En retard', color: 'bg-red-50 text-red-700' },
  annulee: { label: 'Annulée', color: 'bg-slate-100 text-slate-500' },
} as const;

export const PROJECT_STATUSES = {
  a_planifier: { label: 'A planifier', color: 'bg-slate-100 text-slate-700' },
  en_cours: { label: 'En cours', color: 'bg-blue-50 text-blue-700' },
  termine: { label: 'Termine', color: 'bg-emerald-50 text-emerald-700' },
  en_pause: { label: 'En pause', color: 'bg-amber-50 text-amber-700' },
} as const;

export interface ProjectPhase {
  key: string;
  label: string;
  weight: number;
}

export const DEFAULT_PROJECT_PHASES: ProjectPhase[] = [
  { key: 'devis_signe', label: 'Devis signé', weight: 5 },
  { key: 'acompte_demande', label: 'Acompte demandé', weight: 5 },
  { key: 'acompte_paye', label: 'Acompte payé', weight: 5 },
  { key: 'demarrage', label: 'Démarrage du chantier', weight: 10 },
  { key: 'avancement_25', label: 'Avancement 25%', weight: 15 },
  { key: 'avancement_50', label: 'Avancement 50%', weight: 15 },
  { key: 'facture_intermediaire', label: 'Facture intermédiaire envoyée', weight: 5 },
  { key: 'avancement_75', label: 'Avancement 75%', weight: 15 },
  { key: 'travaux_termines', label: 'Travaux terminés', weight: 10 },
  { key: 'facture_solde', label: 'Facture de solde envoyée', weight: 5 },
  { key: 'solde_paye', label: 'Solde payé — Réception', weight: 10 },
];

export const LEAD_STAGES = {
  nouveau: { label: 'Nouveau', color: 'bg-slate-100 text-slate-700' },
  contacte: { label: 'Contacte', color: 'bg-blue-50 text-blue-700' },
  devis_envoye: { label: 'Devis envoye', color: 'bg-amber-50 text-amber-700' },
  negocie: { label: 'En nego', color: 'bg-orange-50 text-orange-700' },
  gagne: { label: 'Gagne', color: 'bg-emerald-50 text-emerald-700' },
  perdu: { label: 'Perdu', color: 'bg-red-50 text-red-700' },
} as const;

export const CONTRACT_TYPES = {
  chaudiere: { label: 'Chaudiere', icon: 'Flame' },
  clim: { label: 'Climatisation', icon: 'Wind' },
  piscine: { label: 'Piscine', icon: 'Waves' },
  autre: { label: 'Autre', icon: 'FileText' },
} as const;

export const EXPENSE_CATEGORIES = {
  materiaux: { label: 'Materiaux', color: 'bg-blue-50 text-blue-700' },
  sous_traitance: { label: 'Sous-traitance', color: 'bg-amber-50 text-amber-700' },
  deplacement: { label: 'Deplacement', color: 'bg-emerald-50 text-emerald-700' },
  assurance: { label: 'Assurance', color: 'bg-red-50 text-red-700' },
  autre: { label: 'Autre', color: 'bg-slate-100 text-slate-700' },
} as const;

export const CONTACT_TYPES = {
  client: { label: 'Client', color: 'bg-blue-50 text-blue-700' },
  prospect: { label: 'Prospect', color: 'bg-amber-50 text-amber-700' },
  prestataire: { label: 'Prestataire', color: 'bg-purple-50 text-purple-700' },
} as const;

export const MEMBER_TYPES = {
  salarie: { label: 'Salarie', color: 'bg-blue-50 text-blue-700' },
  sous_traitant: { label: 'Sous-traitant', color: 'bg-amber-50 text-amber-700' },
  interimaire: { label: 'Interimaire', color: 'bg-purple-50 text-purple-700' },
} as const;

export const MEMBER_STATUSES = {
  actif: { label: 'Actif', color: 'bg-emerald-50 text-emerald-700' },
  inactif: { label: 'Inactif', color: 'bg-slate-100 text-slate-500' },
} as const;

export const SPECIALTIES = [
  'Maconnerie',
  'Plomberie',
  'Electricite',
  'Peinture',
  'Carrelage',
  'Menuiserie',
  'Couverture',
  'Placo / Platrerie',
  'Chauffage / Clim',
  'Terrassement',
  'Charpente',
  'Serrurerie',
  'Autre',
] as const;

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}
