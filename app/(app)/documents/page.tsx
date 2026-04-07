'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  File,
  FileImage,
  FolderOpen,
  FolderPlus,
  Globe,
  Lock,
  Loader2,
  MoreVertical,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useWorkspace } from '@/hooks/use-workspace';
import { sanitizeDocumentFileName } from '@/lib/documents-drive';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/constants';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Visibility = 'private' | 'workspace';

interface DocumentFolder {
  id: string;
  user_id: string;
  parent_id: string | null;
  project_id: string | null;
  source: 'manual' | 'project';
  visibility: Visibility;
  name: string;
  created_at: string;
  updated_at: string;
}

interface DocumentFile {
  id: string;
  user_id: string;
  folder_id: string | null;
  project_id: string | null;
  project_photo_id: string | null;
  storage_bucket: 'documents' | 'project-photos';
  visibility: Visibility;
  name: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  created_at: string;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o';
  const units = ['o', 'Ko', 'Mo', 'Go'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function isImageMime(mime: string) {
  return mime.startsWith('image/');
}

function totalSize(files: DocumentFile[]) {
  return files.reduce((sum, f) => sum + f.size_bytes, 0);
}

/* ------------------------------------------------------------------ */
/*  Visibility badge                                                   */
/* ------------------------------------------------------------------ */

function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  if (visibility === 'workspace') {
    return (
      <Badge variant="outline" className="gap-1 text-xs font-normal text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400">
        <Globe className="h-3 w-3" />
        Partagé
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-xs font-normal text-muted-foreground">
      <Lock className="h-3 w-3" />
      Privé
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DocumentsPage() {
  const { user } = useAuth();
  const { workspaceUserId, loading: workspaceLoading } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);

  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Dialogs
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);

  // Navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const ownerId = workspaceUserId || user?.id || null;

  /* ---- Data loading ---- */

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const [foldersRes, filesRes] = await Promise.all([
        supabase.from('document_folders').select('*').order('name'),
        supabase.from('document_files').select('*').order('created_at', { ascending: false }),
      ]);
      if (foldersRes.error) throw foldersRes.error;
      if (filesRes.error) throw filesRes.error;

      setFolders((foldersRes.data as DocumentFolder[]) || []);
      setFiles((filesRes.data as DocumentFile[]) || []);
      setCurrentFolderId((prev) =>
        prev && !(foldersRes.data || []).some((f: DocumentFolder) => f.id === prev) ? null : prev
      );
    } catch (err) {
      console.error('Erreur chargement documents:', err);
      setFolders([]);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || workspaceLoading) return;
    void loadDocuments();
  }, [user, workspaceLoading, loadDocuments]);

  /* ---- Derived state ---- */

  const folderMap = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);

  const breadcrumbs = useMemo(() => {
    if (!currentFolderId) return [];
    const chain: DocumentFolder[] = [];
    let cursor: string | null = currentFolderId;
    while (cursor) {
      const f = folderMap.get(cursor);
      if (!f) break;
      chain.unshift(f);
      cursor = f.parent_id;
    }
    return chain;
  }, [currentFolderId, folderMap]);

  const visibleFolders = useMemo(
    () => folders.filter((f) => f.parent_id === currentFolderId).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [folders, currentFolderId]
  );

  const visibleFiles = useMemo(
    () => files.filter((f) => f.folder_id === currentFolderId).sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [files, currentFolderId]
  );

  const currentFolder = currentFolderId ? folderMap.get(currentFolderId) || null : null;

  /* ---- Image previews ---- */

  useEffect(() => {
    const missing = visibleFiles.filter((f) => isImageMime(f.mime_type) && !previewUrls[f.id]);
    if (missing.length === 0) return;
    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        missing.map(async (file) => {
          let url: string | null = null;
          if (file.storage_bucket === 'project-photos') {
            url = supabase.storage.from('project-photos').getPublicUrl(file.storage_path).data.publicUrl;
          } else {
            const { data } = await supabase.storage.from('documents').createSignedUrl(file.storage_path, 3600);
            url = data?.signedUrl || null;
          }
          return url ? ([file.id, url] as const) : null;
        })
      );
      if (cancelled) return;
      setPreviewUrls((prev) => {
        const next = { ...prev };
        for (const e of entries) if (e) next[e[0]] = e[1];
        return next;
      });
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFiles.map((f) => f.id).join(',')]);

  /* ---- Actions ---- */

  async function createFolder() {
    const trimmed = folderName.trim();
    if (!trimmed || !ownerId) return;
    setActionKey('create-folder');
    try {
      const { error } = await supabase.from('document_folders').insert({
        user_id: ownerId,
        parent_id: currentFolderId,
        project_id: currentFolder?.project_id || null,
        source: 'manual',
        visibility: 'private',
        name: trimmed,
      });
      if (error) throw error;
      setFolderName('');
      setShowCreateFolder(false);
      toast({ title: `Dossier « ${trimmed} » créé` });
      await loadDocuments();
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de créer ce dossier. Vérifiez si un dossier du même nom existe déjà.', variant: 'destructive' });
    } finally {
      setActionKey(null);
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    if (!ownerId) return;
    const list = Array.from(fileList);
    if (list.length === 0) return;

    setUploading(true);
    let failedCount = 0;

    for (const file of list) {
      const safeName = sanitizeDocumentFileName(file.name || 'document');
      const filePath = `${ownerId}/${currentFolderId || 'root'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      try {
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (uploadError) throw uploadError;

        const { error: insertError } = await supabase.from('document_files').insert({
          user_id: ownerId,
          folder_id: currentFolderId,
          project_id: currentFolder?.project_id || null,
          storage_bucket: 'documents',
          visibility: 'private',
          name: file.name,
          original_name: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          storage_path: filePath,
        });
        if (insertError) {
          await supabase.storage.from('documents').remove([filePath]);
          throw insertError;
        }
      } catch {
        failedCount += 1;
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    await loadDocuments();

    if (failedCount > 0) {
      toast({ title: 'Erreur', description: `${failedCount} fichier(s) n'ont pas pu être importés.`, variant: 'destructive' });
    } else {
      toast({ title: `${list.length} fichier(s) importé(s)` });
    }
  }

  async function handleDownload(file: DocumentFile) {
    setActionKey(`dl:${file.id}`);
    try {
      const { data, error } = await supabase.storage.from(file.storage_bucket).download(file.storage_path);
      if (error || !data) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name || file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de télécharger ce document.', variant: 'destructive' });
    } finally {
      setActionKey(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { type, id, name } = deleteTarget;
    setActionKey(`delete:${id}`);

    try {
      if (type === 'file') {
        const file = files.find((f) => f.id === id);
        if (!file) return;
        const { error: storageErr } = await supabase.storage.from(file.storage_bucket).remove([file.storage_path]);
        if (storageErr) throw storageErr;
        if (file.project_photo_id) {
          const { error } = await supabase.from('project_photos').delete().eq('id', file.project_photo_id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('document_files').delete().eq('id', id);
          if (error) throw error;
        }
      } else {
        const hasChildren = folders.some((f) => f.parent_id === id);
        const hasFiles = files.some((f) => f.folder_id === id);
        if (hasChildren || hasFiles) {
          toast({ title: 'Dossier non vide', description: 'Videz le dossier avant de le supprimer.', variant: 'destructive' });
          return;
        }
        const { error } = await supabase.from('document_folders').delete().eq('id', id);
        if (error) throw error;
      }
      toast({ title: `« ${name} » supprimé` });
      await loadDocuments();
    } catch {
      toast({ title: 'Erreur', description: `Impossible de supprimer « ${name} ».`, variant: 'destructive' });
    } finally {
      setActionKey(null);
      setDeleteTarget(null);
    }
  }

  async function handleRename() {
    if (!renameTarget) return;
    const newName = renameTarget.name.trim();
    if (!newName) return;
    setActionKey(`rename:${renameTarget.id}`);
    try {
      const table = renameTarget.type === 'folder' ? 'document_folders' : 'document_files';
      const updates: Record<string, string> = { name: newName, updated_at: new Date().toISOString() };
      if (renameTarget.type === 'file') updates.original_name = newName;
      const { error } = await supabase.from(table).update(updates).eq('id', renameTarget.id);
      if (error) throw error;
      toast({ title: 'Renommé avec succès' });
      setRenameTarget(null);
      await loadDocuments();
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de renommer cet élément.', variant: 'destructive' });
    } finally {
      setActionKey(null);
    }
  }

  async function toggleVisibility(type: 'folder' | 'file', id: string, current: Visibility) {
    const next: Visibility = current === 'private' ? 'workspace' : 'private';
    const table = type === 'folder' ? 'document_folders' : 'document_files';
    try {
      const { error } = await supabase.from(table).update({ visibility: next, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      toast({ title: next === 'workspace' ? 'Partagé avec l\'équipe' : 'Remis en privé' });
      await loadDocuments();
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de modifier la visibilité.', variant: 'destructive' });
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
  }

  /* ---- Render ---- */

  const itemCount = visibleFolders.length + visibleFiles.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Mes documents"
        description="Votre drive pour classer vos dossiers, images et fichiers de travail."
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCreateFolder(true)}>
            <FolderPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouveau dossier</span>
            <span className="sm:hidden">Dossier</span>
          </Button>
          <Button size="sm" className="gap-2" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importer
          </Button>
        </div>
      </PageHeader>

      <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); }} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Dossiers</p>
            <p className="mt-1 text-xl sm:text-2xl font-semibold">{folders.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Fichiers</p>
            <p className="mt-1 text-xl sm:text-2xl font-semibold">{files.length}</p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-muted-foreground">Taille totale</p>
            <p className="mt-1 text-xl sm:text-2xl font-semibold">{formatFileSize(totalSize(files))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-sm text-muted-foreground overflow-x-auto">
        <button
          type="button"
          className={cn(
            'rounded-full px-3 py-1.5 text-xs sm:text-sm transition-colors whitespace-nowrap',
            currentFolderId ? 'bg-muted hover:text-foreground' : 'bg-primary text-primary-foreground'
          )}
          onClick={() => setCurrentFolderId(null)}
        >
          Racine
        </button>
        {breadcrumbs.map((folder) => (
          <div key={folder.id} className="flex items-center gap-1.5">
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <button
              type="button"
              className={cn(
                'rounded-full px-3 py-1.5 text-xs sm:text-sm transition-colors whitespace-nowrap max-w-[150px] sm:max-w-none truncate',
                currentFolderId === folder.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:text-foreground'
              )}
              onClick={() => setCurrentFolderId(folder.id)}
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={cn(
          'rounded-2xl border-2 border-dashed p-4 sm:p-6 transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-border bg-card'
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm sm:text-base font-semibold text-foreground">
              Déposez vos fichiers ici
            </p>
            <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
              Images, PDF, tableurs, documents Word… tout arrive dans le dossier courant.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 self-start sm:self-auto" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Choisir des fichiers
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 sm:h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : itemCount === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Ce dossier est vide"
          description="Créez un dossier ou importez vos premiers documents pour commencer."
        />
      ) : (
        <div className="space-y-6">
          {/* Folders */}
          {visibleFolders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Dossiers</h2>
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {visibleFolders.map((folder) => (
                  <div
                    key={folder.id}
                    className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="flex flex-1 items-start gap-3 text-left min-w-0"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FolderOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-base font-semibold text-foreground truncate">{folder.name}</p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <VisibilityBadge visibility={folder.visibility} />
                            <span className="text-xs text-muted-foreground">
                              {folder.source === 'project' ? 'Chantier' : formatDate(folder.created_at)}
                            </span>
                          </div>
                        </div>
                      </button>

                      {folder.source !== 'project' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setRenameTarget({ type: 'folder', id: folder.id, name: folder.name })}>
                              <Pencil className="mr-2 h-4 w-4" /> Renommer
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void toggleVisibility('folder', folder.id, folder.visibility)}>
                              {folder.visibility === 'private' ? (
                                <><Eye className="mr-2 h-4 w-4" /> Partager avec l&apos;équipe</>
                              ) : (
                                <><EyeOff className="mr-2 h-4 w-4" /> Remettre en privé</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget({ type: 'folder', id: folder.id, name: folder.name })}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {visibleFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4 text-primary" />
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fichiers</h2>
              </div>
              <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {visibleFiles.map((file) => {
                  const isImage = isImageMime(file.mime_type);
                  const busy = actionKey?.startsWith(`dl:${file.id}`) || actionKey?.startsWith(`delete:${file.id}`);

                  return (
                    <div key={file.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                      {/* Preview */}
                      <div className="flex h-32 sm:h-40 items-center justify-center bg-muted/40">
                        {isImage && previewUrls[file.id] ? (
                          <div
                            role="img"
                            aria-label={file.name}
                            className="h-full w-full bg-cover bg-center"
                            style={{ backgroundImage: `url("${previewUrls[file.id]}")` }}
                          />
                        ) : isImage ? (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            {isImage ? <FileImage className="h-8 w-8 sm:h-10 sm:w-10" /> : <File className="h-8 w-8 sm:h-10 sm:w-10" />}
                            <span className="text-[10px] sm:text-xs uppercase tracking-widest">
                              {file.mime_type.split('/')[1] || 'fichier'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 sm:p-4 space-y-3">
                        <div>
                          <p className="line-clamp-1 text-sm font-semibold text-foreground">{file.name}</p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <VisibilityBadge visibility={file.visibility} />
                            <span className="text-xs text-muted-foreground">
                              {formatFileSize(file.size_bytes)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs"
                            disabled={!!busy}
                            onClick={() => void handleDownload(file)}
                          >
                            {actionKey === `dl:${file.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            Télécharger
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="px-2">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setRenameTarget({ type: 'file', id: file.id, name: file.name })}>
                                <Pencil className="mr-2 h-4 w-4" /> Renommer
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void toggleVisibility('file', file.id, file.visibility)}>
                                {file.visibility === 'private' ? (
                                  <><Eye className="mr-2 h-4 w-4" /> Partager avec l&apos;équipe</>
                                ) : (
                                  <><EyeOff className="mr-2 h-4 w-4" /> Remettre en privé</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget({ type: 'file', id: file.id, name: file.name })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Dialogs ---- */}

      {/* Create folder */}
      <Dialog open={showCreateFolder} onOpenChange={setShowCreateFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau dossier</DialogTitle>
            <DialogDescription>
              Créez un dossier pour organiser vos documents.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={folderName}
            placeholder="Ex. Contrats clients"
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createFolder(); } }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFolder(false)}>Annuler</Button>
            <Button onClick={() => void createFolder()} disabled={!folderName.trim() || actionKey === 'create-folder'}>
              {actionKey === 'create-folder' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
            <DialogDescription>Entrez un nouveau nom.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={renameTarget?.name || ''}
            onChange={(e) => setRenameTarget((prev) => prev ? { ...prev, name: e.target.value } : null)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleRename(); } }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Annuler</Button>
            <Button onClick={() => void handleRename()} disabled={!renameTarget?.name.trim() || !!actionKey}>
              {actionKey?.startsWith('rename:') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Renommer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment supprimer « {deleteTarget?.name} » ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
