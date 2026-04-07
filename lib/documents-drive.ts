import { supabase } from '@/lib/supabase';

export type DocumentFolderSource = 'manual' | 'project';
export type DocumentStorageBucket = 'documents' | 'project-photos';

interface MinimalFolder {
  id: string;
  name: string;
}

function buildAvailableFolderName(baseName: string, folders: MinimalFolder[], excludeId?: string) {
  const trimmedBaseName = baseName.trim() || 'Chantier';
  const taken = new Set(
    folders
      .filter((folder) => folder.id !== excludeId)
      .map((folder) => folder.name.trim().toLocaleLowerCase('fr-FR'))
  );

  if (!taken.has(trimmedBaseName.toLocaleLowerCase('fr-FR'))) {
    return trimmedBaseName;
  }

  let counter = 2;
  let candidate = `${trimmedBaseName} (${counter})`;

  while (taken.has(candidate.toLocaleLowerCase('fr-FR'))) {
    counter += 1;
    candidate = `${trimmedBaseName} (${counter})`;
  }

  return candidate;
}

export function sanitizeDocumentFileName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function ensureProjectDocumentsFolder(projectId: string, projectName: string, userId: string) {
  const [{ data: existingFolder }, { data: rootFolders, error: rootFoldersError }] = await Promise.all([
    supabase
      .from('document_folders')
      .select('id, name')
      .eq('project_id', projectId)
      .eq('source', 'project')
      .maybeSingle(),
    supabase
      .from('document_folders')
      .select('id, name')
      .is('parent_id', null),
  ]);

  if (rootFoldersError) {
    throw rootFoldersError;
  }

  const availableName = buildAvailableFolderName(
    projectName,
    ((rootFolders as MinimalFolder[]) || []),
    existingFolder?.id || undefined
  );

  if (existingFolder?.id) {
    if (existingFolder.name !== availableName) {
      const { error } = await supabase
        .from('document_folders')
        .update({ name: availableName, updated_at: new Date().toISOString() })
        .eq('id', existingFolder.id);

      if (error) throw error;
    }

    return existingFolder.id;
  }

  const { data, error } = await supabase
    .from('document_folders')
    .insert({
      user_id: userId,
      parent_id: null,
      project_id: projectId,
      source: 'project' satisfies DocumentFolderSource,
      visibility: 'workspace',
      name: availableName,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Impossible de creer le dossier chantier.');
  }

  return data.id as string;
}

interface SyncProjectPhotoInput {
  userId: string;
  projectId: string;
  projectName: string;
  projectPhotoId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}

export async function syncProjectPhotoIntoDocuments(input: SyncProjectPhotoInput) {
  const folderId = await ensureProjectDocumentsFolder(input.projectId, input.projectName, input.userId);

  const existing = await supabase
    .from('document_files')
    .select('id')
    .eq('project_photo_id', input.projectPhotoId)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  const payload = {
    user_id: input.userId,
    folder_id: folderId,
    project_id: input.projectId,
    project_photo_id: input.projectPhotoId,
    storage_bucket: 'project-photos' satisfies DocumentStorageBucket,
    visibility: 'workspace',
    name: input.fileName,
    original_name: input.fileName,
    mime_type: input.mimeType || 'image/jpeg',
    size_bytes: input.sizeBytes,
    storage_path: input.storagePath,
    updated_at: new Date().toISOString(),
  };

  if (existing.data?.id) {
    const { error } = await supabase
      .from('document_files')
      .update(payload)
      .eq('id', existing.data.id);
    if (error) throw error;
    return existing.data.id;
  }

  const { data, error } = await supabase
    .from('document_files')
    .insert(payload)
    .select('id')
    .single();

  if (error || !data?.id) {
    throw error || new Error('Impossible de synchroniser la photo chantier dans Mes documents.');
  }

  return data.id as string;
}
