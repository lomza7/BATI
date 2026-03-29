'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, CalendarDays, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PlanningEvent {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string;
  team_member_id: string | null;
  team_members: { name: string; color: string } | null;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  color: string;
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS = ['Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

export default function PlanningPage() {
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [form, setForm] = useState({ title: '', eventType: 'chantier', startDate: '', endDate: '', memberId: '' });
  const [memberForm, setMemberForm] = useState({ name: '', role: '', color: '#E97F2A' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [eventsRes, membersRes] = await Promise.all([
      supabase.from('planning_events').select('id, title, event_type, start_date, end_date, team_member_id, team_members(name, color)').order('start_date'),
      supabase.from('team_members').select('*').order('name'),
    ]);
    setEvents((eventsRes.data as unknown as PlanningEvent[]) || []);
    setMembers((membersRes.data as unknown as TeamMember[]) || []);
    setLoading(false);
  }

  async function createEvent() {
    await supabase.from('planning_events').insert({
      title: form.title,
      event_type: form.eventType,
      start_date: form.startDate,
      end_date: form.endDate || form.startDate,
      team_member_id: form.memberId || null,
    });
    setShowCreate(false);
    setForm({ title: '', eventType: 'chantier', startDate: '', endDate: '', memberId: '' });
    loadData();
  }

  async function addMember() {
    await supabase.from('team_members').insert(memberForm);
    setShowAddMember(false);
    setMemberForm({ name: '', role: '', color: '#E97F2A' });
    loadData();
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = useMemo(() => getMonthDays(year, month), [year, month]);

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }

  function getEventsForDay(day: Date) {
    const dayStr = day.toISOString().split('T')[0];
    return events.filter(e => dayStr >= e.start_date && dayStr <= e.end_date);
  }

  const today = new Date().toISOString().split('T')[0];

  const EVENT_COLORS: Record<string, string> = {
    chantier: 'bg-primary/20 text-primary border-primary/30',
    conge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    reunion: 'bg-blue-100 text-blue-700 border-blue-200',
    autre: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Planning" description="Planification de votre equipe et chantiers">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddMember(true)} className="gap-2">
            <Users className="h-4 w-4" /> Equipe
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nouvel evenement
          </Button>
        </div>
      </PageHeader>

      {members.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color }} />
              <span className="font-medium text-foreground">{m.name}</span>
              {m.role && <span className="text-muted-foreground">- {m.role}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-base font-semibold text-foreground">{MONTHS[month]} {year}</h2>
          <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        {loading ? (
          <div className="p-8"><div className="h-64 animate-pulse rounded-lg bg-muted" /></div>
        ) : (
          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="border-b border-border bg-muted/30 px-2 py-2 text-center text-[10px] sm:text-xs font-medium uppercase text-muted-foreground">{d}</div>
            ))}
            {days.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[100px] border-b border-r border-border bg-muted/10" />;
              const dayStr = day.toISOString().split('T')[0];
              const dayEvents = getEventsForDay(day);
              const isToday = dayStr === today;
              return (
                <div key={dayStr} className={cn('min-h-[60px] sm:min-h-[100px] border-b border-r border-border p-1 sm:p-1.5 transition-colors hover:bg-muted/20', isToday && 'bg-primary/5')}>
                  <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium', isToday ? 'bg-primary text-primary-foreground' : 'text-foreground')}>
                    {day.getDate()}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id} className={cn('truncate rounded border px-1 sm:px-1.5 py-0.5 text-[10px] leading-tight font-medium', EVENT_COLORS[e.event_type] || EVENT_COLORS.autre)}>
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} autres</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvel evenement</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><label className="text-sm font-medium">Titre</label><Input className="mt-1" placeholder="Ex: Chantier Dupont" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
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
            {members.length > 0 && (
              <div>
                <label className="text-sm font-medium">Membre d&apos;equipe</label>
                <Select value={form.memberId} onValueChange={v => setForm({ ...form, memberId: v })}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Optionnel" /></SelectTrigger>
                  <SelectContent>
                    {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Debut</label><Input className="mt-1" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Fin</label><Input className="mt-1" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createEvent} disabled={!form.title.trim() || !form.startDate}>Creer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter un membre</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><label className="text-sm font-medium">Nom</label><Input className="mt-1" placeholder="Prenom Nom" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Role</label><Input className="mt-1" placeholder="Ex: Chef d'equipe" value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Couleur</label><input type="color" className="mt-1 h-10 w-full rounded-md border border-input cursor-pointer" value={memberForm.color} onChange={e => setMemberForm({ ...memberForm, color: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddMember(false)}>Annuler</Button>
              <Button onClick={addMember} disabled={!memberForm.name.trim()}>Ajouter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
