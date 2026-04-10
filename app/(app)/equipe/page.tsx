'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Users, HardHat, Phone, Mail, Building2, StickyNote,
  Pencil, Trash2, Clock, Euro, TrendingUp, UserCheck, UserX, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { MEMBER_TYPES, MEMBER_STATUSES, SPECIALTIES, formatCurrency, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MemberAvatar } from '@/components/shared/member-avatar';
import { cn } from '@/lib/utils';

interface TeamMemberRaw {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  color?: string;
  type?: string;
  status?: string;
  specialty?: string;
  hourly_rate?: number;
  monthly_salary?: number;
  weekly_hours?: number;
  start_date?: string | null;
  end_date?: string | null;
  company_name?: string;
  siret?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  avatar_url?: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  color: string;
  type: keyof typeof MEMBER_TYPES;
  status: keyof typeof MEMBER_STATUSES;
  specialty: string;
  hourly_rate: number;
  monthly_salary: number;
  weekly_hours: number;
  start_date: string | null;
  end_date: string | null;
  company_name: string;
  siret: string;
  address: string;
  city: string;
  postal_code: string;
  avatar_url: string;
  created_at: string;
}

function normalizeMember(raw: TeamMemberRaw): TeamMember {
  return {
    id: raw.id,
    name: raw.name,
    role: raw.role || '',
    phone: raw.phone || '',
    email: raw.email || '',
    color: raw.color || '#E97F2A',
    type: (raw.type as keyof typeof MEMBER_TYPES) || 'salarie',
    status: (raw.status as keyof typeof MEMBER_STATUSES) || 'actif',
    specialty: raw.specialty || '',
    hourly_rate: raw.hourly_rate || 0,
    monthly_salary: raw.monthly_salary || 0,
    weekly_hours: raw.weekly_hours || 35,
    start_date: raw.start_date || null,
    end_date: raw.end_date || null,
    company_name: raw.company_name || '',
    siret: raw.siret || '',
    address: raw.address || '',
    city: raw.city || '',
    postal_code: raw.postal_code || '',
    avatar_url: raw.avatar_url || '',
    created_at: raw.created_at,
  };
}

interface TeamNote {
  id: string;
  team_member_id: string;
  content: string;
  created_at: string;
}

interface TeamAssignment {
  id: string;
  team_member_id: string;
  project_id: string;
  date: string;
  hours: number;
  description: string;
  projects: { id: string; name: string; deleted_at: string | null } | null;
}

const emptyForm: {
  name: string; role: string; phone: string; email: string; color: string;
  type: keyof typeof MEMBER_TYPES; specialty: string; hourly_rate: number;
  monthly_salary: number; weekly_hours: number; start_date: string;
  end_date: string; company_name: string; siret: string; address: string; city: string; postal_code: string;
  avatar_url: string;
} = {
  name: '', role: '', phone: '', email: '', color: '#E97F2A',
  type: 'salarie', specialty: '', hourly_rate: 0,
  monthly_salary: 0, weekly_hours: 35, start_date: '',
  end_date: '', company_name: '', siret: '', address: '', city: '', postal_code: '',
  avatar_url: '',
};

