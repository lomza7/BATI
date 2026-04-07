import { supabase } from '@/lib/supabase';
import {
  PROJECT_TRASH_RETENTION_DAYS,
  getProjectTrashExpiryDate,
  getRemainingTrashDays,
  moveProjectToTrash,
  permanentlyDeleteProject,
  purgeExpiredDeletedProjects,
  restoreProjectFromTrash,
} from '@/lib/project-trash';

export type RecycleEntityType = 'project' | 'quote' | 'todo' | 'client' | 'service' | 'catalog' | 'lead';

export interface RecycleBinItem {
  id: string;
  type: RecycleEntityType;
  title: string;
  subtitle: string;
  deleted_at: string;
  meta?: string | null;
}

const ENTITY_CONFIG: Record<
  Exclude<RecycleEntityType, 'project'>,
  {
    table: 'quotes' | 'todos' | 'clients' | 'services' | 'catalogs' | 'leads';
    label: string;
    hasUpdatedAt: boolean;
  }
> = {
  quote: { table: 'quotes', label: 'Devis', hasUpdatedAt: true },
  todo: { table: 'todos', label: 'Tache', hasUpdatedAt: true },
  client: { table: 'clients', label: 'Contact', hasUpdatedAt: false },
  service: { table: 'services', label: 'Prestation', hasUpdatedAt: true },
  catalog: { table: 'catalogs', label: 'Catalogue', hasUpdatedAt: true },
  lead: { table: 'leads', label: 'Prospect', hasUpdatedAt: true },
};

export const RECYCLE_ENTITY_LABELS: Record<RecycleEntityType, string> = {
  project: 'Chantier',
  quote: 'Devis',
  todo: 'Tache',
  client: 'Contact',
  service: 'Prestation',
  catalog: 'Catalogue',
  lead: 'Prospect',
};

export { PROJECT_TRASH_RETENTION_DAYS, getProjectTrashExpiryDate, getRemainingTrashDays };

function getConfig(type: Exclude<RecycleEntityType, 'project'>) {
  return ENTITY_CONFIG[type];
}

async function softDeleteSimpleEntity(type: Exclude<RecycleEntityType, 'project'>, id: string, userId: string) {
  const { table, hasUpdatedAt } = getConfig(type);
  const payload: Record<string, string | null> = {
    deleted_at: new Date().toISOString(),
    deleted_by: userId,
  };
  if (hasUpdatedAt) {
    payload.updated_at = new Date().toISOString();
  }

  return supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .is('deleted_at', null);
}

async function restoreSimpleEntity(type: Exclude<RecycleEntityType, 'project'>, id: string) {
  const { table, hasUpdatedAt } = getConfig(type);
  const payload: Record<string, string | null> = {
    deleted_at: null,
    deleted_by: null,
  };
  if (hasUpdatedAt) {
    payload.updated_at = new Date().toISOString();
  }

  return supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .not('deleted_at', 'is', null);
}

async function permanentlyDeleteQuote(id: string) {
  const { error: invoicesError } = await supabase
    .from('invoices')
    .update({ quote_id: null })
    .eq('quote_id', id);
  if (invoicesError) throw invoicesError;

  const { error: projectsError } = await supabase
    .from('projects')
    .update({ quote_id: null })
    .eq('quote_id', id);
  if (projectsError) throw projectsError;

  const { error: contractsError } = await supabase
    .from('recurring_contracts')
    .update({ quote_id: null })
    .eq('quote_id', id);
  if (contractsError) throw contractsError;

  const { error: leadsError } = await supabase
    .from('leads')
    .update({ quote_id: null })
    .eq('quote_id', id);
  if (leadsError) throw leadsError;

  const { error } = await supabase.from('quotes').delete().eq('id', id).not('deleted_at', 'is', null);
  if (error) throw error;
}

async function permanentlyDeleteClient(id: string) {
  const updates = await Promise.all([
    supabase.from('quotes').update({ client_id: null }).eq('client_id', id),
    supabase.from('invoices').update({ client_id: null }).eq('client_id', id),
    supabase.from('projects').update({ client_id: null }).eq('client_id', id),
    supabase.from('recurring_contracts').update({ client_id: null }).eq('client_id', id),
    supabase.from('leads').update({ client_id: null }).eq('client_id', id),
    supabase.from('todos').update({ client_id: null }).eq('client_id', id),
    supabase.from('calendar_events').update({ client_id: null }).eq('client_id', id),
  ]);

  for (const result of updates) {
    if (result.error) throw result.error;
  }

  const { error } = await supabase.from('clients').delete().eq('id', id).not('deleted_at', 'is', null);
  if (error) throw error;
}

async function permanentlyDeleteSimple(type: Exclude<RecycleEntityType, 'project' | 'quote' | 'client'>, id: string) {
  const { table } = getConfig(type);
  const { error } = await supabase.from(table).delete().eq('id', id).not('deleted_at', 'is', null);
  if (error) throw error;
}

export async function moveEntityToTrash(type: RecycleEntityType, id: string, userId: string) {
  if (type === 'project') {
    return moveProjectToTrash(id, userId);
  }

  return softDeleteSimpleEntity(type, id, userId);
}

export async function restoreEntityFromTrash(type: RecycleEntityType, id: string) {
  if (type === 'project') {
    return restoreProjectFromTrash(id);
  }

  return restoreSimpleEntity(type, id);
}

export async function permanentlyDeleteEntity(type: RecycleEntityType, id: string) {
  if (type === 'project') {
    return permanentlyDeleteProject(id);
  }

  if (type === 'quote') {
    return permanentlyDeleteQuote(id);
  }

  if (type === 'client') {
    return permanentlyDeleteClient(id);
  }

  return permanentlyDeleteSimple(type, id);
}

export async function purgeExpiredRecycleBinItems() {
  const cutoff = new Date(Date.now() - PROJECT_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let purgedCount = 0;

  purgedCount += await purgeExpiredDeletedProjects();

  const simpleTypes: Exclude<RecycleEntityType, 'project'>[] = ['quote', 'todo', 'client', 'service', 'catalog', 'lead'];
  for (const type of simpleTypes) {
    const { table } = getConfig(type);
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .not('deleted_at', 'is', null)
      .lte('deleted_at', cutoff)
      .order('deleted_at', { ascending: true })
      .limit(25);

    if (error) {
      throw error;
    }

    for (const row of data || []) {
      try {
        await permanentlyDeleteEntity(type, row.id);
        purgedCount += 1;
      } catch (deleteError) {
        console.error('Erreur purge corbeille:', type, deleteError);
      }
    }
  }

  return purgedCount;
}
