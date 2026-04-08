'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Camera,
  CheckCircle2,
  Circle,
  CircleCheck,
  Clock,
  Clock3,
  FileText,
  Grid3x3 as LayoutGrid,
  HardHat,
  ImagePlus,
  List,
  Loader as Loader2,
  MapPin,
  MoveHorizontal as MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { INVOICE_STATUSES, DEFAULT_PROJECT_PHASES, MEMBER_TYPES, PROJECT_STATUSES, QUOTE_STATUSES, formatCurrency, formatDate, type ProjectPhase } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { extractProjectPhotoPath, moveProjectToTrash as moveProjectToTrashRecord } from '@/lib/project-trash';
import { useAuth } from '@/lib/auth-context';
import { useWorkspace } from '@/hooks/use-workspace';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { AddressAutocomplete, type AddressResult } from '@/components/shared/address-autocomplete';
import { ClientPicker } from '@/components/shared/client-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
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

type PhotoCategory = 'presentation' | 'avant' | 'pendant' | 'apres';

const PHOTO_CATEGORIES: { key: PhotoCategory; label: string }[] = [
  { key: 'presentation', label: 'Présentation' },
  { key: 'avant', label: 'Avant' },
  { key: 'pendant', label: 'Pendant' },
  { key: 'apres', label: 'Après' },
];

interface ProjectPhoto {
  id: string;
  url: string;
  caption: string | null;
  category: PhotoCategory;
  created_at: string;
}

interface ProjectQuote {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_ht: number;
  total_ttc: number;
  created_at: string;
}

interface ProjectInvoice {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  total_ht: number;
  total_ttc: number;
  due_date: string | null;
  paid_at: string | null;
  issued_at: string | null;
}

interface CompletedPhase {
  key: string;
  completed_at: string;
}

interface ProjectAssignment {
  member_id: string;
  member_name: string;
  member_type: string;
  specialty: string;
  hourly_rate: number;
  total_hours: number;
  total_cost: number;
  dates: string[];
}

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  address: string;
  city: string;
  status: keyof typeof PROJECT_STATUSES;
  progress: number;
  budget: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  notes: string | null;
  completed_phases: CompletedPhase[];
  clients: { name: string } | null;
  project_photos: ProjectPhoto[];
  trackedHours: number;
  plannedHours: number;
  plannedDays: number;
}

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
  category: PhotoCategory;
}

interface ProjectFormState {
  name: string;
  address: string;
  city: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  budget: string;
  start_date: string;
  end_date: string;
  notes: string;
}

const EMPTY_FORM: ProjectFormState = {
  name: '',
  address: '',
  city: '',
  postal_code: '',
  lat: null,
  lng: null,
  budget: '',
  start_date: '',
  end_date: '',
  notes: '',
};

