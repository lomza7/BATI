export const WORKSPACE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'chef_equipe', label: "Chef d'équipe" },
  { value: 'commercial', label: 'Commercial' },
  { value: 'assistante', label: 'Assistante' },
  { value: 'conducteur_travaux', label: 'Conducteur de travaux' },
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLE_OPTIONS)[number]['value'];

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: 'Admin',
  chef_equipe: "Chef d'équipe",
  commercial: 'Commercial',
  assistante: 'Assistante',
  conducteur_travaux: 'Conducteur de travaux',
};

export const WORKSPACE_STATUS_LABELS = {
  pending: 'Invitation en attente',
  active: 'Actif',
  revoked: 'Accès retiré',
} as const;

export type WorkspaceStatus = keyof typeof WORKSPACE_STATUS_LABELS;

// ---------------------------------------------------------------------------
// Permissions — controle d'acces par section pour les membres d'equipe
// ---------------------------------------------------------------------------

export type WorkspacePermissionKey =
  | 'dashboard'
  | 'calendrier'
  | 'taches'
  | 'clients'
  | 'devis'
  | 'factures'
  | 'prestations'
  | 'chantiers'
  | 'planning'
  | 'carte'
  | 'equipe'
  | 'catalogues'
  | 'prospection'
  | 'site_web'
  | 'mail'
  | 'avis'
  | 'plans_rendus'
  | 'agents'
  | 'paiements'
  | 'contrats'
  | 'comptabilite'
  | 'parametres';

export type WorkspacePermissions = Record<WorkspacePermissionKey, boolean>;

export const DEFAULT_WORKSPACE_PERMISSIONS: WorkspacePermissions = {
  dashboard: true,
  calendrier: true,
  taches: true,
  clients: true,
  devis: true,
  factures: true,
  prestations: true,
  chantiers: true,
  planning: true,
  carte: true,
  equipe: true,
  catalogues: true,
  prospection: true,
  site_web: true,
  mail: true,
  avis: true,
  plans_rendus: true,
  agents: true,
  paiements: true,
  contrats: true,
  comptabilite: true,
  parametres: true,
};

export const WORKSPACE_PERMISSION_LABELS: Record<WorkspacePermissionKey, string> = {
  dashboard: 'Tableau de bord',
  calendrier: 'Calendrier',
  taches: 'Tâches',
  clients: 'Contacts',
  devis: 'Devis',
  factures: 'Factures',
  prestations: 'Prestations',
  chantiers: 'Chantiers',
  planning: 'Planning',
  carte: 'Carte',
  equipe: 'Équipe',
  catalogues: 'Catalogues',
  prospection: 'Prospection',
  site_web: 'Site web IA',
  mail: 'Boîte mail',
  avis: 'Avis Google',
  plans_rendus: 'Plans & Rendus IA',
  agents: 'Agents IA',
  paiements: 'Paiements',
  contrats: 'Contrats récurrents',
  comptabilite: 'Comptabilité IA',
  parametres: 'Paramètres',
};

export const WORKSPACE_PERMISSION_GROUPS: { title: string; keys: WorkspacePermissionKey[] }[] = [
  { title: 'Principal', keys: ['dashboard', 'calendrier', 'taches', 'clients', 'devis', 'factures', 'prestations'] },
  { title: 'Chantiers', keys: ['chantiers', 'planning', 'carte', 'equipe'] },
  { title: 'Commercial', keys: ['catalogues', 'prospection'] },
  { title: 'Communication', keys: ['mail', 'avis'] },
  { title: 'IA', keys: ['agents', 'plans_rendus', 'site_web'] },
  { title: 'Finance', keys: ['paiements', 'contrats', 'comptabilite'] },
  { title: 'Système', keys: ['parametres'] },
];

/** Map route paths to permission keys */
const ROUTE_PERMISSION_MAP: Record<string, WorkspacePermissionKey> = {
  '/dashboard': 'dashboard',
  '/calendrier': 'calendrier',
  '/taches': 'taches',
  '/clients': 'clients',
  '/devis': 'devis',
  '/factures': 'factures',
  '/prestations': 'prestations',
  '/chantiers': 'chantiers',
  '/planning': 'planning',
  '/carte': 'carte',
  '/equipe': 'equipe',
  '/catalogues': 'catalogues',
  '/prospection': 'prospection',
  '/site-web': 'site_web',
  '/mail': 'mail',
  '/avis': 'avis',
  '/plans': 'plans_rendus',
  '/rendus': 'plans_rendus',
  '/agents': 'agents',
  '/paiements': 'paiements',
  '/contrats': 'contrats',
  '/comptabilite': 'comptabilite',
  '/parametres': 'parametres',
};

/** Returns the permission key for a given route, or null if no restriction applies */
export function getPermissionKeyForRoute(pathname: string): WorkspacePermissionKey | null {
  for (const [route, key] of Object.entries(ROUTE_PERMISSION_MAP)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return key;
    }
  }
  return null;
}

/** Safely parse permissions from DB, falling back to defaults for missing keys */
export function parseWorkspacePermissions(raw: unknown): WorkspacePermissions {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_WORKSPACE_PERMISSIONS };
  const parsed = raw as Record<string, unknown>;
  const result = { ...DEFAULT_WORKSPACE_PERMISSIONS };
  for (const key of Object.keys(DEFAULT_WORKSPACE_PERMISSIONS) as WorkspacePermissionKey[]) {
    if (typeof parsed[key] === 'boolean') {
      result[key] = parsed[key] as boolean;
    }
  }
  return result;
}

export function canManageWorkspaceTeam(role: string | null | undefined) {
  return role === 'owner' || role === 'admin';
}

export function formatWorkspacePathLabel(path: string | null | undefined) {
  if (!path) return 'Aucune page récente';

  const cleaned = path.replace(/\?.*$/, '');
  const labels: Record<string, string> = {
    '/dashboard': 'Tableau de bord',
    '/clients': 'Contacts',
    '/devis': 'Devis',
    '/factures': 'Factures',
    '/chantiers': 'Chantiers',
    '/planning': 'Planning',
    '/prospection': 'Prospection',
    '/equipe': 'Équipe',
    '/parametres': 'Paramètres',
    '/mail': 'Boîte mail',
    '/avis': 'Avis Google',
  };

  if (labels[cleaned]) {
    return labels[cleaned];
  }

  return cleaned
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/-/g, ' '))
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' / ');
}
