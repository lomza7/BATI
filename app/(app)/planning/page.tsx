'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, CalendarDays, HardHat, Users, Grip,
  Trash2, Clock, Umbrella, Coffee, Briefcase, X, GripVertical,
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

// ─── Types ───────────────────────────────────────────────────────────
interface PlanningEvent {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string;
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

// ─── Helpers ─────────────────────────────────────────────────────────
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
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
  conge: { label: 'Conge', icon: Umbrella, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
  reunion: { label: 'Reunion', icon: Coffee, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  autre: { label: 'Autre', icon: Briefcase, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
};

// ─── Component ───────────────────────────────────────────────────────
export default function PlanningPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Drag state
  const [dragging, setDragging] = useState<{ type: 'project' | 'event'; id: string; title: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ memberId: string; date: string } | null>(null);

  // Event form
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlanningEvent | null>(null);
  const [form, setForm] = useState({ title: '', eventType: 'chantier', startDate: '', endDate: '', memberId: '', projectId: '', notes: '' });

  const todayStr = toDateStr(new Date());

  // ─── Data loading ──────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [eventsRes, membersRes, projectsRes] = await Promise.all([
      supabase.from('planning_events').select('id, title, event_type, start_date, end_date, team_member_id, project_id, notes, projects(name), team_members(name, color)').order('start_date'),
      supabase.from('team_members').select('id, name, role, color, specialty, type, avatar_url').order('name'),
      supabase.from('projects').select('id, name, status, city').in('status', ['a_planifier', 'en_cours']).order('name'),
    ]);
    setEvents((eventsRes.data as unknown as PlanningEvent[]) || []);
    setMembers((membersRes.data as unknown as TeamMember[]) || []);
    setProjects((projectsRes.data as unknown as Project[]) || []);
    setLoading(false);
  }

  // ─── CRUD ──────────────────────────────────────────────────────────
  async function saveEvent() {
    if (!editingEvent && !user) return;

    const payload = {
      ...(editingEvent ? {} : { user_id: user!.id }),
      title: form.title,
      event_type: form.eventType,
      start_date: form.startDate,
      end_date: form.endDate || form.startDate,
      team_member_id: form.memberId || null,
      project_id: form.projectId || null,
      notes: form.notes,
    };
    if (editingEvent) {
      await supabase.from('planning_events').update(payload).eq('id', editingEvent.id);
    } else {
      await supabase.from('planning_events').insert(payload);
    }
    closeForm();
    loadData();
  }

  async function deleteEvent(id: string) {
    await supabase.from('planning_events').delete().eq('id', id);
    closeForm();
    loadData();
  }

  async function moveEvent(eventId: string, newMemberId: string, newDate: string) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    const duration = daysBetween(event.start_date, event.end_date);
    const newEnd = toDateStr(addDays(new Date(newDate), duration - 1));
    await supabase.from('planning_events').update({
      team_member_id: newMemberId,
      start_date: newDate,
      end_date: newEnd,
    }).eq('id', eventId);
    loadData();
  }

  async function createFromDrop(projectId: string, memberId: string, date: string) {
    const project = projects.find(p => p.id === projectId);
    if (!project || !user) return;
    await supabase.from('planning_events').insert({
      user_id: user.id,
      title: project.name,
      event_type: 'chantier',
      start_date: date,
      end_date: date,
      team_member_id: memberId,
      project_id: projectId,
    });
    loadData();
  }

  function closeForm() {
    setShowCreate(false);
    setEditingEvent(null);
    setForm({ title: '', eventType: 'chantier', startDate: '', endDate: '', memberId: '', projectId: '', notes: '' });
  }

  function openEdit(e: PlanningEvent) {
    setForm({
      title: e.title,
      eventType: e.event_type,
      startDate: e.start_date,
      endDate: e.end_date,
      memberId: e.team_member_id || '',
      projectId: e.project_id || '',
      notes: e.notes || '',
    });
    setEditingEvent(e);
    setShowCreate(true);
  }

  function openCreateWithDefaults(memberId: string, date: string) {
    setForm({ title: '', eventType: 'chantier', startDate: date, endDate: date, memberId, projectId: '', notes: '' });
    setEditingEvent(null);
    setShowCreate(true);
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

  // ─── Event helpers ─────────────────────────────────────────────────
  function getEventsForMemberDay(memberId: string, dateStr: string) {
    return events.filter(e => e.team_member_id === memberId && dateStr >= e.start_date && dateStr <= e.end_date);
  }

  function getUnassignedEvents(dateStr: string) {
    return events.filter(e => !e.team_member_id && dateStr >= e.start_date && dateStr <= e.end_date);
  }

  // ─── Drag & Drop handlers ─────────────────────────────────────────
  function onDragStart(type: 'project' | 'event', id: string, title: string) {
    setDragging({ type, id, title });
  }

  function onDragOver(e: React.DragEvent, memberId: string, date: string) {
    e.preventDefault();
    setDropTarget({ memberId, date });
  }

  function onDragLeave() {
    setDropTarget(null);
  }

  function onDrop(e: React.DragEvent, memberId: string, date: string) {
    e.preventDefault();
    setDropTarget(null);
    if (!dragging) return;

    if (dragging.type === 'project') {
      createFromDrop(dragging.id, memberId, date);
    } else {
      moveEvent(dragging.id, memberId, date);
    }
    setDragging(null);
  }

  function onDragEnd() {
    setDragging(null);
    setDropTarget(null);
  }

  // ─── Week label ────────────────────────────────────────────────────
  const headerLabel = view === 'week'
    ? `Semaine du ${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
    : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <PageHeader title="Planning" description="Planification de votre equipe et chantiers">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setForm({ ...form, eventType: 'conge' }); setShowCreate(true); }} className="gap-2 hidden sm:flex">
            <Umbrella className="h-4 w-4" /> Conge
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Evenement
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ─── Sidebar: Chantiers à planifier ─── */}
        <div className="lg:w-56 shrink-0">
          <div className="rounded-xl border border-border bg-card p-3">
            <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <HardHat className="h-3.5 w-3.5" /> Chantiers
            </h3>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 text-center">Aucun chantier actif</p>
              ) : projects.map(p => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => onDragStart('project', p.id, p.name)}
                  onDragEnd={onDragEnd}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                    {p.city && <p className="text-[10px] text-muted-foreground truncate">{p.city}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Unassigned events */}
          {events.filter(e => !e.team_member_id).length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3 mt-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Non affectes</h3>
              <div className="space-y-1.5">
                {events.filter(e => !e.team_member_id).map(e => {
                  const cfg = EVENT_TYPE_CONFIG[e.event_type] || EVENT_TYPE_CONFIG.autre;
                  return (
                    <div
                      key={e.id}
                      draggable
                      onDragStart={() => onDragStart('event', e.id, e.title)}
                      onDragEnd={onDragEnd}
                      onClick={() => openEdit(e)}
                      className={cn('rounded-lg border p-2 cursor-grab active:cursor-grabbing text-xs', cfg.bg, cfg.border)}
                    >
                      <p className={cn('font-medium truncate', cfg.text)}>{e.title}</p>
                      <p className="text-[10px] text-muted-foreground">{e.start_date}{e.end_date !== e.start_date ? ` → ${e.end_date}` : ''}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

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
              <p className="mt-3 text-sm text-muted-foreground">Ajoutez des membres dans la page Equipe pour commencer a planifier.</p>
            </div>
          ) : view === 'week' ? (
            /* ─── VUE SEMAINE ─── */
            <div className="rounded-xl border border-border bg-card overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted/50 border-b border-r border-border p-2 text-left w-40">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Equipe</span>
                    </th>
                    {weekDays.map(day => {
                      const ds = toDateStr(day);
                      const isToday = ds === todayStr;
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      return (
                        <th key={ds} className={cn('border-b border-r border-border p-2 text-center min-w-[90px]', isWeekend ? 'bg-muted/30' : 'bg-muted/10', isToday && 'bg-primary/5')}>
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
                        const cellEvents = getEventsForMemberDay(member.id, ds);
                        const isDropHere = dropTarget?.memberId === member.id && dropTarget?.date === ds;

                        return (
                          <td
                            key={ds}
                            className={cn(
                              'border-b border-r border-border p-1 align-top transition-colors min-h-[60px] h-16',
                              isWeekend ? 'bg-muted/10' : '',
                              isToday && 'bg-primary/5',
                              isDropHere && 'bg-primary/20 ring-2 ring-inset ring-primary/40',
                            )}
                            onDragOver={e => onDragOver(e, member.id, ds)}
                            onDragLeave={onDragLeave}
                            onDrop={e => onDrop(e, member.id, ds)}
                            onClick={() => {
                              if (cellEvents.length === 0) openCreateWithDefaults(member.id, ds);
                            }}
                          >
                            <div className="space-y-0.5">
                              {cellEvents.map(evt => {
                                const cfg = EVENT_TYPE_CONFIG[evt.event_type] || EVENT_TYPE_CONFIG.autre;
                                const isStart = evt.start_date === ds;
                                return (
                                  <div
                                    key={evt.id}
                                    draggable
                                    onDragStart={(e) => { e.stopPropagation(); onDragStart('event', evt.id, evt.title); }}
                                    onDragEnd={onDragEnd}
                                    onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-grab active:cursor-grabbing border transition-shadow hover:shadow-sm',
                                      cfg.bg, cfg.border, cfg.text,
                                      !isStart && 'rounded-l-none border-l-0',
                                      evt.end_date !== ds && 'rounded-r-none border-r-0',
                                    )}
                                    style={{ borderLeftColor: isStart ? member.color : undefined, borderLeftWidth: isStart ? 3 : undefined }}
                                  >
                                    {isStart ? evt.title : ''}
                                  </div>
                                );
                              })}
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
            /* ─── VUE MOIS ─── */
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
                          // In month view, open form to pick member
                          if (dragging) {
                            if (dragging.type === 'project') {
                              setForm({ title: projects.find(p => p.id === dragging.id)?.name || '', eventType: 'chantier', startDate: ds, endDate: ds, memberId: '', projectId: dragging.id, notes: '' });
                            } else {
                              const evt = events.find(ev => ev.id === dragging.id);
                              if (evt) {
                                const dur = daysBetween(evt.start_date, evt.end_date);
                                setForm({ title: evt.title, eventType: evt.event_type, startDate: ds, endDate: toDateStr(addDays(new Date(ds), dur - 1)), memberId: evt.team_member_id || '', projectId: evt.project_id || '', notes: evt.notes || '' });
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
                            return (
                              <div
                                key={evt.id}
                                onClick={() => openEdit(evt)}
                                className={cn('rounded px-1 py-0.5 text-[10px] font-medium truncate border cursor-pointer', cfg.bg, cfg.border, cfg.text)}
                              >
                                <span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ backgroundColor: evt.team_members?.color || '#94a3b8' }} />
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
          </div>
        </div>
      </div>

      {/* ─── Dialog event ─── */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeForm(); else setShowCreate(true); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Modifier' : 'Nouvel'} evenement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Titre *</label>
                <Input className="mt-1" placeholder="Ex: Chantier Dupont" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={form.eventType} onValueChange={v => setForm({ ...form, eventType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chantier">Chantier</SelectItem>
                    <SelectItem value="conge">Conge</SelectItem>
                    <SelectItem value="reunion">Reunion</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Membre</label>
                <Select value={form.memberId} onValueChange={v => setForm({ ...form, memberId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                          {m.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {form.eventType === 'chantier' && (
                <div>
                  <label className="text-sm font-medium">Chantier</label>
                  <Select value={form.projectId} onValueChange={v => {
                    const proj = projects.find(p => p.id === v);
                    setForm({ ...form, projectId: v, title: form.title || proj?.name || '' });
                  }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Lier un chantier..." /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Debut *</label>
                <Input className="mt-1" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Fin</label>
                <Input className="mt-1" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input className="mt-1" placeholder="Notes optionnelles..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
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
                  {editingEvent ? 'Enregistrer' : 'Creer'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
