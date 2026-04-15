'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, HardHat, Users,
  Trash2, Clock, Umbrella, Coffee, Briefcase, GripVertical,
  Sun, Sunrise, Sunset,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { MemberAvatar } from '@/components/shared/member-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────��───────────────────────────────────────
interface PlanningEvent {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string;
  half_day: string;
  team_member_id: string | null;
  project_id: string | null;
  notes: string;
  projects: { name: string } | null;
  team_members: { name: string; color: string } | null;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
  specialty: string;
  type: string;
  avatar_url: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  city: string;
}

type ViewMode = 'week' | 'month';
type HalfDay = 'full' | 'am' | 'pm';

// ─── Helpers ──────��──────────────────────────────────────────────────
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const HALF_DAY_LABELS: Record<HalfDay, string> = {
  full: 'Journée',
  am: 'Matin',
  pm: 'Après-midi',
};

function toDateStr(d: Date) {
  return d.toLocaleDateString('fr-CA');
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function getMonthWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  let monday = getMonday(first);
  if (monday > first) monday = addDays(monday, -7);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = getWeekDays(monday);
    if (w > 0 && week[0].getMonth() > month && week[0].getFullYear() >= year) break;
    weeks.push(week);
    monday = addDays(monday, 7);
  }
  return weeks;
}

