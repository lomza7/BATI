'use client';

import { useState, useEffect } from 'react';
import { Plus, Users, Search, GripVertical, Phone, Mail, MoveHorizontal as MoreHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { LEAD_STAGES, formatCurrency } from '@/lib/constants';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  stage: string;
  value: number;
  notes: string;
  created_at: string;
}

const SOURCES = [
  { value: 'travaux_com', label: 'Travaux.com' },
  { value: 'bouche_a_oreille', label: 'Bouche a oreille' },
  { value: 'site_web', label: 'Site web' },
  { value: 'autre', label: 'Autre' },
];

const STAGE_ORDER = ['nouveau', 'contacte', 'devis_envoye', 'negocie', 'gagne', 'perdu'];

export default function ProspectionPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [form, setForm] = useState({ name: '', email: '', phone: '', source: 'autre', value: 0, notes: '' });

  useEffect(() => { loadLeads(); }, []);

  async function loadLeads() {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
    setLeads((data as unknown as Lead[]) || []);
    setLoading(false);
  }

  async function createLead() {
    if (!user) return;
    await supabase.from('leads').insert({ ...form, user_id: user.id });
    setShowCreate(false);
    setForm({ name: '', email: '', phone: '', source: 'autre', value: 0, notes: '' });
    loadLeads();
  }

  async function moveStage(id: string, stage: string) {
    await supabase.from('leads').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    loadLeads();
  }

  const totalPipeline = leads.filter(l => !['gagne', 'perdu'].includes(l.stage)).reduce((s, l) => s + l.value, 0);
  const totalGagne = leads.filter(l => l.stage === 'gagne').reduce((s, l) => s + l.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Prospection & CRM" description="Gerez votre pipeline commercial">
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> Nouveau lead</Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pipeline en cours</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(totalPipeline)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Gagnes ce mois</p>
          <p className="mt-1 text-xl font-semibold text-emerald-600">{formatCurrency(totalGagne)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Leads actifs</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{leads.filter(l => !['gagne', 'perdu'].includes(l.stage)).length}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant={view === 'kanban' ? 'default' : 'outline'} size="sm" onClick={() => setView('kanban')}>Kanban</Button>
        <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>Liste</Button>
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      ) : leads.length === 0 ? (
        <EmptyState icon={Users} title="Aucun prospect" description="Ajoutez votre premier lead pour alimenter votre pipeline.">
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> Ajouter un lead</Button>
        </EmptyState>
      ) : view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGE_ORDER.map(stageKey => {
            const stage = LEAD_STAGES[stageKey as keyof typeof LEAD_STAGES];
            const stageLeads = leads.filter(l => l.stage === stageKey);
            return (
              <div key={stageKey} className="flex-shrink-0 w-[240px] sm:w-[280px]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', stage.color)}>{stage.label}</span>
                    <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
                  </div>
                </div>
                <div className="space-y-2 min-h-[200px] rounded-lg border border-dashed border-border bg-muted/20 p-2">
                  {stageLeads.map(lead => (
                    <div key={lead.id} className="rounded-lg border border-border bg-card p-3 shadow-sm transition-all hover:shadow-md">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{lead.name}</p>
                          {lead.value > 0 && <p className="text-xs font-semibold text-primary mt-0.5">{formatCurrency(lead.value)}</p>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-3 w-3" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {STAGE_ORDER.filter(s => s !== stageKey).map(s => (
                              <DropdownMenuItem key={s} onClick={() => moveStage(lead.id, s)}>
                                {LEAD_STAGES[s as keyof typeof LEAD_STAGES].label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                        {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Etape</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Valeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map(l => {
                const st = LEAD_STAGES[l.stage as keyof typeof LEAD_STAGES] || LEAD_STAGES.nouveau;
                return (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-sm font-medium text-foreground">{l.name}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{l.phone || l.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{SOURCES.find(s => s.value === l.source)?.label || l.source}</td>
                    <td className="px-4 py-3"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', st.color)}>{st.label}</span></td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(l.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau lead</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><label className="text-sm font-medium">Nom</label><Input className="mt-1" placeholder="Nom du prospect" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Email</label><Input className="mt-1" type="email" placeholder="email@..." value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Telephone</label><Input className="mt-1" placeholder="06 ..." value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Source</label>
                <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><label className="text-sm font-medium">Valeur estimee</label><Input className="mt-1" type="number" placeholder="0" value={form.value || ''} onChange={e => setForm({ ...form, value: Number(e.target.value) })} /></div>
            </div>
            <div><label className="text-sm font-medium">Notes</label><textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createLead} disabled={!form.name.trim()}>Ajouter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
