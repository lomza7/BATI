export const WORKSPACE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'chef_equipe', label: "Chef d'equipe" },
  { value: 'commercial', label: 'Commercial' },
  { value: 'assistante', label: 'Assistante' },
  { value: 'conducteur_travaux', label: 'Conducteur de travaux' },
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLE_OPTIONS)[number]['value'];

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  admin: 'Admin',
  chef_equipe: "Chef d'equipe",
  commercial: 'Commercial',
  assistante: 'Assistante',
  conducteur_travaux: 'Conducteur de travaux',
};

export const WORKSPACE_STATUS_LABELS = {
  pending: 'Invitation en attente',
  active: 'Actif',
  revoked: 'Acces retire',
} as const;

export type WorkspaceStatus = keyof typeof WORKSPACE_STATUS_LABELS;

export function canManageWorkspaceTeam(role: string | null | undefined) {
  return role === 'owner' || role === 'admin';
}

export function formatWorkspacePathLabel(path: string | null | undefined) {
  if (!path) return 'Aucune page recente';

  const cleaned = path.replace(/\?.*$/, '');
  const labels: Record<string, string> = {
    '/dashboard': 'Tableau de bord',
    '/clients': 'Contacts',
    '/devis': 'Devis',
    '/factures': 'Factures',
    '/chantiers': 'Chantiers',
    '/planning': 'Planning',
    '/prospection': 'Prospection',
    '/equipe': 'Equipe',
    '/parametres': 'Parametres',
    '/mail': 'Boite mail',
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