function daysBetween(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
}

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: typeof HardHat; bg: string; border: string; text: string }> = {
  chantier: { label: 'Chantier', icon: HardHat, bg: 'bg-primary/15', border: 'border-primary/30', text: 'text-primary' },
  conge: { label: 'Absence', icon: Umbrella, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  reunion: { label: 'Réunion', icon: Coffee, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  autre: { label: 'Autre', icon: Briefcase, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
};

// ─── Component ───────────���───────────────────────────────────────────
const OWNER_MEMBER_ID = '__owner__';

export function PlanningView() {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Drag state
  const [dragging, setDragging] = useState<{ type: 'project' | 'event'; id: string; title: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ memberId: string; date: string; half?: 'am' | 'pm' } | null>(null);

  // Resize state (drag right edge to extend/shrink event)
  const [resizing, setResizing] = useState<{ eventId: string; memberId: string; originalEnd: string } | null>(null);
  const [resizeTarget, setResizeTarget] = useState<string | null>(null); // target date

  // Event form
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlanningEvent | null>(null);
  const [form, setForm] = useState({
    title: '', eventType: 'chantier', startDate: '', endDate: '',
    memberIds: [] as string[], projectId: '', notes: '', halfDay: 'full' as HalfDay,
  });

  // Absence modal
  const [showAbsence, setShowAbsence] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({ memberId: '', startDate: '', endDate: '', notes: '', halfDay: 'full' as HalfDay });

  const todayStr = toDateStr(new Date());

  // ─── Data loading ───────────���──────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [eventsRes, membersRes, projectsRes] = await Promise.all([
      supabase.from('planning_events').select('id, title, event_type, start_date, end_date, half_day, team_member_id, project_id, notes, projects(name), team_members(name, color)').order('start_date'),
      supabase.from('team_members').select('id, name, role, color, specialty, type, avatar_url').order('name'),
      supabase.from('projects').select('id, name, status, city').is('deleted_at', null).in('status', ['a_planifier', 'en_cours']).order('name'),
    ]);
    const activeProjectIds = new Set((((projectsRes.data as unknown as Project[]) || []).map((project) => project.id)));
    // Map events with team_member_id=null to the owner virtual member
    const rawEvents = ((eventsRes.data as unknown as PlanningEvent[]) || []).filter(
      (event) => !event.project_id || activeProjectIds.has(event.project_id)
    );
    const mappedEvents = rawEvents.map(e => ({
      ...e,
      team_member_id: e.team_member_id ?? OWNER_MEMBER_ID,
    }));
    setEvents(mappedEvents);

    // Prepend the owner as first "member"
    const teamMembers = (membersRes.data as unknown as TeamMember[]) || [];
    const ownerMember: TeamMember = {
      id: OWNER_MEMBER_ID,
      name: profile?.full_name || user?.email?.split('@')[0] || 'Moi',
      role: 'Dirigeant',
      color: '#D35400',
      specialty: '',
      type: 'owner',
      avatar_url: '',
    };
    setMembers([ownerMember, ...teamMembers]);

    setProjects((projectsRes.data as unknown as Project[]) || []);
    setLoading(false);
  }

  // ─── Sync project dates from planning events ──────────────────────
  async function syncProjectDates(projectId: string | null) {
    if (!projectId) return;
    // Get all planning events linked to this project
    const { data: projEvents } = await supabase
      .from('planning_events')
      .select('start_date, end_date')
      .eq('project_id', projectId)
      .order('start_date');
    if (!projEvents || projEvents.length === 0) return;
    const earliest = projEvents[0].start_date;
    const latest = projEvents.reduce((max, e) => e.end_date > max ? e.end_date : max, projEvents[0].end_date);
    await supabase.from('projects').update({
      start_date: earliest,
      end_date: latest,
    }).eq('id', projectId);
  }

  // ─── CRUD ──────────────────────────────────────────────────────────
  async function saveEvent() {
    if (!editingEvent && !user) return;

    // Convert owner virtual ID to null for DB
    const toDbMemberId = (id: string | null) => id === OWNER_MEMBER_ID ? null : id;

    if (editingEvent) {
      await supabase.from('planning_events').update({
        title: form.title,
        event_type: form.eventType,
        start_date: form.startDate,
        end_date: form.endDate || form.startDate,
        team_member_id: toDbMemberId(form.memberIds[0] || null),
        project_id: form.projectId || null,
        notes: form.notes,
        half_day: form.halfDay,
      }).eq('id', editingEvent.id);
    } else {
      const ids = form.memberIds.length > 0 ? form.memberIds : [OWNER_MEMBER_ID];
      await supabase.from('planning_events').insert(
        ids.map(mid => ({
          user_id: user!.id,
          title: form.title,
          event_type: form.eventType,
          start_date: form.startDate,
          end_date: form.endDate || form.startDate,
          team_member_id: toDbMemberId(mid),
          project_id: form.projectId || null,
          notes: form.notes,
          half_day: form.halfDay,
        }))
      );
    }
    // Sync linked project dates
    const pid = form.projectId || (editingEvent?.project_id ?? null);
    if (form.eventType === 'chantier' && pid) await syncProjectDates(pid);
    closeForm();
    loadData();
  }

  async function deleteEvent(id: string) {
    const evt = events.find(e => e.id === id);
    await supabase.from('planning_events').delete().eq('id', id);
    if (evt?.project_id) await syncProjectDates(evt.project_id);
    closeForm();
    loadData();
  }

  async function moveEvent(eventId: string, newMemberId: string, newDate: string, newHalf?: 'am' | 'pm') {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const duration = daysBetween(event.start_date, event.end_date);
    const newEnd = toDateStr(addDays(new Date(newDate), duration - 1));
    await supabase.from('planning_events').update({
      team_member_id: newMemberId === OWNER_MEMBER_ID ? null : newMemberId,
      start_date: newDate,
      end_date: newEnd,
      ...(newHalf ? { half_day: newHalf } : {}),
    }).eq('id', eventId);
    if (event.project_id) await syncProjectDates(event.project_id);
    loadData();
  }

  async function createFromDrop(projectId: string, memberId: string, date: string, halfDay: HalfDay = 'full') {
    const project = projects.find(p => p.id === projectId);
    if (!project || !user) return;
    await supabase.from('planning_events').insert({
      user_id: user.id,
      title: project.name,
      event_type: 'chantier',
      start_date: date,
      end_date: date,
      team_member_id: memberId === OWNER_MEMBER_ID ? null : memberId,
      project_id: projectId,
      half_day: halfDay,
    });
    await syncProjectDates(projectId);
    loadData();
  }

  function closeForm() {
    setShowCreate(false);
    setEditingEvent(null);
    setForm({ title: '', eventType: 'chantier', startDate: '', endDate: '', memberIds: [], projectId: '', notes: '', halfDay: 'full' });
  }

  function closeAbsence() {
    setShowAbsence(false);
    setAbsenceForm({ memberId: '', startDate: '', endDate: '', notes: '', halfDay: 'full' });
  }

  async function saveAbsence() {
    if (!user || !absenceForm.memberId || !absenceForm.startDate) return;
    const member = members.find(m => m.id === absenceForm.memberId);
    const isSousTrait = member?.type === 'sous_traitant';
    const halfLabel = absenceForm.halfDay === 'am' ? ' (matin)' : absenceForm.halfDay === 'pm' ? ' (après-midi)' : '';
    await supabase.from('planning_events').insert({
      user_id: user.id,
      title: isSousTrait ? `Indispo.${halfLabel} — ${member?.name || ''}` : `Absence${halfLabel} — ${member?.name || 'Membre'}`,
      event_type: 'conge',
      start_date: absenceForm.startDate,
      end_date: absenceForm.endDate || absenceForm.startDate,
      team_member_id: absenceForm.memberId === OWNER_MEMBER_ID ? null : absenceForm.memberId,
      notes: isSousTrait ? (absenceForm.notes || 'Sous-traitant indisponible') : absenceForm.notes,
      half_day: absenceForm.halfDay,
    });
    closeAbsence();
    loadData();
  }

  function openEdit(e: PlanningEvent) {
    setForm({
      title: e.title,
      eventType: e.event_type,
      startDate: e.start_date,
      endDate: e.end_date,
      memberIds: e.team_member_id ? [e.team_member_id] : [],
      projectId: e.project_id || '',
      notes: e.notes || '',
      halfDay: (e.half_day || 'full') as HalfDay,
    });
    setEditingEvent(e);
    setShowCreate(true);
  }

  function openCreateWithDefaults(memberId: string, date: string, halfDay: HalfDay = 'full') {
    setForm({ title: '', eventType: 'chantier', startDate: date, endDate: date, memberIds: [memberId], projectId: '', notes: '', halfDay });
    setEditingEvent(null);
    setShowCreate(true);
  }

  function toggleMember(memberId: string) {
    if (editingEvent) {
      setForm({ ...form, memberIds: [memberId] });
    } else {
      setForm(prev => ({
        ...prev,
        memberIds: prev.memberIds.includes(memberId)
          ? prev.memberIds.filter(id => id !== memberId)
          : [...prev.memberIds, memberId],
      }));
    }
  }

  // ─── Navigation ────────────────────────────────────────────────────
  const monday = useMemo(() => getMonday(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(monday), [monday]);
  const monthWeeks = useMemo(() => getMonthWeeks(currentDate.getFullYear(), currentDate.getMonth()), [currentDate]);

  function navigate(dir: -1 | 1) {
    if (view === 'week') {
      setCurrentDate(addDays(currentDate, dir * 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1));
    }
  }

  function goToday() {
    setCurrentDate(new Date());
  }

  // ─── Event helpers ──────���──────────────────────────────────────────
  function getEventsForHalf(memberId: string, dateStr: string, half: 'am' | 'pm') {
    return events.filter(e => {
      if (e.team_member_id !== memberId) return false;
      if (dateStr < e.start_date || dateStr > e.end_date) return false;
      const h = (e.half_day || 'full') as HalfDay;
      return h === 'full' || h === half;
    });
  }

  // ─── Drag & Drop handlers ─��───────────────────────────────────────
  function onDragStart(type: 'project' | 'event', id: string, title: string) {
    setDragging({ type, id, title });
  }

  function onDragOver(e: React.DragEvent, memberId: string, date: string, half?: 'am' | 'pm') {
    e.preventDefault();
    setDropTarget({ memberId, date, half });
  }

  function onDragLeave() {
    setDropTarget(null);
  }

  function onDrop(e: React.DragEvent, memberId: string, date: string, half?: 'am' | 'pm') {
    e.preventDefault();
    setDropTarget(null);
    if (!dragging) return;

    if (dragging.type === 'project') {
      createFromDrop(dragging.id, memberId, date, half || 'full');
    } else {
      moveEvent(dragging.id, memberId, date, half);
    }
    setDragging(null);
  }

  function onDragEnd() {
    setDragging(null);
    setDropTarget(null);
  }

  // ─── Resize handlers (drag right edge to extend) ──────────────────
  function onResizeStart(eventId: string, memberId: string, originalEnd: string) {
    setResizing({ eventId, memberId, originalEnd });
    setResizeTarget(originalEnd);
  }

  const onResizeMove = useCallback((dateStr: string) => {
    if (!resizing) return;
    const evt = events.find(e => e.id === resizing.eventId);
    if (!evt) return;
    // Only allow extending to dates >= start_date
    if (dateStr >= evt.start_date) {
      setResizeTarget(dateStr);
    }
  }, [resizing, events]);

  const onResizeEnd = useCallback(async () => {
    if (!resizing || !resizeTarget) { setResizing(null); setResizeTarget(null); return; }
    const evt = events.find(e => e.id === resizing.eventId);
    if (!evt) { setResizing(null); setResizeTarget(null); return; }
    if (resizeTarget !== evt.end_date) {
      await supabase.from('planning_events').update({ end_date: resizeTarget }).eq('id', resizing.eventId);
      // Sync project dates if it's a chantier event
      if (evt.project_id) await syncProjectDates(evt.project_id);
      loadData();
    }
    setResizing(null);
    setResizeTarget(null);
  }, [resizing, resizeTarget, events]);

  // Global mouseup listener for resize
  useEffect(() => {
    if (!resizing) return;
    const handler = () => onResizeEnd();
    window.addEventListener('mouseup', handler);
    return () => window.removeEventListener('mouseup', handler);
  }, [resizing, onResizeEnd]);

  // ─── Week label ─────────���──────────────────────────────���───────────
  const headerLabel = view === 'week'
    ? `Semaine du ${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
    : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  // ─── Render event pill ──────────────────────────────────────────────
  function renderPill(evt: PlanningEvent, dateStr: string, memberColor?: string) {
    const cfg = EVENT_TYPE_CONFIG[evt.event_type] || EVENT_TYPE_CONFIG.autre;
    const isStart = evt.start_date === dateStr;
    const h = (evt.half_day || 'full') as HalfDay;
    // During resize, show pill on extended days too
    const isResizing = resizing?.eventId === evt.id;
    const effectiveEnd = isResizing && resizeTarget ? resizeTarget : evt.end_date;
    const isEnd = effectiveEnd === dateStr;
    const isInResizeRange = isResizing && resizeTarget && dateStr > evt.end_date && dateStr <= resizeTarget;
    const isShrunk = isResizing && resizeTarget && dateStr > resizeTarget && dateStr <= evt.end_date;

    if (isShrunk) return null;

    return (
      <div
        key={evt.id}
        draggable={!resizing}
        onDragStart={(e) => { if (resizing) { e.preventDefault(); return; } e.stopPropagation(); onDragStart('event', evt.id, evt.title); }}
        onDragEnd={onDragEnd}
        onClick={(e) => { e.stopPropagation(); if (!resizing) openEdit(evt); }}
        className={cn(
          'rounded h-[1.125rem] flex items-center px-1.5 text-[10px] font-medium truncate border transition-shadow hover:shadow-sm relative group/pill',
          resizing ? 'cursor-ew-resize' : 'cursor-grab active:cursor-grabbing',
          cfg.bg, cfg.border, cfg.text,
          !isStart && !isInResizeRange && 'rounded-l-none border-l-0',
          isInResizeRange && 'rounded-l-none border-l-0',
          !isEnd && 'rounded-r-none border-r-0',
        )}
        style={{
          borderLeftColor: isStart ? memberColor : undefined,
          borderLeftWidth: isStart ? 3 : undefined,
          ...(isInResizeRange ? { opacity: 0.6, borderStyle: 'dashed' } : {}),
        }}
      >
        {isStart ? (
          <>
            {h !== 'full' && (h === 'am'
              ? <Sunrise className="h-2.5 w-2.5 inline-block opacity-50 mr-0.5 -mt-px shrink-0" />
              : <Sunset className="h-2.5 w-2.5 inline-block opacity-50 mr-0.5 -mt-px shrink-0" />
            )}
            <span className="truncate">{evt.title}</span>
          </>
        ) : (
          <span className="w-full">{'\u00A0'}</span>
        )}
        {/* Resize handle on the last visible day */}
        {isEnd && view === 'week' && (
          <div
            className={cn(
              'absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center',
              isResizing ? 'opacity-100' : 'opacity-0 group-hover/pill:opacity-100',
            )}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onResizeStart(evt.id, evt.team_member_id || '', evt.end_date);
            }}
          >
            <div className="w-[3px] h-3 rounded-full bg-current opacity-50 flex flex-col justify-center gap-px">
              <div className="w-full h-px bg-current/80" />
              <div className="w-full h-px bg-current/80" />
              <div className="w-full h-px bg-current/80" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render ─────────────────��─────────────────────────────���────────
  return (
    <div className="space-y-4">
      <PageHeader title="Planning" description="Planification de votre équipe et chantiers">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAbsence(true)} className="gap-2 hidden sm:flex">
            <Umbrella className="h-4 w-4" /> Absence
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Événement
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-4">
        {/* ─── Top strip: Chantiers à planifier ─── */}
        <div className="rounded-xl border border-border bg-card p-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <HardHat className="h-3.5 w-3.5" /> Chantiers
          </h3>
          {projects.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Aucun chantier actif</p>
          ) : (
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {projects.map(p => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => onDragStart('project', p.id, p.name)}
                  onDragEnd={onDragEnd}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow shrink-0 min-w-[140px] max-w-[200px]"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    {p.city && <p className="text-[10px] text-muted-foreground truncate">{p.city}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unassigned events */}
        {events.filter(e => !e.team_member_id).length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Non affectés</h3>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {events.filter(e => !e.team_member_id).map(e => {
                const cfg = EVENT_TYPE_CONFIG[e.event_type] || EVENT_TYPE_CONFIG.autre;
                return (
                  <div
                    key={e.id}
                    draggable
                    onDragStart={() => onDragStart('event', e.id, e.title)}
                    onDragEnd={onDragEnd}
                    onClick={() => openEdit(e)}
                    className={cn('rounded-lg border p-2 cursor-grab active:cursor-grabbing text-xs shrink-0 min-w-[140px] max-w-[200px]', cfg.bg, cfg.border)}
                  >
                    <p className={cn('font-medium truncate', cfg.text)}>{e.title}</p>
                    <p className="text-[10px] text-muted-foreground">{e.start_date}{e.end_date !== e.start_date ? ` \u2192 ${e.end_date}` : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Main grid ─── */}
        <div className="flex-1 min-w-0">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <h2 className="text-sm sm:text-base font-semibold text-foreground whitespace-nowrap">{headerLabel}</h2>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>Aujourd&apos;hui</Button>
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')} onClick={() => setView('week')}>Semaine</button>
                <button className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')} onClick={() => setView('month')}>Mois</button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-96 animate-pulse rounded-xl bg-muted" />
          ) : members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">Ajoutez des membres dans la page Équipe pour commencer à planifier.</p>
            </div>
          ) : view === 'week' ? (
            /* ─── VUE SEMAINE (AM / PM split) ─���─ */
            <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted/50 border-b border-r border-border p-2 text-left w-40">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Équipe</span>
                    </th>
                    {weekDays.map(day => {
                      const ds = toDateStr(day);
                      const isToday = ds === todayStr;
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <th key={ds} className={cn('border-b border-r border-border p-2 text-center min-w-[100px]', isWeekend ? 'bg-muted/30' : 'bg-muted/10', isToday && 'bg-primary/5')}>
                          <span className="text-[10px] font-medium uppercase text-muted-foreground block">{DAYS_SHORT[(day.getDay() + 6) % 7]}</span>
                          <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold mt-0.5', isToday ? 'bg-primary text-primary-foreground' : 'text-foreground')}>
                            {day.getDate()}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => (
                    <tr key={member.id} className="group">
                      <td className="sticky left-0 z-10 bg-card border-b border-r border-border p-2">
                        <div className="flex items-center gap-2">
                          <MemberAvatar name={member.name} avatarUrl={member.avatar_url} color={member.color} size="sm" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{member.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{member.role || member.specialty || (member.type === 'sous_traitant' ? 'Sous-traitant' : '')}</p>
                          </div>
                        </div>
                      </td>
                      {weekDays.map(day => {
                        const ds = toDateStr(day);
                        const isToday = ds === todayStr;
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        // During resize, include the resized event in cells it extends to
                        const resizingEvt = resizing && resizing.memberId === member.id ? events.find(e => e.id === resizing.eventId) : null;
                        const amEventsBase = getEventsForHalf(member.id, ds, 'am');
                        const pmEventsBase = getEventsForHalf(member.id, ds, 'pm');
                        // Add resizing event to extended cells
                        const amEvents = resizingEvt && resizeTarget && ds > resizingEvt.end_date && ds <= resizeTarget && ((resizingEvt.half_day || 'full') === 'full' || (resizingEvt.half_day || 'full') === 'am')
                          ? [...amEventsBase, resizingEvt] : amEventsBase;
                        const pmEvents = resizingEvt && resizeTarget && ds > resizingEvt.end_date && ds <= resizeTarget && ((resizingEvt.half_day || 'full') === 'full' || (resizingEvt.half_day || 'full') === 'pm')
                          ? [...pmEventsBase, resizingEvt] : pmEventsBase;
                        const isDropAM = dropTarget?.memberId === member.id && dropTarget?.date === ds && dropTarget?.half === 'am';
                        const isDropPM = dropTarget?.memberId === member.id && dropTarget?.date === ds && dropTarget?.half === 'pm';

                        return (
                          <td
                            key={ds}
                            className={cn(
                              'border-b border-r border-border p-0 align-top',
                              isWeekend ? 'bg-muted/10' : '',
                              isToday && 'bg-primary/5',
                              resizing && 'select-none',
                            )}
                          >
                            {/* AM half */}
                            <div
                              className={cn(
                                'min-h-[2.25rem] px-0.5 pt-0.5 pb-0.5 border-b border-dashed border-border/40 transition-colors',
                                isDropAM && 'bg-primary/20 ring-1 ring-inset ring-primary/40',
                              )}
                              onDragOver={e => onDragOver(e, member.id, ds, 'am')}
                              onDragLeave={onDragLeave}
                              onDrop={e => onDrop(e, member.id, ds, 'am')}
                              onMouseEnter={() => { if (resizing && resizing.memberId === member.id) onResizeMove(ds); }}
                              onClick={() => { if (!resizing && amEvents.length === 0) openCreateWithDefaults(member.id, ds, 'am'); }}
                            >
                              <span className="text-[7px] text-muted-foreground/40 leading-none select-none block mb-px">mat.</span>
                              <div className="space-y-0.5">
                                {amEvents.map(evt => renderPill(evt, ds, member.color))}
                              </div>
                            </div>
                            {/* PM half */}
                            <div
                              className={cn(
                                'min-h-[2.25rem] px-0.5 pt-0.5 pb-0.5 transition-colors',
                                isDropPM && 'bg-primary/20 ring-1 ring-inset ring-primary/40',
                              )}
                              onMouseEnter={() => { if (resizing && resizing.memberId === member.id) onResizeMove(ds); }}
                              onDragOver={e => onDragOver(e, member.id, ds, 'pm')}
                              onDragLeave={onDragLeave}
                              onDrop={e => onDrop(e, member.id, ds, 'pm')}
                              onClick={() => { if (!resizing && pmEvents.length === 0) openCreateWithDefaults(member.id, ds, 'pm'); }}
                            >
                              <span className="text-[7px] text-muted-foreground/40 leading-none select-none block mb-px">a-m.</span>
                              <div className="space-y-0.5">
                                {pmEvents.map(evt => renderPill(evt, ds, member.color))}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* ��── VUE MOIS ─── */
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Header jours */}
              <div className="grid grid-cols-7 border-b border-border">
                {DAYS_SHORT.map(d => (
                  <div key={d} className="bg-muted/30 px-2 py-2 text-center text-[10px] font-medium uppercase text-muted-foreground border-r border-border last:border-r-0">{d}</div>
                ))}
              </div>
              {/* Weeks */}
              {monthWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7">
                  {week.map(day => {
                    const ds = toDateStr(day);
                    const isToday = ds === todayStr;
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const dayAllEvents = events.filter(e => ds >= e.start_date && ds <= e.end_date);
                    const isDropHere = dropTarget?.date === ds && dropTarget?.memberId === '__month__';

                    return (
                      <div
                        key={ds}
                        className={cn(
                          'min-h-[80px] sm:min-h-[100px] border-b border-r border-border last:border-r-0 p-1 transition-colors',
                          !isCurrentMonth && 'opacity-40',
                          isWeekend && 'bg-muted/10',
                          isToday && 'bg-primary/5',
                          isDropHere && 'bg-primary/20',
                        )}
                        onDragOver={e => { e.preventDefault(); setDropTarget({ memberId: '__month__', date: ds }); }}
                        onDragLeave={onDragLeave}
                        onDrop={e => {
                          e.preventDefault();
                          setDropTarget(null);
                          if (dragging) {
                            if (dragging.type === 'project') {
                              setForm({ title: projects.find(p => p.id === dragging.id)?.name || '', eventType: 'chantier', startDate: ds, endDate: ds, memberIds: [], projectId: dragging.id, notes: '', halfDay: 'full' });
                            } else {
                              const evt = events.find(ev => ev.id === dragging.id);
                              if (evt) {
                                const dur = daysBetween(evt.start_date, evt.end_date);
                                setForm({ title: evt.title, eventType: evt.event_type, startDate: ds, endDate: toDateStr(addDays(new Date(ds), dur - 1)), memberIds: evt.team_member_id ? [evt.team_member_id] : [], projectId: evt.project_id || '', notes: evt.notes || '', halfDay: (evt.half_day || 'full') as HalfDay });
                                setEditingEvent(evt);
                              }
                            }
                            setShowCreate(true);
                            setDragging(null);
                          }
                        }}
                      >
                        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium', isToday ? 'bg-primary text-primary-foreground' : 'text-foreground')}>
                          {day.getDate()}
                        </span>
                        <div className="mt-0.5 space-y-0.5">
                          {dayAllEvents.slice(0, 3).map(evt => {
                            const cfg = EVENT_TYPE_CONFIG[evt.event_type] || EVENT_TYPE_CONFIG.autre;
                            const h = (evt.half_day || 'full') as HalfDay;
                            return (
                              <div
                                key={evt.id}
                                onClick={() => openEdit(evt)}
                                className={cn('rounded px-1 py-0.5 text-[10px] font-medium truncate border cursor-pointer', cfg.bg, cfg.border, cfg.text)}
                              >
                                <span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: evt.team_members?.color || '#94a3b8' }} />
                                {h !== 'full' && (h === 'am'
                                  ? <Sunrise className="h-2.5 w-2.5 inline-block opacity-50 mr-0.5 -mt-px" />
                                  : <Sunset className="h-2.5 w-2.5 inline-block opacity-50 mr-0.5 -mt-px" />
                                )}
                                {evt.title}
                              </div>
                            );
                          })}
                          {dayAllEvents.length > 3 && (
                            <p className="text-[10px] text-muted-foreground pl-1">+{dayAllEvents.length - 3}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Legende */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {Object.entries(EVENT_TYPE_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={cn('h-3 w-3 rounded border', cfg.bg, cfg.border)} />
                {cfg.label}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2 border-l border-border pl-3">
              <Sunrise className="h-3 w-3 opacity-60" /> Matin
              <Sunset className="h-3 w-3 opacity-60 ml-2" /> Après-midi
            </div>
          </div>
        </div>
      </div>

      {/* ─── Dialog event ─── */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeForm(); else setShowCreate(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Modifier' : 'Nouvel'} évènement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Titre *</label>
                <Input className="mt-1" placeholder="Ex : Chantier Dupont" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={form.eventType} onValueChange={v => setForm({ ...form, eventType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chantier">Chantier</SelectItem>
                    <SelectItem value="conge">Absence</SelectItem>
                    <SelectItem value="reunion">Réunion</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Multi-member selection */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {editingEvent ? 'Membre' : 'Membres'}
                {!editingEvent && <span className="text-muted-foreground font-normal text-xs ml-1">(sélection multiple)</span>}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[140px] overflow-y-auto">
                {members.map(m => {
                  const selected = form.memberIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2 text-left transition-all',
                        selected
                          ? 'border-primary bg-primary/10 shadow-sm'
                          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50',
                      )}
                    >
                      <MemberAvatar name={m.name} avatarUrl={m.avatar_url} color={m.color} size="sm" />
                      <span className="text-xs font-medium truncate">{m.name}</span>
                    </button>
                  );
                })}
              </div>
              {!editingEvent && form.memberIds.length > 1 && (
                <p className="text-xs text-muted-foreground mt-1">{form.memberIds.length} membres sélectionnés</p>
              )}
            </div>

            {form.eventType === 'chantier' && (
              <div>
                <label className="text-sm font-medium">Chantier</label>
                <Select value={form.projectId} onValueChange={v => {
                  const proj = projects.find(p => p.id === v);
                  setForm({ ...form, projectId: v, title: form.title || proj?.name || '' });
                }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Lier un chantier…" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Début *</label>
                <Input className="mt-1" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Fin</label>
                <Input className="mt-1" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            {/* Half-day toggle */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Créneau</label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['full', 'am', 'pm'] as HalfDay[]).map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setForm({ ...form, halfDay: h })}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                      form.halfDay === h ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    {h === 'full' && <Sun className="h-3.5 w-3.5" />}
                    {h === 'am' && <Sunrise className="h-3.5 w-3.5" />}
                    {h === 'pm' && <Sunset className="h-3.5 w-3.5" />}
                    {HALF_DAY_LABELS[h]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input className="mt-1" placeholder="Notes optionnelles…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                {editingEvent && (
                  <Button variant="destructive" size="sm" onClick={() => deleteEvent(editingEvent.id)} className="gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeForm}>Annuler</Button>
                <Button onClick={saveEvent} disabled={!form.title.trim() || !form.startDate}>
                  {editingEvent ? 'Enregistrer' : 'Créer'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog absence ─── */}
      <Dialog open={showAbsence} onOpenChange={(open) => { if (!open) closeAbsence(); else setShowAbsence(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex items-center justify-center h-9 w-9 rounded-full bg-emerald-100">
                <Umbrella className="h-4 w-4 text-emerald-600" />
              </div>
              Déclarer une absence
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-4">
            {/* Membre */}
            <div>
              <label className="text-sm font-medium mb-2 block">Qui est absent ?</label>
              {/* Salaries */}
              {members.filter(m => m.type !== 'sous_traitant').length > 0 && (
                <>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Salariés</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                    {members.filter(m => m.type !== 'sous_traitant').map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAbsenceForm({ ...absenceForm, memberId: m.id })}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border-2 p-2.5 text-left transition-all',
                          absenceForm.memberId === m.id
                            ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50',
                        )}
                      >
                        <MemberAvatar name={m.name} avatarUrl={m.avatar_url} color={m.color} size="sm" />
                        <span className="text-xs font-medium truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {/* Sous-traitants */}
              {members.filter(m => m.type === 'sous_traitant').length > 0 && (
                <>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Sous-traitants <span className="normal-case tracking-normal font-normal">{'\u2014'} à titre informatif</span></p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {members.filter(m => m.type === 'sous_traitant').map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setAbsenceForm({ ...absenceForm, memberId: m.id })}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border-2 p-2.5 text-left transition-all',
                          absenceForm.memberId === m.id
                            ? 'border-amber-400 bg-amber-50 shadow-sm'
                            : 'border-dashed border-border hover:border-muted-foreground/30 hover:bg-muted/50',
                        )}
                      >
                        <MemberAvatar name={m.name} avatarUrl={m.avatar_url} color={m.color} size="sm" />
                        <span className="text-xs font-medium truncate">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Du</label>
                <Input
                  type="date"
                  value={absenceForm.startDate}
                  onChange={e => {
                    const start = e.target.value;
                    setAbsenceForm({
                      ...absenceForm,
                      startDate: start,
                      endDate: absenceForm.endDate && absenceForm.endDate < start ? start : absenceForm.endDate,
                    });
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Au</label>
                <Input
                  type="date"
                  value={absenceForm.endDate}
                  min={absenceForm.startDate}
                  onChange={e => setAbsenceForm({ ...absenceForm, endDate: e.target.value })}
                />
              </div>
            </div>

            {/* Half-day toggle for absence */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Créneau</label>
              <div className="flex rounded-lg border border-border overflow-hidden">
                {(['full', 'am', 'pm'] as HalfDay[]).map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setAbsenceForm({ ...absenceForm, halfDay: h })}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                      absenceForm.halfDay === h ? 'bg-emerald-600 text-white' : 'hover:bg-muted',
                    )}
                  >
                    {h === 'full' && <Sun className="h-3.5 w-3.5" />}
                    {h === 'am' && <Sunrise className="h-3.5 w-3.5" />}
                    {h === 'pm' && <Sunset className="h-3.5 w-3.5" />}
                    {HALF_DAY_LABELS[h]}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration preview + sous-traitant info */}
            {absenceForm.startDate && absenceForm.endDate && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <Clock className="h-3.5 w-3.5" />
                {daysBetween(absenceForm.startDate, absenceForm.endDate)} jour{daysBetween(absenceForm.startDate, absenceForm.endDate) > 1 ? 's' : ''}
                {absenceForm.halfDay !== 'full' && ` (${HALF_DAY_LABELS[absenceForm.halfDay].toLowerCase()})`}
              </div>
            )}
            {absenceForm.memberId && members.find(m => m.id === absenceForm.memberId)?.type === 'sous_traitant' && (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                Sous-traitant {'\u2014'} indisponible sur cette période (à titre informatif)
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-sm font-medium mb-1 block">Motif <span className="text-muted-foreground font-normal">(optionnel)</span></label>
              <Input
                placeholder="Ex : Vacances, maladie, formation…"
                value={absenceForm.notes}
                onChange={e => setAbsenceForm({ ...absenceForm, notes: e.target.value })}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeAbsence}>Annuler</Button>
              <Button
                onClick={saveAbsence}
                disabled={!absenceForm.memberId || !absenceForm.startDate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
