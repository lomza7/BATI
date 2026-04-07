'use client';

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { MapPin, Plus, Search, Navigation, Share2, Copy, Check, Eye, EyeOff, Pencil, ExternalLink, Send, Loader2, Mail } from 'lucide-react';
import { ClientPicker, type Client } from '@/components/shared/client-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PROJECT_STATUSES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { AddressAutocomplete, AddressResult } from '@/components/shared/address-autocomplete';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const MapView = lazy(() => import('@/components/shared/map-view').then(m => ({ default: m.MapView })));

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
  is_public: boolean;
  clients: { name: string } | null;
}

const STATUS_PIN_COLORS: Record<string, string> = {
  a_planifier: 'bg-slate-400',
  en_cours: 'bg-blue-500',
  termine: 'bg-emerald-500',
  en_pause: 'bg-amber-500',
};

export default function CartePage() {
  const { user, profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareClientId, setShareClientId] = useState<string | null>(null);
  const [shareClient, setShareClient] = useState<Client | null>(null);
  const [shareEmailOverride, setShareEmailOverride] = useState('');
  const [shareSending, setShareSending] = useState(false);
  const [shareSent, setShareSent] = useState(false);
  const [addressQuery, setAddressQuery] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    address: '',
    city: '',
    postal_code: '',
    lat: null as number | null,
    lng: null as number | null,
  });

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    const { data } = await supabase
      .from('projects')
      .select('id, name, address, city, postal_code, lat, lng, status, progress, is_public, clients(name, deleted_at)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setProjects((((data as unknown as Array<Record<string, unknown>>) || [])).map((project) => {
      const clientValue = Array.isArray(project.clients) ? project.clients[0] : project.clients;
      return {
        ...project,
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? { name: String((clientValue as { name?: string }).name || '') }
          : null,
      } as Project;
    }));
    setLoading(false);
  }

  async function saveProject() {
    if (!user) return;

    let clientId: string | null = null;
    if (form.clientName.trim()) {
      const { data: existing } = await supabase.from('clients').select('id').eq('name', form.clientName.trim()).is('deleted_at', null).maybeSingle();
      if (existing) { clientId = existing.id; }
      else {
        const { data: newC } = await supabase.from('clients').insert({ name: form.clientName.trim(), user_id: user.id }).select('id').single();
        clientId = newC?.id || null;
      }
    }
    const payload = {
      name: form.name,
      client_id: clientId,
      address: form.address,
      city: form.city,
      postal_code: form.postal_code,
      lat: form.lat,
      lng: form.lng,
    };

    if (editingProjectId) {
      await supabase.from('projects').update(payload).eq('id', editingProjectId);
    } else {
      await supabase.from('projects').insert({ ...payload, user_id: user.id });
    }

    setShowCreate(false);
    setEditingProjectId(null);
    setForm({ name: '', clientName: '', address: '', city: '', postal_code: '', lat: null, lng: null });
    setAddressQuery('');
    loadProjects();
  }

  async function togglePublic(id: string, isPublic: boolean) {
    await supabase.from('projects').update({ is_public: isPublic }).eq('id', id);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, is_public: isPublic } : p));
  }

  function getShareLink() {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://hellobat.app';
    return `${baseUrl}/carte/publique`;
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(getShareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendShareEmail() {
    const email = shareClient?.email || shareEmailOverride;
    if (!email || !profile) return;
    setShareSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const link = getShareLink();
      const companyName = profile.company_name || 'notre entreprise';
      const clientName = shareClient?.name || '';
      const greeting = clientName ? `Bonjour ${clientName},` : 'Bonjour,';
      await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          subject: `Decouvrez nos chantiers - ${companyName}`,
          body: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#D35400;">Nos realisations</h2>
            <p>${greeting}</p>
            <p>${companyName} vous partage la carte interactive de ses chantiers et realisations.</p>
            <p style="margin:24px 0;">
              <a href="${link}" style="background:#D35400;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
                Voir la carte des chantiers
              </a>
            </p>
            <p style="color:#666;font-size:14px;">Vous pouvez consulter la localisation, l'avancement et les details de nos projets.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
            <p style="color:#999;font-size:12px;">Envoye depuis <a href="https://hellobat.app" style="color:#D35400;">Hellobat</a></p>
          </div>`,
        }),
      });
      setShareSent(true);
      setTimeout(() => {
        setShareSent(false);
        setShareClientId(null);
        setShareClient(null);
        setShareEmailOverride('');
      }, 3000);
    } catch { /* silent */ }
    setShareSending(false);
  }

  function handleAddressSelect(result: AddressResult) {
    setForm(f => ({
      ...f,
      address: [result.housenumber, result.street].filter(Boolean).join(' '),
      city: result.city || '',
      postal_code: result.postcode || '',
      lat: result.lat,
      lng: result.lng,
    }));
  }

  function openCreateDialog() {
    setEditingProjectId(null);
    setForm({ name: '', clientName: '', address: '', city: '', postal_code: '', lat: null, lng: null });
    setAddressQuery('');
    setShowCreate(true);
  }

  function startEditProject(project: Project) {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      clientName: project.clients?.name || '',
      address: project.address || '',
      city: project.city || '',
      postal_code: project.postal_code || '',
      lat: project.lat,
      lng: project.lng,
    });
    setAddressQuery([project.address, project.postal_code, project.city].filter(Boolean).join(', '));
    setShowDetails(false);
    setShowCreate(true);
  }

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selected) || null,
    [projects, selected]
  );

  const filtered = useMemo(() => {
    let list = filter === 'all' ? projects : projects.filter(p => p.status === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.clients?.name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, filter, search]);

  const markers = useMemo(() =>
    filtered
      .filter(p => p.lat && p.lng)
      .map(p => ({
        id: p.id,
        lat: p.lat!,
        lng: p.lng!,
        label: `${p.name}${p.city ? ` — ${p.city}` : ''}`,
        color: STATUS_PIN_COLORS[p.status] || 'bg-slate-400',
      })),
    [filtered]
  );

  const handleMarkerClick = useCallback((id: string) => {
    setSelected(id);
    setShowDetails(true);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Carte des chantiers" description="Visualisez vos chantiers sur la carte">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowShare(true)} className="gap-2">
            <Share2 className="h-4 w-4" /> Partager
          </Button>
          <Button onClick={openCreateDialog} className="gap-2">
            <Plus className="h-4 w-4" /> Nouveau chantier
          </Button>
        </div>
      </PageHeader>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
            Tous ({projects.length})
          </Button>
          {(['a_planifier', 'en_cours', 'termine', 'en_pause'] as const).map(s => {
            const st = PROJECT_STATUSES[s];
            const count = projects.filter(p => p.status === s).length;
            return (
              <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)} className="gap-1.5">
                <div className={cn('h-2 w-2 rounded-full', STATUS_PIN_COLORS[s])} />
                {st.label} ({count})
              </Button>
            );
          })}
        </div>
      </div>

      {/* Contenu principal */}
      {loading ? (
        <div className="h-[400px] sm:h-[500px] animate-pulse rounded-xl bg-muted" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={MapPin} title="Aucun chantier" description="Ajoutez des chantiers avec une adresse pour les voir sur la carte.">
          <Button onClick={openCreateDialog} className="gap-2"><Plus className="h-4 w-4" /> Ajouter un chantier</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Carte */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            {markers.length > 0 ? (
              <Suspense fallback={
                <div className="h-[350px] sm:h-[500px] flex items-center justify-center bg-muted">
                  <div className="text-center text-muted-foreground">
                    <Navigation className="h-8 w-8 mx-auto animate-pulse" />
                    <p className="mt-2 text-sm">Chargement de la carte...</p>
                  </div>
                </div>
              }>
                <MapView
                  markers={markers}
                  selectedId={selected}
                  onMarkerClick={handleMarkerClick}
                  className="h-[350px] sm:h-[500px]"
                />
              </Suspense>
            ) : (
              <div className="h-[350px] sm:h-[500px] flex items-center justify-center bg-gradient-to-br from-blue-50 to-emerald-50">
                <div className="text-center px-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto">
                    <Navigation className="h-8 w-8 text-blue-600" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-foreground">Aucune coordonnee GPS</p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Vos chantiers n&apos;ont pas de coordonnees. Ajoutez un chantier avec une adresse pour le voir sur la carte.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Liste des chantiers */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {filtered.length} chantier{filtered.length > 1 ? 's' : ''}
            </h3>
            <div className="space-y-2 max-h-[300px] sm:max-h-[460px] overflow-y-auto pr-1">
              {filtered.map(p => {
                const st = PROJECT_STATUSES[p.status] || PROJECT_STATUSES.a_planifier;
                const hasCoords = p.lat && p.lng;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      'rounded-lg border border-border bg-card p-3 cursor-pointer transition-all hover:shadow-sm',
                      selected === p.id && 'ring-2 ring-primary border-primary'
                    )}
                    onClick={() => {
                      setSelected(p.id);
                      setShowDetails(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.clients?.name}</p>
                      </div>
                      <StatusBadge label={st.label} color={st.color} />
                    </div>
                    {(p.address || p.city) && (
                      <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{[p.address, p.postal_code, p.city].filter(Boolean).join(', ')}</span>
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      {!hasCoords ? (
                        <p className="text-xs text-amber-600">GPS manquant</p>
                      ) : <span />}
                      <button
                        className={cn(
                          'flex items-center gap-1 text-xs transition-colors',
                          p.is_public ? 'text-emerald-600' : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={(e) => { e.stopPropagation(); togglePublic(p.id, !p.is_public); }}
                      >
                        {p.is_public ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {p.is_public ? 'Public' : 'Prive'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dialog partage */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Partager la carte</DialogTitle>
            <DialogDescription>
              Partagez un lien vers vos chantiers publics. Seuls les chantiers marques comme &quot;Public&quot; seront visibles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm truncate">
                {typeof window !== 'undefined' ? getShareLink() : ''}
              </div>
              <Button size="sm" onClick={copyShareLink} className="gap-2 shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copie !' : 'Copier'}
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Contact</label>
                <ClientPicker
                  value={shareClientId}
                  onChange={(id, client) => {
                    setShareClientId(id);
                    setShareClient(client);
                    setShareEmailOverride(client?.email || '');
                    setShareSent(false);
                  }}
                />
              </div>
              {shareClient && !shareClient.email && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email de {shareClient.name}
                  </label>
                  <Input
                    type="email"
                    placeholder="email@client.com"
                    value={shareEmailOverride}
                    onChange={e => { setShareEmailOverride(e.target.value); setShareSent(false); }}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Ce contact n&apos;a pas d&apos;email. Saisissez-le et il sera enregistre.</p>
                </div>
              )}
              <Button
                onClick={async () => {
                  // If client has no email and user typed one, save it to the contact
                  if (shareClient && !shareClient.email && shareEmailOverride) {
                    await supabase.from('clients').update({ email: shareEmailOverride }).eq('id', shareClient.id);
                  }
                  sendShareEmail();
                }}
                disabled={shareSending || !(shareClient?.email || shareEmailOverride) || shareSent}
                className="w-full gap-2"
              >
                {shareSending ? <Loader2 className="h-4 w-4 animate-spin" /> : shareSent ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {shareSent ? 'Envoye !' : `Envoyer${shareClient ? ` a ${shareClient.name}` : ''}`}
              </Button>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">Chantiers publics ({projects.filter(p => p.is_public).length}/{projects.length})</p>
              <p className="text-xs text-muted-foreground">Cliquez sur l&apos;icone oeil dans la liste pour rendre un chantier public ou prive.</p>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {projects.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.city}</p>
                  </div>
                  <Switch
                    checked={p.is_public}
                    onCheckedChange={(checked) => togglePublic(p.id, checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDetails && !!selectedProject}
        onOpenChange={(open) => {
          setShowDetails(open);
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {selectedProject && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle>{selectedProject.name}</DialogTitle>
                    <DialogDescription>
                      Consultez les infos du chantier et modifiez-le directement depuis la carte.
                    </DialogDescription>
                  </div>
                  <Button size="icon" variant="outline" onClick={() => startEditProject(selectedProject)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={(PROJECT_STATUSES[selectedProject.status] || PROJECT_STATUSES.a_planifier).label}
                    color={(PROJECT_STATUSES[selectedProject.status] || PROJECT_STATUSES.a_planifier).color}
                  />
                  <span className="text-sm text-muted-foreground">{selectedProject.progress}% d avancement</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Client</p>
                    <p className="mt-1 text-sm font-medium text-foreground">{selectedProject.clients?.name || 'Non renseigne'}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Visibilite</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{selectedProject.is_public ? 'Public' : 'Prive'}</p>
                      <Switch
                        checked={selectedProject.is_public}
                        onCheckedChange={(checked) => togglePublic(selectedProject.id, checked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Adresse</p>
                  <p className="mt-1 text-sm text-foreground">
                    {[selectedProject.address, selectedProject.postal_code, selectedProject.city].filter(Boolean).join(', ') || 'Adresse non renseignee'}
                  </p>
                  {selectedProject.lat && selectedProject.lng && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      GPS : {selectedProject.lat.toFixed(5)}, {selectedProject.lng.toFixed(5)}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  {selectedProject.lat && selectedProject.lng && (
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/search/?api=1&query=${selectedProject.lat},${selectedProject.lng}`,
                          '_blank'
                        )
                      }
                    >
                      <ExternalLink className="h-4 w-4" /> Ouvrir dans Maps
                    </Button>
                  )}
                  <Button className="gap-2" onClick={() => startEditProject(selectedProject)}>
                    <Pencil className="h-4 w-4" /> Modifier le chantier
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog creation chantier */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProjectId ? 'Modifier le chantier' : 'Nouveau chantier'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
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
              <AddressAutocomplete
                value={addressQuery}
                onChange={setAddressQuery}
                onSelect={handleAddressSelect}
                placeholder="Tapez une adresse..."
                className="mt-1"
              />
            </div>
            {form.city && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Adresse :</span> {form.address}</p>
                <p><span className="text-muted-foreground">Ville :</span> {form.postal_code} {form.city}</p>
                <p><span className="text-muted-foreground">GPS :</span> {form.lat?.toFixed(5)}, {form.lng?.toFixed(5)}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreate(false);
                  setEditingProjectId(null);
                }}
              >
                Annuler
              </Button>
              <Button onClick={saveProject} disabled={!form.name.trim()}>
                {editingProjectId ? 'Enregistrer' : 'Creer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
