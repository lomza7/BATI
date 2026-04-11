'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Package, Plus, Check, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description: string;
  unit: string;
  unit_price: number;
  category: string;
  tva_rate: number | null;
  is_recurring: boolean;
  frequency: string;
}

export interface PickedService {
  description: string;
  detail?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
  is_recurring?: boolean;
  frequency?: string;
}

interface ServicePickerProps {
  onSelect: (service: PickedService) => void;
  onClose: () => void;
}

export function ServicePicker({ onSelect, onClose }: ServicePickerProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadServices();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  async function loadServices() {
    const { data } = await supabase
      .from('services')
      .select('id, name, description, unit, unit_price, category, tva_rate, is_recurring, frequency')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('category')
      .order('name');
    setServices((data as Service[]) || []);
  }

  const filtered = search
    ? services.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
    )
    : services;

  // Group by category
  const grouped = new Map<string, Service[]>();
  for (const s of filtered) {
    const cat = s.category || 'Sans catégorie';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(s);
  }

  function pickService(s: Service) {
    onSelect({
      description: s.name,
      detail: s.description || '',
      quantity: 1,
      unit: s.unit,
      unit_price: s.unit_price,
      tva_rate: s.tva_rate ?? 20,
      is_recurring: s.is_recurring,
      frequency: s.frequency,
    });
    setAdded(prev => new Set(prev).add(s.id));
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Rechercher une prestation…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {services.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p>Aucune prestation enregistrée.</p>
          <p className="text-xs mt-1">Allez dans &quot;Mes prestations&quot; pour en créer.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">Aucun résultat.</div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto space-y-3">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-1">{category}</p>
              <div className="space-y-1">
                {items.map(s => {
                  const isAdded = added.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                        isAdded ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-accent'
                      )}
                      onClick={() => pickService(s)}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                        {isAdded ? <Check className="h-4 w-4 text-emerald-600" /> : <Package className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          {s.is_recurring && (
                            <Badge variant="outline" className="gap-0.5 text-[9px] px-1 py-0 border-primary/30 text-primary shrink-0">
                              <RefreshCw className="h-2 w-2" /> {s.frequency === 'mensuel' ? '/mois' : s.frequency === 'trimestriel' ? '/trim.' : '/an'}
                            </Badge>
                          )}
                        </div>
                        {s.description && <p className="text-[11px] text-muted-foreground truncate">{s.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatCurrency(s.unit_price)}</p>
                        <p className="text-[10px] text-muted-foreground">/ {s.unit}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button variant="outline" size="sm" onClick={onClose}>Fermer</Button>
      </div>
    </div>
  );
}
