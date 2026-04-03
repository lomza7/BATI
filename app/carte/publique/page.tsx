'use client';

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { MapPin, HardHat, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PROJECT_STATUSES } from '@/lib/constants';
import { StatusBadge } from '@/components/shared/status-badge';
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
  clients: { name: string } | null;
}

const STATUS_PIN_COLORS: Record<string, string> = {
  a_planifier: 'bg-slate-400',
  en_cours: 'bg-blue-500',
  termine: 'bg-emerald-500',
  en_pause: 'bg-amber-500',
};

export default function CartePubliquePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('');

  useEffect(() => {
    async function load() {
      // Charger les projets publics (pas besoin d'auth grâce au RLS anon)
      const { data } = await supabase
        .from('projects')
        .select('id, name, address, city, postal_code, lat, lng, status, progress, clients(name)')
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      setProjects((data as unknown as Project[]) || []);

      // Charger le nom de l'entreprise depuis le premier profil
      const { data: profiles } = await supabase
        .from('profiles')
        .select('company_name')
        .limit(1)
        .single();
      if (profiles?.company_name) setCompanyName(profiles.company_name);

      setLoading(false);
    }
    load();
  }, []);

  const markers = useMemo(() =>
    projects
      .filter(p => p.lat && p.lng)
      .map(p => ({
        id: p.id,
        lat: p.lat!,
        lng: p.lng!,
        label: `${p.name}${p.city ? ` — ${p.city}` : ''}`,
        color: STATUS_PIN_COLORS[p.status] || 'bg-slate-400',
      })),
    [projects]
  );

  const handleMarkerClick = useCallback((id: string) => setSelected(id), []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Navigation className="h-10 w-10 mx-auto text-primary animate-pulse" />
          <p className="mt-3 text-muted-foreground">Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HardHat className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {companyName || 'Nos chantiers'}
              </h1>
              <p className="text-xs text-muted-foreground">
                {projects.length} chantier{projects.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(['en_cours', 'termine'] as const).map(s => {
              const st = PROJECT_STATUSES[s];
              const count = projects.filter(p => p.status === s).length;
              if (count === 0) return null;
              return (
                <div key={s} className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className={cn('h-2 w-2 rounded-full', STATUS_PIN_COLORS[s])} />
                  {st.label} ({count})
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Contenu */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {projects.length === 0 ? (
          <div className="h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="mt-4 text-lg font-medium text-foreground">Aucun chantier a afficher</p>
              <p className="mt-1 text-sm text-muted-foreground">Cette carte n&apos;a pas encore de chantiers publics.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Carte */}
            <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
              {markers.length > 0 ? (
                <Suspense fallback={
                  <div className="h-[350px] sm:h-[500px] flex items-center justify-center bg-muted">
                    <Navigation className="h-8 w-8 mx-auto animate-pulse text-muted-foreground" />
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
                    <Navigation className="h-10 w-10 mx-auto text-blue-500" />
                    <p className="mt-3 text-sm text-muted-foreground">Les chantiers n&apos;ont pas encore de coordonnees GPS.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Liste */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Chantiers
              </h3>
              <div className="space-y-2 max-h-[300px] sm:max-h-[460px] overflow-y-auto pr-1">
                {projects.map(p => {
                  const st = PROJECT_STATUSES[p.status] || PROJECT_STATUSES.a_planifier;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'rounded-lg border border-border bg-card p-3 cursor-pointer transition-all hover:shadow-sm',
                        selected === p.id && 'ring-2 ring-primary border-primary'
                      )}
                      onClick={() => setSelected(p.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                          {p.clients?.name && <p className="text-xs text-muted-foreground truncate">{p.clients.name}</p>}
                        </div>
                        <StatusBadge label={st.label} color={st.color} />
                      </div>
                      {(p.address || p.city) && (
                        <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{[p.address, p.postal_code, p.city].filter(Boolean).join(', ')}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-8 py-4 text-center text-xs text-muted-foreground">
        Propulse par Hellobat
      </footer>
    </div>
  );
}