export default function EquipePage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('actif');

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<TeamNote[]>([]);
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [newNote, setNewNote] = useState('');

  // Forms
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showDelete, setShowDelete] = useState<string | null>(null);

  // Assignment form
  const [showAddHours, setShowAddHours] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [hoursForm, setHoursForm] = useState({ project_id: '', date: new Date().toISOString().split('T')[0], hours: 0, description: '' });

  useEffect(() => { loadMembers(); loadProjects(); }, []);

  async function loadMembers() {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('name');
    setMembers((data || []).map(d => normalizeMember(d as TeamMemberRaw)));
    setLoading(false);
  }

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('id, name').is('deleted_at', null).order('name');
    setProjects(data || []);
  }

  async function loadMemberDetails(id: string) {
    setSelectedId(id);
    const [notesRes, assignRes] = await Promise.all([
      supabase.from('team_notes').select('*').eq('team_member_id', id).order('created_at', { ascending: false }),
      supabase.from('team_assignments').select('*, projects(id, name, deleted_at)').eq('team_member_id', id).order('date', { ascending: false }).limit(50),
    ]);
    setNotes((notesRes.data as TeamNote[]) || []);
    setAssignments(
      ((assignRes.data as unknown as TeamAssignment[]) || []).filter(
        (assignment) => !assignment.projects?.deleted_at
      )
    );
  }

  async function saveMember() {
    if (!user) return;

    // Calcul auto du taux horaire pour salariés/intérimaires
    const computedHourlyRate = (form.type === 'salarie' || form.type === 'interimaire')
      && form.monthly_salary > 0 && form.weekly_hours > 0
      ? Math.round((form.monthly_salary / (form.weekly_hours * 4.33)) * 100) / 100
      : form.hourly_rate;

    const fullPayload = {
      user_id: user.id,
      name: form.name, role: form.role, phone: form.phone, email: form.email,
      color: form.color, type: form.type, specialty: form.specialty,
      hourly_rate: computedHourlyRate, monthly_salary: form.monthly_salary,
      weekly_hours: form.weekly_hours,
      start_date: form.start_date || null, end_date: form.end_date || null,
      company_name: form.company_name, siret: form.siret,
      address: form.address, city: form.city, postal_code: form.postal_code,
      avatar_url: form.avatar_url,
    };
    // Colonnes de base (avant migration)
    const basePayload = {
      user_id: user.id,
      name: form.name, role: form.role, phone: form.phone, email: form.email, color: form.color,
    };

    async function tryUpsert(payload: Record<string, any>) {
      if (editingId) {
        return supabase.from('team_members').update(payload).eq('id', editingId);
      } else {
        return supabase.from('team_members').insert(payload);
      }
    }

    // Tenter avec toutes les colonnes, fallback sur les colonnes de base
    const { error } = await tryUpsert(fullPayload);
    if (error) {
      console.warn('Full save failed, trying base columns:', error.message);
      const { error: baseError } = await tryUpsert(basePayload);
      if (baseError) {
        alert(`Erreur: ${baseError.message}`);
        return;
      }
    }

    setShowCreate(false);
    setEditingId(null);
    setForm(emptyForm);
    loadMembers();
  }

  async function deleteMember(id: string) {
    await supabase.from('team_members').delete().eq('id', id);
    setShowDelete(null);
    if (selectedId === id) setSelectedId(null);
    loadMembers();
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === 'actif' ? 'inactif' : 'actif';
    const { error } = await supabase.from('team_members').update({ status: next }).eq('id', id);
    if (error) {
      console.warn('Toggle status failed (column may not exist):', error.message);
      return;
    }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, status: next as any } : m));
  }

  async function addNote() {
    if (!newNote.trim() || !selectedId) return;
    if (!user) return;
    const { error } = await supabase.from('team_notes').insert({ user_id: user.id, team_member_id: selectedId, content: newNote.trim() });
    if (error) {
      alert(`Impossible d'ajouter la note. Exécutez la migration SQL dans Supabase.\n\nErreur : ${error.message}`);
      return;
    }
    setNewNote('');
    loadMemberDetails(selectedId);
  }

  async function deleteNote(noteId: string) {
    await supabase.from('team_notes').delete().eq('id', noteId);
    if (selectedId) loadMemberDetails(selectedId);
  }

  async function addHours() {
    if (!selectedId || !hoursForm.project_id || hoursForm.hours <= 0) return;
    if (!user) return;
    await supabase.from('team_assignments').insert({
      user_id: user.id,
      team_member_id: selectedId,
      project_id: hoursForm.project_id,
      date: hoursForm.date,
      hours: hoursForm.hours,
      description: hoursForm.description,
    });
    setShowAddHours(false);
    setHoursForm({ project_id: '', date: new Date().toISOString().split('T')[0], hours: 0, description: '' });
    loadMemberDetails(selectedId);
  }

  function openEdit(m: TeamMember) {
    setForm({
      name: m.name, role: m.role, phone: m.phone, email: m.email, color: m.color,
      type: m.type, specialty: m.specialty, hourly_rate: m.hourly_rate,
      monthly_salary: m.monthly_salary, weekly_hours: m.weekly_hours,
      start_date: m.start_date || '', end_date: m.end_date || '',
      company_name: m.company_name, siret: m.siret,
      address: m.address, city: m.city, postal_code: m.postal_code,
      avatar_url: m.avatar_url,
    });
    setEditingId(m.id);
    setShowCreate(true);
  }

  // Filtered list
  const filtered = useMemo(() => {
    let list = members;
    if (filterStatus !== 'all') list = list.filter(m => m.status === filterStatus);
    if (filterType !== 'all') list = list.filter(m => m.type === filterType);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.specialty.toLowerCase().includes(q) ||
        m.company_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, filterType, filterStatus, search]);

  const selected = members.find(m => m.id === selectedId);

  // Stats
  const totalSalaries = members.filter(m => m.type === 'salarie' && m.status === 'actif');
  const totalMasseSalariale = totalSalaries.reduce((s, m) => s + m.monthly_salary, 0);
  const avgHourlyRate = totalSalaries.length > 0
    ? totalSalaries.reduce((s, m) => s + (m.monthly_salary > 0 && m.weekly_hours > 0 ? m.monthly_salary / (m.weekly_hours * 4.33) : m.hourly_rate), 0) / totalSalaries.length
    : 0;
  const totalHoursWorked = assignments.reduce((s, a) => s + a.hours, 0);
  const selectedCostPerHour = selected
    ? (selected.monthly_salary > 0 && selected.weekly_hours > 0
      ? selected.monthly_salary / (selected.weekly_hours * 4.33)
      : selected.hourly_rate)
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Équipe & Sous-traitants" description="Gérez votre équipe, suivez les heures et les coûts">
        <Button onClick={() => { setForm(emptyForm); setEditingId(null); setShowCreate(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Users className="h-4 w-4" /> Effectif actif
          </div>
          <p className="mt-2 text-2xl font-semibold">{members.filter(m => m.status === 'actif').length}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {members.filter(m => m.type === 'salarie' && m.status === 'actif').length} salariés,{' '}
            {members.filter(m => m.type === 'sous_traitant' && m.status === 'actif').length} sous-traitants
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Euro className="h-4 w-4" /> Masse salariale
          </div>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(totalMasseSalariale)}</p>
          <p className="text-xs text-muted-foreground mt-1">/mois brut</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <TrendingUp className="h-4 w-4" /> Coût horaire moyen
          </div>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(avgHourlyRate)}</p>
          <p className="text-xs text-muted-foreground mt-1">/heure (salariés)</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <HardHat className="h-4 w-4" /> Spécialités
          </div>
          <p className="mt-2 text-2xl font-semibold">{new Set(members.filter(m => m.specialty).map(m => m.specialty)).size}</p>
          <p className="text-xs text-muted-foreground mt-1">métiers couverts</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={filterStatus === 'actif' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('actif')}>Actifs</Button>
          <Button variant={filterStatus === 'inactif' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('inactif')}>Inactifs</Button>
          <Button variant={filterStatus === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('all')}>Tous</Button>
          <span className="hidden sm:block w-px h-5 bg-border" />
          <Button variant={filterType === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterType('all')}>Tous types</Button>
          {(Object.keys(MEMBER_TYPES) as Array<keyof typeof MEMBER_TYPES>).map(t => (
            <Button key={t} variant={filterType === t ? 'default' : 'outline'} size="sm" onClick={() => setFilterType(t)}>
              {MEMBER_TYPES[t].label}
            </Button>
          ))}
        </div>
      </div>

      {/* Contenu principal */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Aucun membre" description="Ajoutez votre premier membre d&apos;équipe ou sous-traitant.">
          <Button onClick={() => { setForm(emptyForm); setShowCreate(true); }} className="gap-2"><Plus className="h-4 w-4" /> Ajouter</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Liste */}
          <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map(m => {
              const mt = MEMBER_TYPES[m.type] || MEMBER_TYPES.salarie;
              const ms = MEMBER_STATUSES[m.status] || MEMBER_STATUSES.actif;
              return (
                <div
                  key={m.id}
                  className={cn(
                    'rounded-lg border border-border bg-card p-3 cursor-pointer transition-all hover:shadow-sm',
                    selectedId === m.id && 'ring-2 ring-primary border-primary'
                  )}
                  onClick={() => loadMemberDetails(m.id)}
                >
                  <div className="flex items-start gap-3">
                    <MemberAvatar name={m.name} avatarUrl={m.avatar_url} color={m.color} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={e => e.stopPropagation()}>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(m); }}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleStatus(m.id, m.status); }}>
                              {m.status === 'actif' ? <UserX className="h-3.5 w-3.5 mr-2" /> : <UserCheck className="h-3.5 w-3.5 mr-2" />}
                              {m.status === 'actif' ? 'Désactiver' : 'Réactiver'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setShowDelete(m.id); }}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{m.role || m.specialty}</p>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <StatusBadge label={mt.label} color={mt.color} />
                        <StatusBadge label={ms.label} color={ms.color} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-border bg-card p-8">
                <div className="text-center text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto" />
                  <p className="mt-3 text-sm">Sélectionnez un membre pour voir ses détails</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header detail */}
                <div className="p-4 sm:p-6 border-b border-border">
                  <div className="flex items-start gap-4">
                    <MemberAvatar name={selected.name} avatarUrl={selected.avatar_url} color={selected.color} size="lg" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge label={MEMBER_TYPES[selected.type]?.label || ''} color={MEMBER_TYPES[selected.type]?.color || ''} />
                          <StatusBadge label={MEMBER_STATUSES[selected.status]?.label || ''} color={MEMBER_STATUSES[selected.status]?.color || ''} />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{selected.role}{selected.specialty ? ` — ${selected.specialty}` : ''}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {selected.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selected.phone}</span>}
                        {selected.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selected.email}</span>}
                        {selected.company_name && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{selected.company_name}</span>}
                        {selected.start_date && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Depuis {formatDate(selected.start_date)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Stats du membre */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                    {selected.type === 'salarie' && (
                      <>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Salaire brut</p>
                          <p className="text-sm font-semibold mt-0.5">{formatCurrency(selected.monthly_salary)}/mois</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Heures/semaine</p>
                          <p className="text-sm font-semibold mt-0.5">{selected.weekly_hours}h</p>
                        </div>
                      </>
                    )}
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Coût horaire</p>
                      <p className="text-sm font-semibold mt-0.5">{formatCurrency(selectedCostPerHour)}/h</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Heures pointées</p>
                      <p className="text-sm font-semibold mt-0.5">{totalHoursWorked}h</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="notes" className="p-4 sm:p-6">
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="notes" className="gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Notes</TabsTrigger>
                    <TabsTrigger value="heures" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Heures</TabsTrigger>
                    <TabsTrigger value="stats" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Stats</TabsTrigger>
                  </TabsList>

                  {/* Notes tab */}
                  <TabsContent value="notes" className="mt-4 space-y-3">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Ajouter une note…"
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        className="min-h-[60px] flex-1"
                      />
                      <Button onClick={addNote} disabled={!newNote.trim()} className="self-end">Ajouter</Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {notes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Aucune note pour le moment</p>
                      ) : notes.map(n => (
                        <div key={n.id} className="rounded-lg border border-border p-3 group">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                            <button onClick={() => deleteNote(n.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">{formatDate(n.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Heures tab */}
                  <TabsContent value="heures" className="mt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">{totalHoursWorked}h pointées au total</p>
                      <Button size="sm" onClick={() => setShowAddHours(true)} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Pointer des heures
                      </Button>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {assignments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">Aucune heure pointée</p>
                      ) : assignments.map(a => (
                        <div key={a.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{a.projects?.name || 'Chantier inconnu'}</p>
                            {a.description && <p className="text-xs text-muted-foreground truncate">{a.description}</p>}
                            <p className="text-xs text-muted-foreground">{formatDate(a.date)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold">{a.hours}h</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(a.hours * selectedCostPerHour)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Stats tab */}
                  <TabsContent value="heures" className="mt-4">
                  </TabsContent>
                  <TabsContent value="stats" className="mt-4 space-y-4">
                    {(() => {
                      const projectHours = assignments.reduce<Record<string, { name: string; hours: number; cost: number }>>((acc, a) => {
                        const key = a.project_id;
                        if (!acc[key]) acc[key] = { name: a.projects?.name || 'Inconnu', hours: 0, cost: 0 };
                        acc[key].hours += a.hours;
                        acc[key].cost += a.hours * selectedCostPerHour;
                        return acc;
                      }, {});
                      const sorted = Object.values(projectHours).sort((a, b) => b.hours - a.hours);
                      const maxHours = sorted[0]?.hours || 1;

                      return (
                        <>
                          <div>
                            <h4 className="text-sm font-medium mb-3">Répartition par chantier</h4>
                            {sorted.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">Pas encore de données</p>
                            ) : (
                              <div className="space-y-3">
                                {sorted.map(p => (
                                  <div key={p.name}>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="truncate">{p.name}</span>
                                      <span className="font-medium shrink-0">{p.hours}h — {formatCurrency(p.cost)}</span>
                                    </div>
                                    <Progress value={(p.hours / maxHours) * 100} className="h-2" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {selected.type === 'salarie' && selected.monthly_salary > 0 && (
                            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                              <h4 className="text-sm font-medium">Synthèse salariale</h4>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Salaire annuel brut</p>
                                  <p className="font-semibold">{formatCurrency(selected.monthly_salary * 12)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Coût horaire</p>
                                  <p className="font-semibold">{formatCurrency(selectedCostPerHour)}/h</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Coût total pointé</p>
                                  <p className="font-semibold">{formatCurrency(totalHoursWorked * selectedCostPerHour)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Heures/an théoriques</p>
                                  <p className="font-semibold">{Math.round(selected.weekly_hours * 52)}h</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog ajout/edit membre */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) setEditingId(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier' : 'Ajouter'} un membre</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Photo + Nom */}
            <div className="flex items-start gap-4">
              <div className="shrink-0">
                <label className="text-sm font-medium block mb-1">Photo</label>
                <label className="cursor-pointer group">
                  <div className="relative">
                    <MemberAvatar name={form.name || '?'} avatarUrl={form.avatar_url} color={form.color} size="lg" />
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => setForm(f => ({ ...f, avatar_url: reader.result as string }));
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nom complet *</label>
                  <Input className="mt-1" placeholder="Jean Dupont" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Type *</label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as any })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(MEMBER_TYPES) as Array<keyof typeof MEMBER_TYPES>).map(t => (
                        <SelectItem key={t} value={t}>{MEMBER_TYPES[t].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Poste / Rôle</label>
                <Input className="mt-1" placeholder="Chef d&apos;équipe" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Spécialité</label>
                <Select value={form.specialty} onValueChange={v => setForm({ ...form, specialty: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Téléphone</label>
                <Input className="mt-1" placeholder="06 12 34 56 78" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input className="mt-1" type="email" placeholder="jean@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            {form.type === 'sous_traitant' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nom entreprise</label>
                  <Input className="mt-1" placeholder="SARL Plomberie Pro" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">SIRET</label>
                  <Input className="mt-1" placeholder="123 456 789 00012" value={form.siret} onChange={e => setForm({ ...form, siret: e.target.value })} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Adresse</label>
                <Input className="mt-1" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Ville</label>
                <Input className="mt-1" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Code postal</label>
                <Input className="mt-1" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium mb-3">{form.type === 'sous_traitant' ? 'Tarification' : 'Rémunération'}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(form.type === 'salarie' || form.type === 'interimaire') && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Salaire brut/mois</label>
                      <Input className="mt-1" type="number" placeholder="0" value={form.monthly_salary || ''} onChange={e => setForm({ ...form, monthly_salary: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Heures/semaine</label>
                      <Input className="mt-1" type="number" placeholder="35" value={form.weekly_hours || ''} onChange={e => setForm({ ...form, weekly_hours: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Taux horaire</label>
                      <div className="mt-1 flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm font-medium">
                        {form.monthly_salary > 0 && form.weekly_hours > 0
                          ? `${(form.monthly_salary / (form.weekly_hours * 4.33)).toFixed(2)} €/h`
                          : '—'}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Calculé automatiquement</p>
                    </div>
                  </>
                )}
                {form.type === 'sous_traitant' && (
                  <div>
                    <label className="text-sm font-medium">Taux horaire</label>
                    <Input className="mt-1" type="number" placeholder="0" value={form.hourly_rate || ''} onChange={e => setForm({ ...form, hourly_rate: Number(e.target.value) })} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Date début</label>
                <Input className="mt-1" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Date fin</label>
                <Input className="mt-1" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Couleur</label>
                <Input className="mt-1" type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }}>Annuler</Button>
              <Button onClick={saveMember} disabled={!form.name.trim()}>{editingId ? 'Enregistrer' : 'Ajouter'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer ce membre ?</DialogTitle>
            <DialogDescription>Cette action est irréversible. Toutes les notes et heures pointées seront supprimées.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDelete(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => showDelete && deleteMember(showDelete)}>Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog pointer des heures */}
      <Dialog open={showAddHours} onOpenChange={setShowAddHours}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pointer des heures</DialogTitle>
            <DialogDescription>{selected?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Chantier *</label>
              <Select value={hoursForm.project_id} onValueChange={v => setHoursForm({ ...hoursForm, project_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir un chantier…" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input className="mt-1" type="date" value={hoursForm.date} onChange={e => setHoursForm({ ...hoursForm, date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Heures *</label>
                <Input className="mt-1" type="number" step="0.5" placeholder="8" value={hoursForm.hours || ''} onChange={e => setHoursForm({ ...hoursForm, hours: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input className="mt-1" placeholder="Travail effectué…" value={hoursForm.description} onChange={e => setHoursForm({ ...hoursForm, description: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddHours(false)}>Annuler</Button>
              <Button onClick={addHours} disabled={!hoursForm.project_id || hoursForm.hours <= 0}>Valider</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
