'use client';

import { useState, useEffect, useMemo, lazy, Suspense, useCallback } from 'react';
import { MapPin, HardHat, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import type { MapProject } from '@/components/map/project-map';

const ProjectMap = lazy(() =>
  import('@/components/map/project-map').then(mod => ({ default: mod.ProjectMap }))
);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const publicSupabase = createClient(supabaseUrl, supabaseKey);

interface PublicProject {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  status: string;
  progress: number;
  clients: { name: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  en_cours: { label: 'En cours', color: 'text-blue-700', bg: 'bg-blue-50' },
  termine: { label: 'Termine', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  a_planifier: { label: 'A planifier', color: 'text-slate-600', bg: 'bg-slate-100' },
  en_pause: { label: 'En pause', color: 'text-amber-700', bg: 'bg-amber-50' },
};

export default function VitrinePage() {
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      const { data } = await publicSupabase
        .from('projects')
        .select('id, name, address, city, postal_code, lat, lng, status, progress, clients(name)')
        .eq('is_public', true)
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });
      setProjects((data as unknown as PublicProject[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return projects;
    return projects.filter(p => p.status === filter);
  }, [projects, filter]);

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

  const handleSelect = useCallback((id: string) => setSelected(id), []);

  const enCoursCount = projects.filter(p => p.status === 'en_cours').length;
  const termineCount = projects.filter(p => p.status === 'termine').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-border/60 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground">
                <HardHat className="h-5 w-5 text-background" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground tracking-tight">BatiFlow</h1>
                <p className="text-[11px] text-muted-foreground -mt-0.5">Nos realisations</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>{enCoursCount} en cours</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>{termineCount} termine{termineCount > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              Nos chantiers
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Decouvrez nos realisations en cours et terminees. Chaque projet est localise sur la carte.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2">
            {[
              { key: 'all', label: `Tous (${projects.length})` },
              { key: 'en_cours', label: `En cours (${enCoursCount})` },
              { key: 'termine', label: `Termines (${termineCount})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-all',
                  filter === f.key
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="h-[400px] rounded-2xl bg-muted animate-pulse" />
          ) : mapProjects.length > 0 ? (
            <Suspense fallback={
              <div className="h-[400px] rounded-2xl border border-border bg-muted flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }>
              <ProjectMap
                projects={mapProjects}
                selectedId={selected}
                onSelect={handleSelect}
                height="400px"
                className="rounded-2xl shadow-sm"
              />
            </Suspense>
          ) : (
            <div className="h-[300px] rounded-2xl border border-dashed border-border bg-card flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">Aucun chantier localise pour le moment.</p>
              </div>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(p => {
                const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.a_planifier;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={cn(
                      'rounded-2xl border bg-white p-5 cursor-pointer transition-all hover:shadow-lg',
                      selected === p.id
                        ? 'border-foreground/20 shadow-lg ring-1 ring-foreground/5'
                        : 'border-border/60 hover:border-border'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold text-foreground leading-tight">{p.name}</h3>
                      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium flex-shrink-0', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>

                    {(p.address || p.city) && (
                      <p className="mt-2.5 text-xs text-muted-foreground flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>{[p.address, p.postal_code, p.city].filter(Boolean).join(', ')}</span>
                      </p>
                    )}

                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Avancement</span>
                        <span className="font-medium text-foreground">{p.progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            p.status === 'termine' ? 'bg-emerald-500' : 'bg-blue-500'
                          )}
                          style={{ width: `${p.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="text-center py-16">
              <HardHat className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <p className="mt-4 text-base font-medium text-foreground">Aucun chantier a afficher</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Les chantiers publics apparaitront ici prochainement.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-border/40 mt-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            BatiFlow - Gestion de chantiers intelligente
          </p>
        </div>
      </footer>
    </div>
  );
}
