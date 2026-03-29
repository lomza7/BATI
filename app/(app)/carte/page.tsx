'use client';

import { useState, useEffect } from 'react';
import { MapPin, ExternalLink, Navigation } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PROJECT_STATUSES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
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

export default function CartePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    const { data } = await supabase
      .from('projects')
      .select('id, name, address, city, postal_code, status, progress, clients(name)')
      .order('created_at', { ascending: false });
    setProjects((data as unknown as Project[]) || []);
    setLoading(false);
  }

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);

  return (
    <div className="space-y-6">
      <PageHeader title="Carte des chantiers" description="Visualisez vos chantiers sur la carte">
        <Button variant="outline" className="gap-2" onClick={() => {
          const addr = filtered.map(p => `${p.address} ${p.city}`).join(' / ');
          if (addr) window.open(`https://www.openstreetmap.org/search?query=${encodeURIComponent(addr)}`, '_blank');
        }}>
          <ExternalLink className="h-4 w-4" /> Ouvrir sur OpenStreetMap
        </Button>
      </PageHeader>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>Tous ({projects.length})</Button>
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

      {loading ? (
        <div className="h-[500px] animate-pulse rounded-xl bg-muted" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={MapPin} title="Aucun chantier" description="Ajoutez des chantiers avec une adresse pour les voir sur la carte." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="relative h-[300px] sm:h-[500px] bg-gradient-to-br from-blue-50 to-emerald-50 flex items-center justify-center">
              <div className="text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mx-auto">
                  <Navigation className="h-8 w-8 text-blue-600" />
                </div>
                <p className="mt-4 text-base font-semibold text-foreground">Carte interactive</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                  {filtered.length} chantier{filtered.length > 1 ? 's' : ''} a afficher.
                  Cliquez sur un chantier dans la liste pour le localiser.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 gap-2"
                  onClick={() => {
                    const query = filtered.map(p => `${p.address}, ${p.postal_code} ${p.city}`).join('; ');
                    window.open(`https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`, '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4" /> Voir sur OpenStreetMap
                </Button>
              </div>
              <div className="absolute inset-0 pointer-events-none">
                {filtered.map((p, i) => {
                  const angle = (i / filtered.length) * 2 * Math.PI;
                  const radius = 30;
                  const cx = 50 + radius * Math.cos(angle);
                  const cy = 50 + radius * Math.sin(angle);
                  return (
                    <div
                      key={p.id}
                      className={cn('absolute pointer-events-auto cursor-pointer transition-transform hover:scale-125', selected === p.id && 'scale-125 z-10')}
                      style={{ left: `${cx}%`, top: `${cy}%`, transform: 'translate(-50%, -50%)' }}
                      onClick={() => setSelected(p.id)}
                    >
                      <div className={cn('h-4 w-4 rounded-full border-2 border-white shadow-md', STATUS_PIN_COLORS[p.status] || 'bg-slate-400')} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {filtered.length} chantier{filtered.length > 1 ? 's' : ''}
            </h3>
            <div className="space-y-2 max-h-[300px] sm:max-h-[480px] overflow-y-auto pr-1">
              {filtered.map(p => {
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
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.clients?.name}</p>
                      </div>
                      <StatusBadge label={st.label} color={st.color} />
                    </div>
                    {(p.address || p.city) && (
                      <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {[p.address, p.postal_code, p.city].filter(Boolean).join(', ')}
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
  );
}
