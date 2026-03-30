'use client';

import { useState, useEffect } from 'react';
import { Plus, HardHat, Search, MapPin, Calendar, MoveHorizontal as MoreHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PROJECT_STATUSES, formatCurrency, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { AddressAutocomplete, AddressResult } from '@/components/shared/address-autocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Project {
  id: string;
  name: string;
  address: string;
  city: string;
  status: keyof typeof PROJECT_STATUSES;
  progress: number;
  budget: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  clients: { name: string } | null;
}

export default function ChantiersPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [form, setForm] = useState({ name: '', clientName: '', address: '', city: '', postal_code: '', lat: null as number | null, lng: null as number | null, budget: 0 });

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    const { data } = await supabase
      .from('projects')
      .select('id, name, address, city, status, progress, budget, start_date, end_date, created_at, clients(name)')
      .order('created_at', { ascending: false });
    setProjects((data as unknown as Project[]) || []);
    setLoading(false);
  }

  async function createProject() {
    let clientId: string | null = null;
    if (form.clientName.trim()) {
      const { data: existing } = await supabase.from('clients').select('id').eq('name', form.clientName.trim()).maybeSingle();
      if (existing) { clientId = existing.id; }
      else {
        const { data: newC } = await supabase.from('clients').insert({ name: form.clientName.trim() }).select('id').single();
        clientId = newC?.id || null;
      }
    }
    await supabase.from('projects').insert({
      name: form.name,
      client_id: clientId,
      address: form.address,
      city: form.city,
      postal_code: form.postal_code,
      lat: form.lat,
      lng: form.lng,
      budget: form.budget,
    });
    setShowCreate(false);
    setAddressQuery('');
    setForm({ name: '', clientName: '', address: '', city: '', postal_code: '', lat: null, lng: null, budget: 0 });
    loadProjects();
  }

  async function updateStatus(id: string, status: string) {
    const progress = status === 'termine' ? 100 : status === 'a_planifier' ? 0 : undefined;
    await supabase.from('projects').update({
      status,
      ...(progress !== undefined ? { progress } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadProjects();
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.city.toLowerCase().includes(search.toLowerCase()) ||
    p.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Mes chantiers" description="Suivi de vos chantiers en cours">
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau chantier
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(['a_planifier', 'en_cours', 'termine', 'en_pause'] as const).map(s => {
          const st = PROJECT_STATUSES[s];
          const count = projects.filter(p => p.status === s).length;
          return (
            <div key={s} className="rounded-xl border border-border bg-card p-4">
              <StatusBadge label={st.label} color={st.color} />
              <p className="mt-2 text-2xl font-semibold text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher un chantier..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={HardHat} title="Aucun chantier" description="Ajoutez votre premier chantier pour commencer le suivi.">
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> Ajouter un chantier</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(p => {
            const st = PROJECT_STATUSES[p.status] || PROJECT_STATUSES.a_planifier;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="text-sm text-muted-foreground">{p.clients?.name}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatus(p.id, 'en_cours')}>En cours</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(p.id, 'termine')}>Termine</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(p.id, 'en_pause')}>En pause</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  {p.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.city}</span>}
                  {p.start_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(p.start_date)}</span>}
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <StatusBadge label={st.label} color={st.color} />
                    <span className="font-medium text-foreground">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-2" />
                </div>
                {p.budget > 0 && (
                  <p className="mt-3 text-sm font-medium text-foreground">Budget : {formatCurrency(p.budget)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau chantier</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><label className="text-sm font-medium">Nom du chantier</label><Input className="mt-1" placeholder="Ex: Renovation appartement Dupont" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Client</label><Input className="mt-1" placeholder="Nom du client" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} /></div>
            <div>
              <label className="text-sm font-medium">Adresse</label>
              <AddressAutocomplete
                value={addressQuery}
                onChange={setAddressQuery}
                onSelect={(result: AddressResult) => setForm(f => ({
                  ...f,
                  address: [result.housenumber, result.street].filter(Boolean).join(' '),
                  city: result.city || '',
                  postal_code: result.postcode || '',
                  lat: result.lat,
                  lng: result.lng,
                }))}
                placeholder="Tapez une adresse..."
                className="mt-1"
              />
              {form.city && <p className="mt-1 text-xs text-muted-foreground">{form.address}, {form.postal_code} {form.city}</p>}
            </div>
            <div><label className="text-sm font-medium">Budget</label><Input className="mt-1" type="number" placeholder="0" value={form.budget || ''} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createProject} disabled={!form.name.trim()}>Creer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