function computeDurationDays(startDate: string | null, endDate: string | null) {
  if (!startDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate || new Date().toISOString());
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const diff = end.getTime() - start.getTime();
  if (Number.isNaN(diff) || diff < 0) return null;

  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

function formatDurationLabel(startDate: string | null, endDate: string | null) {
  const days = computeDurationDays(startDate, endDate);
  if (!days) return 'Aucune duree renseignee';
  if (endDate) return `${days} jour${days > 1 ? 's' : ''} au total`;
  return `En cours depuis ${days} jour${days > 1 ? 's' : ''}`;
}

function formatTrackedHours(hours: number) {
  if (!hours) return '0 h';

  const roundedHours = Math.round(hours * 10) / 10;
  const wholeHours = Math.floor(roundedHours);
  const minutes = Math.round((roundedHours - wholeHours) * 60);

  if (!wholeHours) return `${minutes} min`;
  if (!minutes) return `${wholeHours} h`;
  return `${wholeHours} h ${minutes.toString().padStart(2, '0')}`;
}

export default function ChantiersPage() {
  const { user } = useAuth();
  const { workspaceUserId } = useWorkspace();
  const router = useRouter();
  const ownerId = workspaceUserId || user?.id || null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailFileInputRef = useRef<HTMLInputElement>(null);
  const [detailUploading, setDetailUploading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showEditor, setShowEditor] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [editorPhotoTab, setEditorPhotoTab] = useState<PhotoCategory>('avant');
  const [detailPhotoTab, setDetailPhotoTab] = useState<PhotoCategory>('avant');
  const [dragOver, setDragOver] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ProjectPhoto[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [projectQuotes, setProjectQuotes] = useState<ProjectQuote[]>([]);
  const [projectInvoices, setProjectInvoices] = useState<ProjectInvoice[]>([]);
  const [projectAssignments, setProjectAssignments] = useState<ProjectAssignment[]>([]);
  const [userPhases, setUserPhases] = useState<ProjectPhase[]>(DEFAULT_PROJECT_PHASES);
  const [projectActionId, setProjectActionId] = useState<string | null>(null);

  useEffect(() => {
    void loadProjects();
    void loadPhasesConfig();
  }, []);

  async function loadPhasesConfig() {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('project_phases_config')
      .eq('id', user.id)
      .single();
    if (data?.project_phases_config && Array.isArray(data.project_phases_config) && data.project_phases_config.length > 0) {
      setUserPhases(data.project_phases_config as ProjectPhase[]);
    }
  }

  async function loadProjects() {
    setLoading(true);

    const [{ data: projectRows, error: projectsError }, { data: assignmentsRows, error: assignmentsError }, { data: planningRows }] =
      await Promise.all([
        supabase
          .from('projects')
          .select('id, client_id, name, address, city, status, progress, budget, start_date, end_date, created_at, notes, completed_phases, clients(name, deleted_at), project_photos(id, url, caption, category, created_at)')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('team_assignments').select('project_id, hours'),
        supabase.from('planning_events').select('project_id, start_date, end_date, half_day').eq('event_type', 'chantier').not('project_id', 'is', null),
      ]);

    if (projectsError) {
      console.error('Erreur chargement chantiers:', projectsError.message);
      setProjects([]);
      setLoading(false);
      return;
    }

    if (assignmentsError) {
      console.error('Erreur chargement temps chantier:', assignmentsError.message);
    }

    const hoursByProject = new Map<string, number>();
    (assignmentsRows || []).forEach((assignment) => {
      const projectId = assignment.project_id as string | null;
      const hours = Number(assignment.hours || 0);
      if (!projectId) return;
      hoursByProject.set(projectId, (hoursByProject.get(projectId) || 0) + hours);
    });

    // Calculate planned hours from planning_events
    const plannedByProject = new Map<string, { hours: number; days: Set<string> }>();
    (planningRows || []).forEach((pe: { project_id: string; start_date: string; end_date: string; half_day: string | null }) => {
      if (!pe.project_id) return;
      if (!plannedByProject.has(pe.project_id)) plannedByProject.set(pe.project_id, { hours: 0, days: new Set() });
      const entry = plannedByProject.get(pe.project_id)!;
      const hPerDay = (pe.half_day === 'am' || pe.half_day === 'pm') ? 4 : 8;
      let d = new Date(pe.start_date);
      const end = new Date(pe.end_date);
      while (d <= end) {
        const ds = d.toISOString().split('T')[0];
        entry.days.add(ds);
        entry.hours += hPerDay;
        d.setDate(d.getDate() + 1);
      }
    });

    const mappedProjects = ((projectRows as unknown as Project[]) || []).map((project) => {
      const planned = plannedByProject.get(project.id);
      const clientValue = Array.isArray(project.clients) ? project.clients[0] : project.clients;
      return {
        ...project,
        clients: clientValue && !(clientValue as { deleted_at?: string | null } | null)?.deleted_at
          ? { name: (clientValue as { name: string }).name }
          : null,
        notes: project.notes || '',
        completed_phases: Array.isArray(project.completed_phases) ? project.completed_phases : [],
        project_photos: [...(project.project_photos || [])].sort((a, b) => b.created_at.localeCompare(a.created_at)),
        trackedHours: Math.round((hoursByProject.get(project.id) || 0) * 10) / 10,
        plannedHours: planned ? Math.round(planned.hours * 10) / 10 : 0,
        plannedDays: planned ? planned.days.size : 0,
      };
    });

    setProjects(mappedProjects);
    setLoading(false);
  }

  function clearPendingPhotos() {
    setPendingPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
      return [];
    });
  }

  function resetEditorState() {
    setForm(EMPTY_FORM);
    setAddressQuery('');
    setClientId(null);
    setFormError('');
    setExistingPhotos([]);
    setRemovedPhotoIds([]);
    clearPendingPhotos();
  }

  function closeEditor() {
    setShowEditor(false);
    setSelectedProject(null);
    resetEditorState();
  }

  function openCreateEditor() {
    setEditorMode('create');
    setSelectedProject(null);
    resetEditorState();
    setShowEditor(true);
  }

  function openEditEditor(project: Project) {
    setEditorMode('edit');
    setSelectedProject(project);
    setForm({
      name: project.name,
      address: project.address || '',
      city: project.city || '',
      postal_code: '',
      lat: null,
      lng: null,
      budget: project.budget ? String(project.budget) : '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      notes: project.notes || '',
    });
    setAddressQuery(project.address ? `${project.address}${project.city ? `, ${project.city}` : ''}` : '');
    setClientId(project.client_id);
    setExistingPhotos(project.project_photos || []);
    clearPendingPhotos();
    setRemovedPhotoIds([]);
    setFormError('');
    setShowEditor(true);
  }

  async function openDetails(project: Project) {
    setSelectedProject(project);
    setProjectQuotes([]);
    setProjectInvoices([]);
    setProjectAssignments([]);
    setShowDetails(true);

    const [{ data: quotes }, { data: assignmentRows }, { data: planningRows }] = await Promise.all([
      supabase
        .from('quotes')
        .select('id, quote_number, title, status, total_ht, total_ttc, created_at')
        .eq('project_id', project.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('team_assignments')
        .select('team_member_id, date, hours, team_members(name, type, specialty, hourly_rate)')
        .eq('project_id', project.id)
        .order('date', { ascending: true }),
      supabase
        .from('planning_events')
        .select('team_member_id, start_date, end_date, half_day, team_members(name, type, specialty, hourly_rate)')
        .eq('project_id', project.id)
        .eq('event_type', 'chantier'),
    ]);

    const loadedQuotes = (quotes as ProjectQuote[]) || [];
    setProjectQuotes(loadedQuotes);

    if (loadedQuotes.length > 0) {
      const quoteIds = loadedQuotes.map(q => q.id);
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, title, status, total_ht, total_ttc, due_date, paid_at, issued_at')
        .in('quote_id', quoteIds)
        .order('created_at', { ascending: false });
      setProjectInvoices((invoices as ProjectInvoice[]) || []);
    }

    // Agréger les affectations par membre (team_assignments = heures pointees)
    const memberMap = new Map<string, ProjectAssignment>();
    ((assignmentRows as any[]) || []).forEach(row => {
      const memberId = row.team_member_id as string;
      const member = row.team_members as { name: string; type: string; specialty: string; hourly_rate: number } | null;
      const hours = Number(row.hours || 0);
      const date = row.date as string;

      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, {
          member_id: memberId,
          member_name: member?.name || 'Inconnu',
          member_type: member?.type || 'salarie',
          specialty: member?.specialty || '',
          hourly_rate: Number(member?.hourly_rate || 0),
          total_hours: 0,
          total_cost: 0,
          dates: [],
        });
      }
      const entry = memberMap.get(memberId)!;
      entry.total_hours += hours;
      entry.total_cost += hours * entry.hourly_rate;
      if (date && !entry.dates.includes(date)) entry.dates.push(date);
    });

    // Fusionner les planning_events (heures planifiees) dans le meme memberMap
    ((planningRows as any[]) || []).forEach(pe => {
      if (!pe.team_member_id) return;
      const memberId = pe.team_member_id as string;
      const member = pe.team_members as { name: string; type: string; specialty: string; hourly_rate: number } | null;
      const hPerDay = (pe.half_day === 'am' || pe.half_day === 'pm') ? 4 : 8;

      if (!memberMap.has(memberId)) {
        memberMap.set(memberId, {
          member_id: memberId,
          member_name: member?.name || 'Inconnu',
          member_type: member?.type || 'salarie',
          specialty: member?.specialty || '',
          hourly_rate: Number(member?.hourly_rate || 0),
          total_hours: 0,
          total_cost: 0,
          dates: [],
        });
      }
      const entry = memberMap.get(memberId)!;
      // Iterate each day in the planning event range
      let d = new Date(pe.start_date);
      const end = new Date(pe.end_date);
      while (d <= end) {
        const ds = d.toISOString().split('T')[0];
        // Only add if not already tracked via team_assignments
        if (!entry.dates.includes(ds)) {
          entry.total_hours += hPerDay;
          entry.total_cost += hPerDay * entry.hourly_rate;
          entry.dates.push(ds);
        }
        d.setDate(d.getDate() + 1);
      }
    });

    setProjectAssignments(Array.from(memberMap.values()).sort((a, b) => b.total_hours - a.total_hours));
  }

  function handleAddressSelect(result: AddressResult) {
    setForm((current) => ({
      ...current,
      address: [result.housenumber, result.street].filter(Boolean).join(' '),
      city: result.city || '',
      postal_code: result.postcode || '',
      lat: result.lat,
      lng: result.lng,
    }));
  }

  function addFiles(fileList: FileList | File[], category: PhotoCategory) {
    const acceptedFiles = Array.from(fileList).filter(
      (file) => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024
    );

    if (acceptedFiles.length === 0) return;

    // Pour 'presentation', on ne garde qu'une seule photo
    if (category === 'presentation') {
      setPendingPhotos((current) => {
        // Retirer les pending presentation
        const cleaned = current.filter(p => p.category !== 'presentation');
        return [...cleaned, {
          id: `${acceptedFiles[0].name}-${acceptedFiles[0].lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file: acceptedFiles[0],
          previewUrl: URL.createObjectURL(acceptedFiles[0]),
          category,
        }];
      });
      // Retirer les existing presentation aussi
      setExistingPhotos(current => {
        const toRemove = current.filter(p => p.category === 'presentation');
        setRemovedPhotoIds(ids => [...ids, ...toRemove.map(p => p.id)]);
        return current.filter(p => p.category !== 'presentation');
      });
      return;
    }

    setPendingPhotos((current) => [
      ...current,
      ...acceptedFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        category,
      })),
    ]);
  }

  function removePendingPhoto(photoId: string) {
    setPendingPhotos((current) => {
      const found = current.find((photo) => photo.id === photoId);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  function removeExistingPhoto(photoId: string) {
    setRemovedPhotoIds((current) => [...current, photoId]);
    setExistingPhotos((current) => current.filter((photo) => photo.id !== photoId));
  }

  async function uploadQueuedPhotos(projectId: string) {
    if (!pendingPhotos.length || !user || !ownerId) return;

    for (const photo of pendingPhotos) {
      const ext = photo.file.name.split('.').pop() || 'jpg';
      const fileName = `${ownerId}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('project-photos')
        .upload(fileName, photo.file, { contentType: photo.file.type, upsert: false });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from('project-photos')
        .getPublicUrl(fileName);

      // The DB trigger sync_photo_to_documents_after_insert mirrors this row
      // into document_files automatically.
      const { error: photoInsertError } = await supabase.from('project_photos').insert({
        user_id: ownerId,
        project_id: projectId,
        url: urlData.publicUrl,
        category: photo.category,
      });

      if (photoInsertError) {
        throw new Error(photoInsertError.message);
      }
    }
  }

  async function uploadPhotosDirect(files: FileList | File[], category: PhotoCategory, projectId: string) {
    if (!user || !ownerId || !files.length) return;
    setDetailUploading(true);

    const accepted = Array.from(files).filter(f => f.type.startsWith('image/') && f.size <= 10 * 1024 * 1024);
    const filesToUpload = category === 'presentation' ? accepted.slice(0, 1) : accepted;

    // Si présentation, supprimer l'ancienne
    if (category === 'presentation') {
      const existing = selectedProject?.project_photos.filter(p => p.category === 'presentation') || [];
      for (const photo of existing) {
        const storagePath = extractProjectPhotoPath(photo.url);
        if (storagePath) await supabase.storage.from('project-photos').remove([storagePath]);
        await supabase.from('project_photos').delete().eq('id', photo.id);
      }
    }

    for (const file of filesToUpload) {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${ownerId}/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('project-photos')
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (uploadError) { console.error(uploadError); continue; }

      const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(fileName);
      // DB trigger sync_photo_to_documents_after_insert mirrors this row into document_files
      const { error: photoInsertError } = await supabase.from('project_photos').insert({
        user_id: ownerId,
        project_id: projectId,
        url: urlData.publicUrl,
        category,
      });

      if (photoInsertError) {
        console.error(photoInsertError);
        continue;
      }
    }

    // Rafraîchir les photos du projet
    const { data: freshPhotos } = await supabase
      .from('project_photos')
      .select('id, url, caption, category, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    const updatedPhotos = (freshPhotos as ProjectPhoto[]) || [];
    setSelectedProject(prev => prev ? { ...prev, project_photos: updatedPhotos } : prev);
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, project_photos: updatedPhotos } : p));
    setDetailUploading(false);
  }

  async function deletePhotoDirect(photoId: string, projectId: string) {
    const photo = selectedProject?.project_photos.find(p => p.id === photoId);
    if (!photo) return;
    const storagePath = extractProjectPhotoPath(photo.url);
    if (storagePath) await supabase.storage.from('project-photos').remove([storagePath]);
    await supabase.from('project_photos').delete().eq('id', photoId);

    setSelectedProject(prev => prev ? { ...prev, project_photos: prev.project_photos.filter(p => p.id !== photoId) } : prev);
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, project_photos: p.project_photos.filter(ph => ph.id !== photoId) } : p));
  }

  async function deleteRemovedPhotos() {
    if (!removedPhotoIds.length) return;

    const photosToDelete = (selectedProject?.project_photos || []).filter((photo) =>
      removedPhotoIds.includes(photo.id)
    );

    for (const photo of photosToDelete) {
      const storagePath = extractProjectPhotoPath(photo.url);
      if (storagePath) {
        await supabase.storage.from('project-photos').remove([storagePath]);
      }

      const { error } = await supabase.from('project_photos').delete().eq('id', photo.id);
      if (error) {
        throw new Error(error.message);
      }
    }
  }

  async function saveProject() {
    if (!form.name.trim()) return;

    if (!form.lat || !form.lng) {
      setFormError("L'adresse GPS est obligatoire pour afficher le chantier sur la carte. Sélectionnez une adresse dans la liste déroulante.");
      return;
    }

    if (editorMode === 'create' && !user) {
      setFormError("La session utilisateur est requise pour creer un chantier.");
      return;
    }

    if (!ownerId) {
      setFormError("Le workspace actif n'a pas pu etre determine.");
      return;
    }

    if (pendingPhotos.length > 0 && !user) {
      setFormError("La session utilisateur est requise pour envoyer des photos.");
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const payload = {
        name: form.name.trim(),
        client_id: clientId ?? selectedProject?.client_id ?? null,
        address: form.address,
        city: form.city,
        postal_code: form.postal_code,
        lat: form.lat,
        lng: form.lng,
        budget: Number(form.budget || 0),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes.trim(),
        updated_at: new Date().toISOString(),
      };

      let projectId = selectedProject?.id || '';

      if (editorMode === 'create') {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            ...payload,
            user_id: ownerId,
            client_id: clientId,
          })
          .select('id')
          .single();

        if (error || !data) {
          throw new Error(error?.message || 'Impossible de creer le chantier.');
        }

        projectId = data.id;
      } else {
        if (!selectedProject) {
          throw new Error('Aucun chantier selectionne.');
        }

        const { error } = await supabase
          .from('projects')
          .update({
            ...payload,
            client_id: clientId ?? null,
          })
          .eq('id', selectedProject.id);

        if (error) {
          throw new Error(error.message);
        }

        projectId = selectedProject.id;
      }

      await deleteRemovedPhotos();
      await uploadQueuedPhotos(projectId);
      await loadProjects();
      closeEditor();
    } catch (error) {
      console.error('Erreur sauvegarde chantier:', error);
      setFormError(
        error instanceof Error ? error.message : "Impossible d'enregistrer ce chantier."
      );
    } finally {
      setSaving(false);
    }
  }

  async function reloadProjectFinance(projectId: string) {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, quote_number, title, status, total_ht, total_ttc, created_at')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    const loadedQuotes = (quotes as ProjectQuote[]) || [];
    setProjectQuotes(loadedQuotes);

    // Factures via devis OU liées directement au chantier
    const quoteIds = loadedQuotes.map(q => q.id);
    const invQuery = supabase
      .from('invoices')
      .select('id, invoice_number, title, status, total_ht, total_ttc, due_date, paid_at, issued_at')
      .order('created_at', { ascending: false });

    const [viaQuotes, viaProject] = await Promise.all([
      quoteIds.length > 0
        ? invQuery.in('quote_id', quoteIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from('invoices')
        .select('id, invoice_number, title, status, total_ht, total_ttc, due_date, paid_at, issued_at')
        .eq('project_id', projectId)
        .is('quote_id', null)
        .order('created_at', { ascending: false }),
    ]);

    const seen = new Set<string>();
    const merged = [...((viaQuotes.data as ProjectInvoice[]) || []), ...((viaProject.data as ProjectInvoice[]) || [])]
      .filter(inv => { if (seen.has(inv.id)) return false; seen.add(inv.id); return true; });
    setProjectInvoices(merged);
  }

  async function togglePhase(projectId: string, phaseKey: string, currentPhases: CompletedPhase[]) {
    const exists = currentPhases.find(p => p.key === phaseKey);
    let updated: CompletedPhase[];
    if (exists) {
      updated = currentPhases.filter(p => p.key !== phaseKey);
    } else {
      updated = [...currentPhases, { key: phaseKey, completed_at: new Date().toISOString() }];
    }

    // Calculer le nouveau % d'avancement
    const completedWeight = userPhases
      .filter(phase => updated.some(p => p.key === phase.key))
      .reduce((sum, phase) => sum + phase.weight, 0);

    // Déterminer le statut automatiquement
    let newStatus: string | undefined;
    if (completedWeight === 100) {
      newStatus = 'termine';
    } else if (completedWeight > 0) {
      newStatus = 'en_cours';
    }

    await supabase
      .from('projects')
      .update({
        completed_phases: updated,
        progress: completedWeight,
        ...(newStatus ? { status: newStatus } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    await loadProjects();
  }

  async function updateStatus(id: string, status: keyof typeof PROJECT_STATUSES) {
    const progress = status === 'termine' ? 100 : status === 'a_planifier' ? 0 : undefined;
    await supabase
      .from('projects')
      .update({
        status,
        ...(progress !== undefined ? { progress } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    await loadProjects();
  }

  async function moveProjectToTrash(project: Project) {
    if (!user) return;

    const confirmed = window.confirm(
      `Envoyer "${project.name}" dans la corbeille ? Vous pourrez le restaurer pendant 30 jours.`
    );
    if (!confirmed) return;

    setProjectActionId(project.id);

    try {
      const { error } = await moveProjectToTrashRecord(project.id, user.id);
      if (error) {
        throw error;
      }

      if (selectedProject?.id === project.id) {
        setShowDetails(false);
      }

      if (showEditor && selectedProject?.id === project.id) {
        closeEditor();
      }

      await loadProjects();
    } catch (error) {
      console.error('Erreur envoi chantier corbeille:', error);
      window.alert("Impossible d'envoyer ce chantier dans la corbeille.");
    } finally {
      setProjectActionId(null);
    }
  }

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        [project.name, project.city, project.clients?.name || '', project.notes || '']
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [projects, search]
  );

  const activeProject = selectedProject
    ? projects.find((project) => project.id === selectedProject.id) || selectedProject
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes chantiers"
        description="Suivez vos photos, vos durees et l'avancement de chaque chantier au meme endroit."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push('/corbeille')} className="gap-2">
            <Trash2 className="h-4 w-4" />
            Corbeille
          </Button>
          <Button onClick={openCreateEditor} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau chantier
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(['a_planifier', 'en_cours', 'termine', 'en_pause'] as const).map((status) => {
          const statusInfo = PROJECT_STATUSES[status];
          const count = projects.filter((project) => project.status === status).length;

          return (
            <div key={status} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <StatusBadge label={statusInfo.label} color={statusInfo.color} />
              <p className="mt-3 text-2xl font-semibold text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher un chantier..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'rounded-md p-1.5 transition-all',
              viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded-md p-1.5 transition-all',
              viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="Aucun chantier"
          description="Ajoutez votre premier chantier pour commencer le suivi."
        >
          <Button onClick={openCreateEditor} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un chantier
          </Button>
        </EmptyState>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredProjects.map((project) => {
            const statusInfo = PROJECT_STATUSES[project.status] || PROJECT_STATUSES.a_planifier;
            const coverPhoto = project.project_photos.find(p => p.category === 'presentation') || project.project_photos[0];

            return (
              <div
                key={project.id}
                onClick={() => openDetails(project)}
                className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
              >
                <div className="relative h-44 overflow-hidden border-b border-border bg-muted/40">
                  {coverPhoto ? (
                    <img
                      src={coverPhoto.url}
                      alt={project.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-background">
                      <div className="absolute left-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-background/80 shadow-sm">
                        <HardHat className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-5 text-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">{project.name}</h3>
                        <p className="text-sm text-white/80">{project.clients?.name || 'Sans client lie'}</p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-8 w-8 bg-white/85 text-foreground hover:bg-white"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetails(project);
                            }}
                          >
                            Voir le chantier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditEditor(project);
                            }}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(project.id, 'en_cours')}>
                            Passer en cours
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(project.id, 'termine')}>
                            Marquer termine
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(project.id, 'en_pause')}>
                            Mettre en pause
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={projectActionId === project.id}
                            onClick={(event) => {
                              event.stopPropagation();
                              void moveProjectToTrash(project);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Envoyer en corbeille
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={statusInfo.label} color={statusInfo.color} />
                    {(!project.address || !project.city) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
                        <MapPin className="h-3 w-3" /> Adresse GPS manquante
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Camera className="h-3.5 w-3.5" />
                      {project.project_photos.length} photo{project.project_photos.length > 1 ? 's' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      {project.plannedDays > 0 ? `${project.plannedDays} j` : formatTrackedHours(project.trackedHours)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    {project.city && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {project.city}
                      </span>
                    )}
                    {project.start_date && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDurationLabel(project.start_date, project.end_date)}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Avancement</span>
                      <span className="font-medium text-foreground">{project.progress}%</span>
                    </div>
                    <Progress value={project.progress} className="h-2" />
                  </div>

                  <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm">
                    <span className="text-muted-foreground">Budget chantier</span>
                    <span className="font-semibold text-foreground">
                      {project.budget > 0 ? formatCurrency(project.budget) : 'Non renseigne'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vue liste */
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Desktop : tableau */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground bg-muted/30">
                <th className="px-4 py-3 font-medium">Chantier</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Ville</th>
                <th className="px-4 py-3 font-medium text-center">Avancement</th>
                <th className="px-4 py-3 font-medium text-right">Budget</th>
                <th className="px-4 py-3 font-medium text-right">Temps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProjects.map((project) => {
                const statusInfo = PROJECT_STATUSES[project.status] || PROJECT_STATUSES.a_planifier;
                const coverPhoto = project.project_photos.find(p => p.category === 'presentation') || project.project_photos[0];
                return (
                  <tr
                    key={project.id}
                    onClick={() => openDetails(project)}
                    className="cursor-pointer hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {coverPhoto ? (
                          <img src={coverPhoto.url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <HardHat className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="font-medium text-foreground truncate">{project.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{project.clients?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={statusInfo.label} color={statusInfo.color} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{project.city || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <Progress value={project.progress} className="h-1.5 w-16" />
                        <span className="text-xs font-medium text-foreground">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">{project.budget > 0 ? formatCurrency(project.budget) : '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{project.plannedDays > 0 ? `${project.plannedDays} j (${formatTrackedHours(project.plannedHours)})` : formatTrackedHours(project.trackedHours)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Mobile : cartes compactes */}
          <div className="divide-y divide-border sm:hidden">
            {filteredProjects.map((project) => {
              const statusInfo = PROJECT_STATUSES[project.status] || PROJECT_STATUSES.a_planifier;
              const coverPhoto = project.project_photos.find(p => p.category === 'presentation') || project.project_photos[0];
              return (
                <div
                  key={project.id}
                  onClick={() => openDetails(project)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-muted/20"
                >
                  {coverPhoto ? (
                    <img src={coverPhoto.url} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <HardHat className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground text-sm">{project.name}</p>
                      <StatusBadge label={statusInfo.label} color={statusInfo.color} />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{project.clients?.name || 'Sans client'}</span>
                      {project.city && <span>{project.city}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5">
                        <Progress value={project.progress} className="h-1 w-12" />
                        <span className="text-[10px] font-medium text-foreground">{project.progress}%</span>
                      </div>
                      {project.budget > 0 && <span className="text-[10px] font-medium text-foreground">{formatCurrency(project.budget)}</span>}
                      <span className="text-[10px] text-muted-foreground">{project.plannedDays > 0 ? `${project.plannedDays} j` : formatTrackedHours(project.trackedHours)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={showEditor} onOpenChange={(open) => (!open ? closeEditor() : setShowEditor(true))}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editorMode === 'create' ? 'Nouveau chantier' : `Modifier ${selectedProject?.name || 'le chantier'}`}
            </DialogTitle>
            <DialogDescription>
              Renseignez le chantier, glissez quelques photos et gardez une trace claire du temps passe.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground">Nom du chantier *</label>
                  <Input
                    className="mt-1"
                    placeholder="Ex: Renovation appartement Dupont"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground">Client</label>
                  <ClientPicker
                    value={clientId}
                    onChange={(value) => setClientId(value)}
                    className="mt-1"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground">Adresse du chantier</label>
                  <AddressAutocomplete
                    value={addressQuery}
                    onChange={setAddressQuery}
                    onSelect={handleAddressSelect}
                    placeholder="Tapez une adresse..."
                    className="mt-1"
                  />
                  {form.lat && form.lng ? (
                    <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {form.address}, {form.postal_code} {form.city} — GPS enregistré
                    </p>
                  ) : addressQuery.trim() ? (
                    <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Sélectionnez une adresse dans la liste pour obtenir les coordonnées GPS
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Obligatoire pour afficher le chantier sur la carte
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Budget</label>
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.budget}
                    onChange={(event) => setForm({ ...form, budget: event.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Date de debut</label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.start_date}
                    onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground">Date de fin</label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={form.end_date}
                    onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                  />
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">Temps chantier</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {formatDurationLabel(form.start_date || null, form.end_date || null)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    La duree se met a jour automatiquement selon vos dates.
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-muted/30 p-4">
                  <p className="text-sm font-medium text-foreground">Main-d&apos;oeuvre</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {selectedProject && selectedProject.plannedDays > 0
                      ? `${selectedProject.plannedDays} j (${formatTrackedHours(selectedProject.plannedHours)})`
                      : selectedProject ? formatTrackedHours(selectedProject.trackedHours) : '0 h'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Base sur les heures renseignees par membre sur ce chantier.
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-sm font-medium text-foreground">Notes chantier</label>
                  <Textarea
                    className="mt-1 min-h-[120px]"
                    placeholder="Contexte, acces, remarques client, points a surveiller..."
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Photos du chantier</p>
                    <p className="text-xs text-muted-foreground">
                      Organisez vos photos par catégorie.
                    </p>
                  </div>
                  <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {existingPhotos.length + pendingPhotos.length} photo{(existingPhotos.length + pendingPhotos.length) > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Onglets catégories */}
                <div className="flex gap-1 rounded-xl bg-muted/60 p-1 mb-3">
                  {PHOTO_CATEGORIES.map(cat => {
                    const count = existingPhotos.filter(p => p.category === cat.key).length + pendingPhotos.filter(p => p.category === cat.key).length;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setEditorPhotoTab(cat.key)}
                        className={cn(
                          'flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                          editorPhotoTab === cat.key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {cat.label}
                        {count > 0 && <span className="ml-1 text-[10px] opacity-70">({count})</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Zone de drop pour la catégorie active */}
                {(() => {
                  const catExisting = existingPhotos.filter(p => p.category === editorPhotoTab);
                  const catPending = pendingPhotos.filter(p => p.category === editorPhotoTab);
                  const isPresentation = editorPhotoTab === 'presentation';
                  const hasPresentation = catExisting.length > 0 || catPending.length > 0;

                  return (
                    <>
                      {/* Photo de présentation : afficher si existe */}
                      {isPresentation && hasPresentation ? (
                        <div className="relative overflow-hidden rounded-2xl border border-border mb-3">
                          <img
                            src={catPending[0]?.previewUrl || catExisting[0]?.url}
                            alt="Photo de présentation"
                            className="h-44 w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/65 to-transparent px-3 py-2 text-xs text-white">
                            <span>Photo de présentation</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (catPending[0]) removePendingPhoto(catPending[0].id);
                                else if (catExisting[0]) removeExistingPhoto(catExisting[0].id);
                              }}
                              className="rounded-full bg-white/15 p-1 transition hover:bg-white/25"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {/* Zone drop */}
                      {(!isPresentation || !hasPresentation) && (
                        <div
                          onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(event) => {
                            event.preventDefault();
                            setDragOver(false);
                            addFiles(event.dataTransfer.files, editorPhotoTab);
                          }}
                          onClick={() => fileInputRef.current?.click()}
                          className={cn(
                            'flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition-all',
                            isPresentation ? 'min-h-[140px]' : 'min-h-[100px]',
                            dragOver
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
                          )}
                        >
                          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            {saving ? (
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            ) : (
                              <UploadCloud className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground">
                            {isPresentation ? 'Glissez ou cliquez pour la photo de présentation' : 'Glissez vos photos ou cliquez'}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">JPG, PNG, WebP - 10 Mo max</p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple={!isPresentation}
                            className="hidden"
                            onChange={(event) => {
                              if (event.target.files) addFiles(event.target.files, editorPhotoTab);
                              event.target.value = '';
                            }}
                          />
                        </div>
                      )}

                      {/* Grille de photos (hors présentation) */}
                      {!isPresentation && (catExisting.length > 0 || catPending.length > 0) && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {catExisting.map((photo) => (
                            <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-border">
                              <img src={photo.url} alt="" className="h-24 w-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-end bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                                <button
                                  type="button"
                                  onClick={() => removeExistingPhoto(photo.id)}
                                  className="rounded-full bg-white/15 p-1 transition hover:bg-white/25"
                                >
                                  <X className="h-3 w-3 text-white" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {catPending.map((photo) => (
                            <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-primary/20">
                              <img src={photo.previewUrl} alt="" className="h-24 w-full object-cover" />
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                                <span className="text-[10px] text-white/80">À envoyer</span>
                                <button
                                  type="button"
                                  onClick={() => removePendingPhoto(photo.id)}
                                  className="rounded-full bg-white/15 p-1 transition hover:bg-white/25"
                                >
                                  <X className="h-3 w-3 text-white" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">Ce que cette modal apporte</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>1. Les photos sont rangees directement avec le chantier.</p>
                  <p>2. La duree chantier reste visible en un coup d&apos;oeil.</p>
                  <p>3. Le temps equipe saisi donne enfin un vrai contexte sur le suivi.</p>
                </div>
              </div>
            </div>
          </div>

          {formError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Annuler
            </Button>
            <Button onClick={saveProject} disabled={!form.name.trim() || !form.lat || !form.lng || saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editorMode === 'create' ? 'Creer le chantier' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
          {activeProject ? (
            <>
              <DialogHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <DialogTitle>{activeProject.name}</DialogTitle>
                    <DialogDescription>
                      {activeProject.clients?.name || 'Sans client lie'}{activeProject.city ? ` - ${activeProject.city}` : ''}
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={(PROJECT_STATUSES[activeProject.status] || PROJECT_STATUSES.a_planifier).label}
                      color={(PROJECT_STATUSES[activeProject.status] || PROJECT_STATUSES.a_planifier).color}
                    />
                    <Button size="sm" variant="outline" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => {
                      const params = new URLSearchParams();
                      if (activeProject.client_id) params.set('client_id', activeProject.client_id);
                      params.set('project_id', activeProject.id);
                      router.push(`/devis?${params.toString()}`);
                    }}>
                      <FileText className="h-3.5 w-3.5" /> Nouveau devis
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => {
                      const params = new URLSearchParams();
                      if (activeProject.client_id) params.set('client_id', activeProject.client_id);
                      params.set('project_id', activeProject.id);
                      router.push(`/factures?${params.toString()}`);
                    }}>
                      <Receipt className="h-3.5 w-3.5" /> Nouvelle facture
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setShowDetails(false);
                        openEditEditor(activeProject);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={projectActionId === activeProject.id}
                      onClick={() => void moveProjectToTrash(activeProject)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Corbeille
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
                <div className="space-y-4">
                  {/* Photo de présentation — cliquable pour changer */}
                  {(() => {
                    const cover = activeProject.project_photos.find(p => p.category === 'presentation') || activeProject.project_photos[0];
                    return cover ? (
                      <div
                        className="group relative overflow-hidden rounded-3xl border border-border cursor-pointer"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (files) uploadPhotosDirect(files, 'presentation', activeProject.id);
                          };
                          input.click();
                        }}
                      >
                        <img src={cover.url} alt={activeProject.name} className="h-[220px] sm:h-[280px] w-full object-cover transition-all group-hover:brightness-90" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all">
                          <div className="rounded-full bg-white/90 p-2 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            <Camera className="h-5 w-5 text-foreground" />
                          </div>
                        </div>
                        {detailUploading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="flex h-[180px] sm:h-[220px] items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all"
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => { e.preventDefault(); uploadPhotosDirect(e.dataTransfer.files, 'presentation', activeProject.id); }}
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const files = (e.target as HTMLInputElement).files;
                            if (files) uploadPhotosDirect(files, 'presentation', activeProject.id);
                          };
                          input.click();
                        }}
                      >
                        <div className="text-center">
                          {detailUploading ? (
                            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                          ) : (
                            <>
                              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                                <Camera className="h-5 w-5 text-primary" />
                              </div>
                              <p className="text-sm font-medium text-foreground">Ajouter une photo de présentation</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">Cliquez ou glissez une image</p>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Onglets Avant / Pendant / Après avec upload direct */}
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="flex gap-1 bg-muted/40 p-1">
                      {(['avant', 'pendant', 'apres'] as PhotoCategory[]).map(cat => {
                        const photos = activeProject.project_photos.filter(p => p.category === cat);
                        const catLabel = PHOTO_CATEGORIES.find(c => c.key === cat)!.label;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setDetailPhotoTab(cat)}
                            className={cn(
                              'flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-all',
                              detailPhotoTab === cat
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {catLabel}
                            {photos.length > 0 && <span className="ml-1 opacity-60">({photos.length})</span>}
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const photos = activeProject.project_photos.filter(p => p.category === detailPhotoTab);
                      return (
                        <div className="p-3 space-y-3">
                          {photos.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {photos.map(photo => (
                                <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-border">
                                  <img src={photo.url} alt="" className="h-24 sm:h-28 w-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => deletePhotoDirect(photo.id, activeProject.id)}
                                    className="absolute top-1.5 right-1.5 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Zone d'ajout */}
                          <div
                            onDragOver={(e) => { e.preventDefault(); }}
                            onDrop={(e) => { e.preventDefault(); uploadPhotosDirect(e.dataTransfer.files, detailPhotoTab, activeProject.id); }}
                            onClick={() => detailFileInputRef.current?.click()}
                            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5"
                          >
                            {detailUploading ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : (
                              <UploadCloud className="h-4 w-4 text-primary" />
                            )}
                            <span className="text-xs font-medium text-muted-foreground">
                              {photos.length === 0
                                ? `Ajouter des photos « ${PHOTO_CATEGORIES.find(c => c.key === detailPhotoTab)!.label} »`
                                : 'Ajouter d\u0027autres photos'}
                            </span>
                            <input
                              ref={detailFileInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files) uploadPhotosDirect(e.target.files, detailPhotoTab, activeProject.id);
                                e.target.value = '';
                              }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border bg-muted/25 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Jours travailles
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {activeProject.plannedDays > 0 ? (
                          <>{activeProject.plannedDays} jour{activeProject.plannedDays > 1 ? 's' : ''}</>
                        ) : 'Non planifie'}
                      </p>
                      {activeProject.start_date && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          du {formatDate(activeProject.start_date)} au {activeProject.end_date ? formatDate(activeProject.end_date) : "aujourd'hui"}
                        </p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/25 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Heures main-d&apos;oeuvre
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {activeProject.plannedHours > 0 ? (
                          formatTrackedHours(activeProject.plannedHours)
                        ) : activeProject.trackedHours > 0 ? formatTrackedHours(activeProject.trackedHours) : '0 h'}
                      </p>
                      {activeProject.plannedDays > 0 && projectAssignments.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {projectAssignments.length} intervenant{projectAssignments.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/25 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Budget
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">
                        {activeProject.budget > 0 ? formatCurrency(activeProject.budget) : 'Non renseigne'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/25 p-4">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Avancement
                      </p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{activeProject.progress}%</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">Repere rapide</p>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Debut : {activeProject.start_date ? formatDate(activeProject.start_date) : 'Non renseigne'}
                      </p>
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Fin : {activeProject.end_date ? formatDate(activeProject.end_date) : 'Toujours en cours'}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {activeProject.address || 'Adresse non renseignee'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-sm font-semibold text-foreground">Notes</p>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {activeProject.notes?.trim() || 'Aucune note chantier pour le moment.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Avancement du chantier */}
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Avancement du chantier</p>
                    <p className="text-xs text-muted-foreground">Cochez chaque étape au fur et à mesure pour suivre la progression.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-foreground">{activeProject.progress}%</span>
                  </div>
                </div>

                <div className="relative">
                  {userPhases.map((phase, index) => {
                    const completed = activeProject.completed_phases.find(p => p.key === phase.key);
                    const isLast = index === userPhases.length - 1;

                    return (
                      <div key={phase.key} className="relative flex gap-3">
                        {/* Ligne verticale */}
                        {!isLast && (
                          <div className={`absolute left-[15px] top-[30px] w-0.5 h-[calc(100%-14px)] ${completed ? 'bg-emerald-400' : 'bg-border'}`} />
                        )}

                        {/* Cercle */}
                        <button
                          onClick={() => togglePhase(activeProject.id, phase.key, activeProject.completed_phases)}
                          className="relative z-10 mt-0.5 shrink-0"
                        >
                          {completed ? (
                            <CheckCircle2 className="h-[30px] w-[30px] text-emerald-500" />
                          ) : (
                            <Circle className="h-[30px] w-[30px] text-muted-foreground/40 hover:text-primary transition-colors" />
                          )}
                        </button>

                        {/* Contenu */}
                        <div className={`pb-5 flex-1 min-w-0 ${completed ? '' : 'opacity-70'}`}>
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-medium ${completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {phase.label}
                            </p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {phase.weight}%
                            </span>
                          </div>
                          {completed && (
                            <p className="text-[10px] text-emerald-600 mt-1">
                              Validé le {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(completed.completed_at))}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Synthèse financière */}
              {(() => {
                const totalDevis = projectQuotes.reduce((s, q) => s + q.total_ttc, 0);
                const totalFacture = projectInvoices.reduce((s, i) => s + i.total_ttc, 0);
                const totalEncaisse = projectInvoices.filter(i => i.status === 'payee').reduce((s, i) => s + i.total_ttc, 0);
                const totalEnAttente = projectInvoices.filter(i => i.status === 'envoyee' || i.status === 'en_retard').reduce((s, i) => s + i.total_ttc, 0);

                return (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-border bg-muted/25 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Budget</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{activeProject.budget > 0 ? formatCurrency(activeProject.budget) : '—'}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/25 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total devis</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{totalDevis > 0 ? formatCurrency(totalDevis) : '—'}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/25 p-4">
                        <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><CircleCheck className="h-3 w-3 text-emerald-500" /> Encaissé</div>
                        <p className="mt-1 text-lg font-semibold text-emerald-600">{totalEncaisse > 0 ? formatCurrency(totalEncaisse) : '—'}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/25 p-4">
                        <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Clock className="h-3 w-3 text-blue-500" /> En attente</div>
                        <p className="mt-1 text-lg font-semibold text-blue-600">{totalEnAttente > 0 ? formatCurrency(totalEnAttente) : '—'}</p>
                      </div>
                    </div>

                    {/* Devis */}
                    <div className="rounded-2xl border border-border bg-card overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Devis ({projectQuotes.length})</p>
                      </div>
                      {projectQuotes.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-muted-foreground">Aucun devis lié à ce chantier.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                              <th className="px-4 py-2 font-medium">Numéro</th>
                              <th className="px-4 py-2 font-medium">Titre</th>
                              <th className="px-4 py-2 font-medium">Statut</th>
                              <th className="px-4 py-2 font-medium text-right">Montant TTC</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {projectQuotes.map(q => {
                              const st = QUOTE_STATUSES[q.status as keyof typeof QUOTE_STATUSES] || QUOTE_STATUSES.brouillon;
                              return (
                                <tr key={q.id} className="hover:bg-muted/10">
                                  <td className="px-4 py-2 font-medium text-foreground">{q.quote_number}</td>
                                  <td className="px-4 py-2 text-muted-foreground">{q.title}</td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                                  </td>
                                  <td className="px-4 py-2 text-right font-semibold text-foreground">{formatCurrency(q.total_ttc)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Factures */}
                    <div className="rounded-2xl border border-border bg-card overflow-hidden">
                      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">Factures ({projectInvoices.length})</p>
                        {totalFacture > 0 && (
                          <span className="ml-auto text-sm font-medium text-foreground">{formatCurrency(totalFacture)} facturés</span>
                        )}
                      </div>
                      {projectInvoices.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-muted-foreground">Aucune facture liée à ce chantier.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-left text-xs text-muted-foreground">
                              <th className="px-4 py-2 font-medium">Numéro</th>
                              <th className="px-4 py-2 font-medium">Titre</th>
                              <th className="px-4 py-2 font-medium">Statut</th>
                              <th className="px-4 py-2 font-medium">Échéance</th>
                              <th className="px-4 py-2 font-medium text-right">Montant TTC</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {projectInvoices.map(inv => {
                              const st = INVOICE_STATUSES[inv.status as keyof typeof INVOICE_STATUSES] || INVOICE_STATUSES.brouillon;
                              return (
                                <tr key={inv.id} className="hover:bg-muted/10">
                                  <td className="px-4 py-2 font-medium text-foreground">{inv.invoice_number}</td>
                                  <td className="px-4 py-2 text-muted-foreground">{inv.title}</td>
                                  <td className="px-4 py-2">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                                  </td>
                                  <td className="px-4 py-2 text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                                  <td className="px-4 py-2 text-right font-semibold text-foreground">{formatCurrency(inv.total_ttc)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Suivi main-d'œuvre */}
                    <div className="rounded-2xl border border-border bg-card overflow-hidden">
                      <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:gap-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-semibold text-foreground">Main-d&apos;œuvre ({projectAssignments.length})</p>
                        </div>
                        {projectAssignments.length > 0 && (
                          <span className="text-xs font-medium text-muted-foreground sm:ml-auto sm:text-sm sm:text-foreground">
                            {formatCurrency(projectAssignments.reduce((s, a) => s + a.total_cost, 0))} — {formatTrackedHours(projectAssignments.reduce((s, a) => s + a.total_hours, 0))}
                          </span>
                        )}
                      </div>
                      {projectAssignments.length === 0 ? (
                        <p className="px-4 py-4 text-sm text-muted-foreground">Aucune affectation. Planifiez ce chantier dans le Planning pour voir la main-d&apos;oeuvre ici.</p>
                      ) : (
                        <>
                          {/* Mobile : cartes */}
                          <div className="divide-y divide-border sm:hidden">
                            {projectAssignments.map(a => {
                              const mt = MEMBER_TYPES[a.member_type as keyof typeof MEMBER_TYPES];
                              return (
                                <div key={a.member_id} className="px-4 py-3 space-y-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-bold text-slate-600">
                                      {a.member_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-medium text-foreground">{a.member_name}</p>
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        {mt && (
                                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${mt.color}`}>{mt.label}</span>
                                        )}
                                        {a.specialty && (
                                          <span className="text-[10px] text-muted-foreground">{a.specialty}</span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-sm font-semibold text-foreground shrink-0">{a.total_cost > 0 ? formatCurrency(a.total_cost) : '—'}</p>
                                  </div>
                                  <div className="flex items-center gap-4 pl-11 text-xs text-muted-foreground">
                                    <span><strong className="text-foreground">{a.dates.length}</strong> jour{a.dates.length > 1 ? 's' : ''}</span>
                                    <span><strong className="text-foreground">{formatTrackedHours(a.total_hours)}</strong></span>
                                    {a.hourly_rate > 0 && <span>{formatCurrency(a.hourly_rate)}/h</span>}
                                  </div>
                                </div>
                              );
                            })}
                            <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                              <span className="text-sm font-semibold text-foreground">Total</span>
                              <div className="flex items-center gap-3 text-sm">
                                <span className="font-medium text-muted-foreground">{formatTrackedHours(projectAssignments.reduce((s, a) => s + a.total_hours, 0))}</span>
                                <span className="font-bold text-foreground">{formatCurrency(projectAssignments.reduce((s, a) => s + a.total_cost, 0))}</span>
                              </div>
                            </div>
                          </div>
                          {/* Desktop : tableau */}
                          <table className="hidden sm:table w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                                <th className="px-4 py-2 font-medium">Intervenant</th>
                                <th className="px-4 py-2 font-medium">Spécialité</th>
                                <th className="px-4 py-2 font-medium text-center">Jours</th>
                                <th className="px-4 py-2 font-medium text-center">Heures</th>
                                <th className="px-4 py-2 font-medium text-right">Taux/h</th>
                                <th className="px-4 py-2 font-medium text-right">Coût</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {projectAssignments.map(a => {
                                const mt = MEMBER_TYPES[a.member_type as keyof typeof MEMBER_TYPES];
                                return (
                                  <tr key={a.member_id} className="hover:bg-muted/10">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-bold text-slate-600">
                                          {a.member_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="truncate font-medium text-foreground">{a.member_name}</p>
                                          {mt && (
                                            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${mt.color}`}>{mt.label}</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{a.specialty || '—'}</td>
                                    <td className="px-4 py-3 text-center font-medium text-foreground">{a.dates.length}</td>
                                    <td className="px-4 py-3 text-center font-medium text-foreground">{formatTrackedHours(a.total_hours)}</td>
                                    <td className="px-4 py-3 text-right text-muted-foreground">{a.hourly_rate > 0 ? formatCurrency(a.hourly_rate) : '—'}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-foreground">{a.total_cost > 0 ? formatCurrency(a.total_cost) : '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-border bg-muted/20">
                                <td className="px-4 py-3 font-semibold text-foreground" colSpan={2}>Total</td>
                                <td className="px-4 py-3 text-center font-semibold text-foreground" />
                                <td className="px-4 py-3 text-center font-semibold text-foreground">{formatTrackedHours(projectAssignments.reduce((s, a) => s + a.total_hours, 0))}</td>
                                <td className="px-4 py-3" />
                                <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(projectAssignments.reduce((s, a) => s + a.total_cost, 0))}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

    </div>
  );
}
