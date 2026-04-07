import { supabase } from '@/lib/supabase';

export const PROJECT_TRASH_RETENTION_DAYS = 30;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface ProjectPhotoForCleanup {
  id: string;
  url: string;
}

interface DeletedProjectForCleanup {
  id: string;
  name: string;
  deleted_at: string | null;
  project_photos: ProjectPhotoForCleanup[];
}

interface ProjectDocumentForCleanup {
  storage_path: string;
  storage_bucket: string;
}

export function extractProjectPhotoPath(url: string) {
  const marker = '/storage/v1/object/public/project-photos/';
  const index = url.indexOf(marker);
  if (index === -1) return null;

  return decodeURIComponent(url.slice(index + marker.length));
}

export function getProjectTrashExpiryDate(deletedAt: string) {
  return new Date(new Date(deletedAt).getTime() + PROJECT_TRASH_RETENTION_DAYS * DAY_IN_MS);
}

export function getRemainingTrashDays(deletedAt: string) {
  const diff = getProjectTrashExpiryDate(deletedAt).getTime() - Date.now();
  if (diff <= 0) return 0;

  return Math.ceil(diff / DAY_IN_MS);
}

export async function moveProjectToTrash(projectId: string, userId: string) {
  return supabase
    .from('projects')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .is('deleted_at', null);
}

export async function restoreProjectFromTrash(projectId: string) {
  return supabase
    .from('projects')
    .update({
      deleted_at: null,
      deleted_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .not('deleted_at', 'is', null);
}

export async function permanentlyDeleteProject(projectId: string) {
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, name, deleted_at, project_photos(id, url)')
    .eq('id', projectId)
    .not('deleted_at', 'is', null)
    .single();

  if (projectError) {
    throw projectError;
  }

  const typedProject = project as unknown as DeletedProjectForCleanup;
  const storagePaths = (typedProject.project_photos || [])
    .map((photo) => extractProjectPhotoPath(photo.url))
    .filter((path): path is string => Boolean(path));

  const { data: projectDocuments, error: documentsError } = await supabase
    .from('document_files')
    .select('storage_path, storage_bucket')
    .eq('project_id', projectId)
    .eq('storage_bucket', 'documents');

  if (documentsError) {
    throw documentsError;
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage.from('project-photos').remove(storagePaths);
    if (storageError) {
      console.error('Erreur suppression photos corbeille:', storageError);
    }
  }

  const documentStoragePaths = ((projectDocuments as ProjectDocumentForCleanup[]) || [])
    .map((document) => document.storage_path)
    .filter(Boolean);

  if (documentStoragePaths.length > 0) {
    const { error: documentsStorageError } = await supabase.storage.from('documents').remove(documentStoragePaths);
    if (documentsStorageError) {
      console.error('Erreur suppression documents chantier:', documentsStorageError);
    }
  }

  const { error: planningError } = await supabase
    .from('planning_events')
    .update({ project_id: null })
    .eq('project_id', projectId);
  if (planningError) {
    throw planningError;
  }

  const { error: reviewsError } = await supabase
    .from('reviews')
    .update({ project_id: null })
    .eq('project_id', projectId);
  if (reviewsError) {
    throw reviewsError;
  }

  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .not('deleted_at', 'is', null);
  if (deleteError) {
    throw deleteError;
  }

  return typedProject;
}

export async function purgeExpiredDeletedProjects() {
  const cutoff = new Date(Date.now() - PROJECT_TRASH_RETENTION_DAYS * DAY_IN_MS).toISOString();
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .not('deleted_at', 'is', null)
    .lte('deleted_at', cutoff)
    .order('deleted_at', { ascending: true })
    .limit(25);

  if (error) {
    throw error;
  }

  let purgedCount = 0;

  for (const project of data || []) {
    try {
      await permanentlyDeleteProject(project.id);
      purgedCount += 1;
    } catch (deleteError) {
      console.error('Erreur purge chantier corbeille:', deleteError);
    }
  }

  return purgedCount;
}
