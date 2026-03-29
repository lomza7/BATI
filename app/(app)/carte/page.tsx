'use client';

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import {
  Plus,
  MapPin,
  Search,
  Copy,
  Check,
  Link2,
  Eye,
  EyeOff,
  Loader2,
  Navigation,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PROJECT_STATUSES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { MapProject } from '@/components/map/project-map';

const ProjectMap = lazy(() =>
  import('@/components/map/project-map').then(mod => ({ default: mod.ProjectMap }))
);

interface Project {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  status: keyof typeof PROJECT_STATUSES;
  progress: number;
  budget: number;
  start_date: string | null;
  end_date: string | null;
  is_public: boolean;
  notes: string;
  created_at: string;
  clients: { name: string } | null;
}

const STATUS_DOTS: Record<string, string> = {
  a_planifier: 'bg-slate-400',
  en_cours: 'bg-blue-500',
  termine: 'bg-emerald-500',
  en_pause: 'bg-amber-500',
};

export default function CartePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    address: '',
    city: '',
    postal_code: '',
    budget: 0,
    notes: '',
    is_public: true,
  });

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    const { data } = await supabase
      .from('projects')
      .select('id, name, address, city, postal_code, lat, lng, status, progress, budget, start_date, end_date, is_public, notes, created_at, clients(name)')
      .order('created_at', { ascending: false });
    setProjects((data as unknown as Project[]) || []);
    setLoading(false);
  }

  async function geocodeAddress(address: string, city: string, postalCode: string): Promise<{ lat: number; lng: number } | null> {
    const fullAddress = [address, postalCode, city, 'France'].filter(Boolean).join(', ');
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const res = await fetch(`${supabaseUrl}/functions/v1/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ address: fullAddress }),
      });
      const data = await res.json();
      if (data.found) return { lat: data.lat, lng: data.lng };
      return null;
    } catch {
      return null;
    }
  }

  async function createProject() {
    setGeocoding(true);

    let clientId: string | null = null;
    if (form.clientName.trim()) {
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('name', form.clientName.trim())
        .maybeSingle();
      if (existing) {
        clientId = existing.id;
      } else {
        const { data: newC } = await supabase
          .from('clients')
          .insert({ name: form.clientName.trim() })
          .select('id')
          .single();
        clientId = newC?.id || null;
      }
    }

    const coords = await geocodeAddress(form.address, form.city, form.postal_code);

    await supabase.from('projects').insert({
      name: form.name,
      client_id: clientId,
      address: form.address,
      city: form.city,
      postal_code: form.postal_code,
      budget: form.budget,
      notes: form.notes,
      is_public: form.is_public,
      lat: coords?.lat || null,
      lng: coords?.lng || null,
    });

    setGeocoding(false);
    setShowCreate(false);
    setForm({ name: '', clientName: '', address: '', city: '', postal_code: '', budget: 0, notes: '', is_public: true });
    loadProjects();
  }

  async function togglePublic(id: string, isPublic: boolean) {
    await supabase.from('projects').update({
      is_public: isPublic,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadProjects();
  }

  async function geocodeProject(project: Project) {
    if (!project.address && !project.city) return;
    setGeocoding(true);
    const coords = await geocodeAddress(project.address, project.city, project.postal_code);
    if (coords) {
      await supabase.from('projects').update({
        lat: coords.lat,
        lng: coords.lng,
        updated_at: new Date().toISOString(),
      }).eq('id', project.id);
      loadProjects();
    }
    setGeocoding(false);
  }

  function copyShareLink() {
    const link = `${window.location.origin}/vitrine`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const filtered = useMemo(() => {
    let result = projects;
    if (filter !== 'all') result = result.filter(p => p.status === filter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(s) ||
        p.city.toLowerCase().includes(s) ||
        p.clients?.name?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [projects, filter, search]);

  const mapProjects: MapProject[] = useMemo(
    () => filtered
      .filter(p => p.lat && p.lng)
      .map(p => ({
        id: p.id,
        name: p.name,
        address: p.address,
        city: p.city,
        lat: p.lat!,
        lng: p.lng!,
        status: p.status,
        progress: p.progress,
        clientName: p.clients?.name,
      })),
    [filtered]
  );

  const geoCount = projects.filter(p => p.lat && p.lng).length;
  const publicCount = projects.filter(p => p.is_public).length;

  const handleSelect = useCallback((id: string) => setSelected(id), []);

  const stats: Record<string, number> = useMemo(() => {
    const result: Record<string, number> = { total: projects.length };
    Object.keys(PROJECT_STATUSES).forEach(key => {
      result[key] = projects.filter(p => p.status === key).length;
    });
    return result;
  }, [projects]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Carte des chantiers" description="Visualisez et localisez tous vos chantiers">
        <Button variant="outline" className="gap-2" onClick={() => setShowShareDialog(true)}>
          <Link2 className="h-4 w-4" /> Lien client
        </Button>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau chantier
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'all', label: 'Tous', count: stats.total },
          { key: 'en_cours', label: 'En cours', count: stats.en_cours || 0 },
          { key: 'termine', label: 'Termines', count: stats.termine || 0 },
          { key: 'a_planifier', label: 'A planifier', count: stats.a_planifier || 0 },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-xl border p-3 text-left transition-all',
              filter === f.key
                ? 'border-foreground/20 bg-foreground/5 shadow-sm'
                : 'border-border bg-card hover:border-border/80 hover:shadow-sm'
            )}
          >
            <div className="flex items-center gap-2">
              {f.key !== 'all' && <div className={cn('h-2.5 w-2.5 rounded-full', STATUS_DOTS[f.key])} />}
              <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
            </div>
            <p className="mt-1 text-xl font-semibold text-foreground">{f.count}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-[500px] animate-pulse rounded-xl bg-muted" />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Aucun chantier"
          description="Ajoutez votre premier chantier pour le voir apparaitre sur la carte."
        >
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Ajouter un chantier
          </Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
          <div className="space-y-4">
            {mapProjects.length > 0 ? (
              <Suspense fallback={
                <div className="h-[500px] rounded-xl border border-border bg-muted flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <ProjectMap
                  projects={mapProjects}
                  selectedId={selected}
                  onSelect={handleSelect}
                  height="500px"
                />
              </Suspense>
            ) : (
              <div className="h-[500px] rounded-xl border border-dashed border-border bg-card flex items-center justify-center">
                <div className="text-center px-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mx-auto">
                    <Navigation className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="mt-4 font-semibold text-foreground">Aucune adresse geolocalisee</p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Ajoutez des chantiers avec une adresse complete pour les voir sur la carte.
                    Chaque chantier sera automatiquement localise.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{geoCount} chantier{geoCount > 1 ? 's' : ''} localise{geoCount > 1 ? 's' : ''} sur la carte</span>
              <span>{publicCount} visible{publicCount > 1 ? 's' : ''} par vos clients</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun chantier trouve.</p>
              ) : (
                filtered.map(p => {
                  const st = PROJECT_STATUSES[p.status] || PROJECT_STATUSES.a_planifier;
                  const hasCoords = p.lat && p.lng;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'rounded-xl border bg-card p-3.5 cursor-pointer transition-all',
                        selected === p.id
                          ? 'border-foreground/20 shadow-md ring-1 ring-foreground/10'
                          : 'border-border hover:shadow-sm hover:border-border/80'
                      )}
                      onClick={() => setSelected(p.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                          {p.clients?.name && (
                            <p className="text-xs text-muted-foreground truncate">{p.clients.name}</p>
                          )}
                        </div>
                        <StatusBadge label={st.label} color={st.color} />
                      </div>

                      {(p.address || p.city) && (
                        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{[p.address, p.postal_code, p.city].filter(Boolean).join(', ')}</span>
                        </p>
                      )}

                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {!hasCoords && (p.address || p.city) && (
                            <button
                              onClick={e => { e.stopPropagation(); geocodeProject(p); }}
                              className="text-[10px] font-medium text-primary hover:underline"
                              disabled={geocoding}
                            >
                              {geocoding ? 'Localisation...' : 'Localiser'}
                            </button>
                          )}
                          {hasCoords && (
                            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              GPS
                            </span>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); togglePublic(p.id, !p.is_public); }}
                          className={cn(
                            'flex items-center gap-1 text-[10px] font-medium transition-colors',
                            p.is_public ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {p.is_public ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          {p.is_public ? 'Public' : 'Prive'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau chantier</DialogTitle>
            <DialogDescription>
              L'adresse sera automatiquement localisee sur la carte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">Nom du chantier</label>
              <Input className="mt-1" placeholder="Ex: Renovation appartement Dupont" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Client</label>
              <Input className="mt-1" placeholder="Nom du client" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Adresse</label>
              <Input className="mt-1" placeholder="12 rue de la Paix" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Code postal</label>
                <Input className="mt-1" placeholder="75001" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Ville</label>
                <Input className="mt-1" placeholder="Paris" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Budget</label>
              <Input className="mt-1" type="number" placeholder="0" value={form.budget || ''} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea className="mt-1 resize-none" rows={2} placeholder="Informations complementaires..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Visible par les clients</p>
                <p className="text-xs text-muted-foreground">Apparaitra sur votre lien de partage</p>
              </div>
              <Switch checked={form.is_public} onCheckedChange={v => setForm({ ...form, is_public: v })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createProject} disabled={!form.name.trim() || geocoding}>
                {geocoding ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Localisation...
                  </>
                ) : (
                  'Creer'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lien de partage client</DialogTitle>
            <DialogDescription>
              Partagez ce lien avec vos clients pour qu'ils puissent voir vos chantiers publics sur une carte.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
              <code className="flex-1 text-sm text-foreground truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/vitrine` : '/vitrine'}
              </code>
              <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0" onClick={copyShareLink}>
                {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {linkCopied ? 'Copie !' : 'Copier'}
              </Button>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">{publicCount} chantier{publicCount > 1 ? 's' : ''} visible{publicCount > 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seuls les chantiers marques comme "publics" apparaissent sur le lien de partage.
                Vous pouvez modifier la visibilite de chaque chantier depuis la liste.
              </p>
            </div>
            <Button className="w-full gap-2" onClick={() => window.open('/vitrine', '_blank')}>
              <Eye className="h-4 w-4" /> Voir la page vitrine
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
