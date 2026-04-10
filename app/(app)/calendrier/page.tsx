'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Trash2, Clock,
  RefreshCw, Unplug, CalendarCheck, Edit2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ClientPicker } from '@/components/shared/client-picker';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────
interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  client_id: string | null;
  clients: { name: string } | null;
  color: string;
  source: string;
  google_event_id: string | null;
}

type ViewMode = 'week' | 'month';

const EVENT_CATEGORIES: Record<string, { label: string; color: string }> = {
  rdv_client: { label: 'RDV Client', color: '#3b82f6' },
  rdv_fournisseur: { label: 'RDV Fournisseur', color: '#8b5cf6' },
  visite_chantier: { label: 'Visite chantier', color: '#f59e0b' },
  administratif: { label: 'Administratif', color: '#6b7280' },
  commercial: { label: 'Commercial', color: '#10b981' },
  formation: { label: 'Formation', color: '#ec4899' },
  personnel: { label: 'Personnel', color: '#ef4444' },
  autre: { label: 'Autre', color: '#6b7280' },
};

// ─── Helpers ────────────────────────────────────────────────────────
const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const COLOR_OPTIONS = [
  { value: '#3b82f6', label: 'Bleu' },
  { value: '#ef4444', label: 'Rouge' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#10b981', label: 'Vert' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#ec4899', label: 'Rose' },
  { value: '#6b7280', label: 'Gris' },
];

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function formatTime(t: string | null) {
  if (!t) return '';
  return t.slice(0, 5);
}

// ─── Component ──────────────────────────────────────────────────────
export default function CalendrierPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalPulling, setGcalPulling] = useState(false);

  // Event form
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', category: 'rdv_client', startDate: '', endDate: '',
    startTime: '', endTime: '', color: '#3b82f6', clientId: null as string | null,
  });

  const todayStr = toDateStr(new Date());

  // ─── Data loading ─────────────────────────────────────────────────
  useEffect(() => { loadData(); }, []);

  async function loadData() {
    // Fetch personal calendar events + owner's planning events (team_member_id IS NULL)
    const [calRes, planRes] = await Promise.all([
      supabase.from('calendar_events').select('*, clients(name)').order('start_date'),
      supabase.from('planning_events').select('id, title, event_type, start_date, end_date, half_day, notes, project_id, projects(name, deleted_at)').is('team_member_id', null).order('start_date'),
    ]);

    const calEvents = ((calRes.data || []) as CalendarEvent[]);

    // Map planning events to CalendarEvent shape
    const planningRows = ((planRes.data || []) as unknown as {
      id: string; title: string; event_type: string; start_date: string; end_date: string;
      half_day: string; notes: string; project_id: string | null; projects: { name: string; deleted_at: string | null }[] | { name: string; deleted_at: string | null } | null;
    }[]);

    const planningAsCalendar: CalendarEvent[] = planningRows
      .filter((pe) => {
        const relatedProject = Array.isArray(pe.projects) ? (pe.projects[0] || null) : pe.projects;
        return !pe.project_id || !relatedProject?.deleted_at;
      })
      .map((pe) => ({
      id: pe.id,
      title: pe.title,
      description: pe.notes || '',
      category: pe.event_type === 'chantier' ? 'visite_chantier' : pe.event_type === 'conge' ? 'personnel' : pe.event_type === 'reunion' ? 'rdv_client' : 'autre',
      start_date: pe.start_date,
      end_date: pe.end_date,
      start_time: pe.half_day === 'am' ? '08:00:00' : pe.half_day === 'pm' ? '13:00:00' : null,
      end_time: pe.half_day === 'am' ? '12:00:00' : pe.half_day === 'pm' ? '17:00:00' : null,
      client_id: null,
      clients: null,
      color: EVENT_CATEGORIES[pe.event_type === 'chantier' ? 'visite_chantier' : pe.event_type === 'conge' ? 'personnel' : 'autre']?.color || '#6b7280',
      source: 'planning',
      google_event_id: null,
    }));

    // Deduplicate: if a calendar event has same title+date as a planning event, keep calendar version
    const calKeys = new Set(calEvents.map(e => `${e.title}__${e.start_date}`));
    const uniquePlanning = planningAsCalendar.filter(pe => !calKeys.has(`${pe.title}__${pe.start_date}`));

    setEvents([...calEvents, ...uniquePlanning]);
    setLoading(false);
  }

  // ─── Google Calendar ──────────────────────────────────────────────
  useEffect(() => {
    async function checkGcal() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/google-calendar/status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setGcalConnected(data.connected);
        }
      } catch { /* silent */ }
    }
    checkGcal();

    // Detect callback params
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_calendar_connected') === '1') {
      setGcalConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
      // Auto-pull on first connect
      pullFromGoogle();
    }
    if (params.get('google_error')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }

  async function syncToGoogle(eventId: string, action: 'create' | 'update' | 'delete') {
    if (!gcalConnected) return;
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/google-calendar/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[GCal sync]', action, err);
      }
    } catch (e) { console.error('[GCal sync error]', e); }
  }

  async function pullFromGoogle() {
    setGcalPulling(true);
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/google-calendar/pull', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) await loadData();
    } catch { /* silent */ }
    setGcalPulling(false);
  }

  async function disconnectGcal() {
    try {
      const token = await getAccessToken();
      await fetch('/api/google-calendar/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setGcalConnected(false);
    } catch { /* silent */ }
  }

  // Map calendar category to planning event_type
  function categoryToEventType(cat: string) {
    if (cat === 'visite_chantier') return 'chantier';
    if (cat === 'personnel') return 'conge';
    if (cat === 'rdv_client' || cat === 'rdv_fournisseur' || cat === 'commercial') return 'reunion';
    return 'autre';
  }

  // Compute half_day from times
  function timesToHalfDay(startTime: string, endTime: string): string {
    if (!startTime && !endTime) return 'full';
    const sh = parseInt(startTime?.split(':')[0] || '0');
    const eh = parseInt(endTime?.split(':')[0] || '23');
    if (eh <= 13) return 'am';
    if (sh >= 12) return 'pm';
    return 'full';
  }

  // ─── CRUD ─────────────────────────────────────────────────────────
  async function saveEvent() {
    if (!user) return;

    const isPlanningEvent = editingEvent?.source === 'planning';

    if (editingEvent) {
      if (isPlanningEvent) {
        // Update the planning_event directly
        await supabase.from('planning_events').update({
          title: form.title,
          notes: form.description,
          event_type: categoryToEventType(form.category),
          start_date: form.startDate,
          end_date: form.endDate || form.startDate,
          half_day: timesToHalfDay(form.startTime, form.endTime),
        }).eq('id', editingEvent.id);
      } else {
        await supabase.from('calendar_events').update({
          title: form.title,
          description: form.description,
          category: form.category,
          start_date: form.startDate,
          end_date: form.endDate || form.startDate,
          start_time: form.startTime || null,
          end_time: form.endTime || null,
          color: form.color,
          client_id: form.clientId,
        }).eq('id', editingEvent.id);
        syncToGoogle(editingEvent.id, 'update');
      }
    } else {
      // Create in calendar_events
      const { data: inserted } = await supabase.from('calendar_events').insert({
        user_id: user.id,
        title: form.title,
        description: form.description,
        category: form.category,
        start_date: form.startDate,
        end_date: form.endDate || form.startDate,
        start_time: form.startTime || null,
        end_time: form.endTime || null,
        color: form.color,
        client_id: form.clientId,
      }).select('id');
      if (inserted?.[0]) syncToGoogle(inserted[0].id, 'create');

      // Also create in planning_events so it shows on the owner's row
      await supabase.from('planning_events').insert({
        user_id: user.id,
        title: form.title,
        event_type: categoryToEventType(form.category),
        start_date: form.startDate,
        end_date: form.endDate || form.startDate,
        team_member_id: null,
        notes: form.description,
        half_day: timesToHalfDay(form.startTime, form.endTime),
      });
    }
    closeForm();
    loadData();
  }

  async function deleteEvent(id: string) {
    const evt = events.find(e => e.id === id);
    if (evt?.source === 'planning') {
      await supabase.from('planning_events').delete().eq('id', id);
    } else {
      syncToGoogle(id, 'delete');
      await supabase.from('calendar_events').delete().eq('id', id);
      // Also delete matching planning_event
      await supabase.from('planning_events').delete()
        .eq('title', evt?.title || '')
        .eq('start_date', evt?.start_date || '')
        .is('team_member_id', null);
    }
    closeForm();
    loadData();
  }

  function closeForm() {
    setShowCreate(false);
    setEditingEvent(null);
    setForm({ title: '', description: '', category: 'rdv_client', startDate: '', endDate: '', startTime: '', endTime: '', color: '#3b82f6', clientId: null });
  }

  function openEdit(evt: CalendarEvent) {
    setForm({
      title: evt.title,
      description: evt.description || '',
      category: evt.category || 'autre',
      startDate: evt.start_date,
      endDate: evt.end_date,
      startTime: evt.start_time || '',
      endTime: evt.end_time || '',
      color: evt.color || '#3b82f6',
      clientId: evt.client_id,
    });
    setEditingEvent(evt);
    setShowCreate(true);
  }

  function openCreateOnDate(date: string) {
    setForm({ title: '', description: '', category: 'rdv_client', startDate: date, endDate: date, startTime: '', endTime: '', color: EVENT_CATEGORIES.rdv_client.color, clientId: null });
    setEditingEvent(null);
    setShowCreate(true);
  }

  // ─── Navigation ───────────────────────────────────────────────────
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

  const headerLabel = view === 'week'
    ? `Semaine du ${weekDays[0].getDate()} ${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getFullYear()}`
    : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  // ─── Event helpers ────────────────────────────────────────────────
  function getEventsForDate(dateStr: string) {
    return events.filter(e => dateStr >= e.start_date && dateStr <= e.end_date);
  }

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <PageHeader title="Calendrier" description="Votre agenda personnel et Google Calendar">
        <div className="flex gap-2">
          {gcalConnected ? (
            <>
              <Button variant="outline" size="sm" onClick={pullFromGoogle} disabled={gcalPulling} className="gap-1.5">
                <RefreshCw className={cn('h-4 w-4', gcalPulling && 'animate-spin')} />
                <span className="hidden sm:inline">Synchroniser</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={disconnectGcal} className="gap-1.5 text-muted-foreground" title="Déconnecter Google Calendar">
                <Unplug className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="outline" className="gap-2" onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) return;
              window.location.href = `/api/google-calendar/connect?token=${session.access_token}`;
            }}>
              <CalendarCheck className="h-4 w-4" />
              Connecter Google Calendar
            </Button>
          )}
          <Button onClick={() => { setForm({ title: '', description: '', category: 'rdv_client', startDate: todayStr, endDate: todayStr, startTime: '', endTime: '', color: EVENT_CATEGORIES.rdv_client.color, clientId: null }); setShowCreate(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Événement
          </Button>
        </div>
      </PageHeader>

      {/* Google Calendar status banner */}
      {gcalConnected && (
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CalendarCheck className="h-3.5 w-3.5" />
          Google Calendar connecté — vos événements sont synchronisés
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm sm:text-base font-semibold text-foreground whitespace-nowrap">{headerLabel}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>Aujourd&apos;hui</Button>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              onClick={() => setView('week')}
            >
              Semaine
            </button>
            <button
              className={cn('px-3 py-1.5 text-xs font-medium transition-colors', view === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
              onClick={() => setView('month')}
            >
              Mois
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      ) : view === 'week' ? (
        /* ─── VUE SEMAINE ─── */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header jours */}
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map(day => {
              const ds = toDateStr(day);
              const isToday = ds === todayStr;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              return (
                <div key={ds} className={cn('px-2 py-3 text-center border-r border-border last:border-r-0', isWeekend ? 'bg-muted/30' : 'bg-muted/10', isToday && 'bg-primary/5')}>
                  <span className="text-[10px] font-medium uppercase text-muted-foreground block">{DAYS_SHORT[(day.getDay() + 6) % 7]}</span>
                  <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold mt-0.5', isToday ? 'bg-primary text-primary-foreground' : 'text-foreground')}>
                    {day.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Body */}
          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDays.map(day => {
              const ds = toDateStr(day);
              const isToday = ds === todayStr;
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const dayEvents = getEventsForDate(ds);

              return (
                <div
                  key={ds}
                  className={cn(
                    'border-r border-border last:border-r-0 p-1.5 cursor-pointer hover:bg-muted/20 transition-colors',
                    isWeekend && 'bg-muted/10',
                    isToday && 'bg-primary/5',
                  )}
                  onClick={() => openCreateOnDate(ds)}
                >
                  <div className="space-y-1">
                    {dayEvents.map(evt => {
                      const isStart = evt.start_date === ds;
                      const isGoogle = evt.source === 'google_calendar';
                      const isPlanning = evt.source === 'planning';
                      return (
                        <div
                          key={evt.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                          className={cn(
                            'rounded-md px-2 py-1.5 text-xs font-medium cursor-pointer border transition-shadow hover:shadow-sm',
                            !isStart && 'rounded-l-none border-l-0',
                            evt.end_date !== ds && 'rounded-r-none border-r-0',
                            isPlanning && 'border-dashed',
                          )}
                          style={{
                            backgroundColor: `${evt.color}15`,
                            borderColor: `${evt.color}40`,
                            color: evt.color,
                            borderLeftColor: isStart ? evt.color : undefined,
                            borderLeftWidth: isStart ? 3 : undefined,
                          }}
                        >
                          <div className="flex items-center gap-1">
                            {isGoogle && (
                              <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-blue-500 text-white text-[7px] font-bold shrink-0">G</span>
                            )}
                            {isStart && (
                              <span className="truncate">{evt.title}</span>
                            )}
                          </div>
                          {isStart && (evt.start_time || evt.clients?.name || evt.category) && (
                            <p className="text-[10px] opacity-70 mt-0.5 truncate">
                              {evt.category && EVENT_CATEGORIES[evt.category] && (
                                <>{EVENT_CATEGORIES[evt.category].label}</>
                              )}
                              {evt.category && (evt.start_time || evt.clients?.name) && ' · '}
                              {evt.start_time && <>{formatTime(evt.start_time)}{evt.end_time ? ` - ${formatTime(evt.end_time)}` : ''}</>}
                              {evt.start_time && evt.clients?.name && ' · '}
                              {evt.clients?.name}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ─── VUE MOIS ─── */
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {DAYS_SHORT.map(d => (
              <div key={d} className="bg-muted/30 px-2 py-2 text-center text-[10px] font-medium uppercase text-muted-foreground border-r border-border last:border-r-0">{d}</div>
            ))}
          </div>
          {monthWeeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map(day => {
                const ds = toDateStr(day);
                const isToday = ds === todayStr;
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const dayEvents = getEventsForDate(ds);

                return (
                  <div
                    key={ds}
                    className={cn(
                      'min-h-[90px] sm:min-h-[110px] border-b border-r border-border last:border-r-0 p-1.5 cursor-pointer hover:bg-muted/20 transition-colors',
                      !isCurrentMonth && 'opacity-40',
                      isWeekend && 'bg-muted/10',
                      isToday && 'bg-primary/5',
                    )}
                    onClick={() => openCreateOnDate(ds)}
                  >
                    <span className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                    )}>
                      {day.getDate()}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 3).map(evt => {
                        const isGoogle = evt.source === 'google_calendar';
                        return (
                          <div
                            key={evt.id}
                            onClick={(e) => { e.stopPropagation(); openEdit(evt); }}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer border transition-shadow hover:shadow-sm"
                            style={{
                              backgroundColor: `${evt.color}15`,
                              borderColor: `${evt.color}40`,
                              color: evt.color,
                            }}
                          >
                            {isGoogle && (
                              <span className="inline-flex items-center justify-center h-3 w-3 rounded-full bg-blue-500 text-white text-[7px] font-bold mr-0.5 -mt-px">G</span>
                            )}
                            {evt.start_time && <span className="opacity-60">{formatTime(evt.start_time)} </span>}
                            {evt.title}
                            {(evt.clients?.name || evt.category) && (
                              <span className="opacity-60">
                                {evt.clients?.name && ` · ${evt.clients.name}`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3}</p>
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
      <div className="flex items-center gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
        {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
            {cat.label}
          </div>
        ))}
        {gcalConnected && (
          <div className="flex items-center gap-1.5 border-l border-border pl-3">
            <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-blue-500 text-white text-[7px] font-bold">G</span>
            Google Calendar
          </div>
        )}
      </div>

      {/* ─── Dialog événement ─── */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) closeForm(); else setShowCreate(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingEvent ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingEvent ? 'Modifier' : 'Nouvel'} événement
              {editingEvent?.source === 'google_calendar' && (
                <span className="inline-flex items-center gap-1 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full ml-2">
                  <span className="inline-flex items-center justify-center h-3 w-3 rounded-full bg-blue-500 text-white text-[7px] font-bold">G</span>
                  Google
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Titre *</label>
                <Input className="mt-1" placeholder="Ex : Réunion client…" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Catégorie</label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v, color: EVENT_CATEGORIES[v]?.color || form.color })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          {cat.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Client / Contact */}
            <div>
              <label className="text-sm font-medium mb-1 block">Client / Contact <span className="text-muted-foreground font-normal">(optionnel)</span></label>
              <ClientPicker
                value={form.clientId}
                onChange={(clientId) => setForm({ ...form, clientId })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Début *</label>
                <Input className="mt-1" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Fin</label>
                <Input className="mt-1" type="date" value={form.endDate} min={form.startDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Heure début</label>
                <Input className="mt-1" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Heure fin</label>
                <Input className="mt-1" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Couleur</label>
              <div className="flex gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={cn(
                      'h-7 w-7 rounded-full border-2 transition-all',
                      form.color === c.value ? 'border-foreground scale-110 shadow-sm' : 'border-transparent hover:scale-105',
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                className="mt-1"
                placeholder="Détails de l'événement…"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Duration preview */}
            {form.startDate && form.endDate && daysBetween(form.startDate, form.endDate) > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <Clock className="h-3.5 w-3.5" />
                {daysBetween(form.startDate, form.endDate)} jours
              </div>
            )}

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
    </div>
  );
}
