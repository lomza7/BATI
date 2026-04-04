'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Package, Filter, GripVertical } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Service {
  id: string;
  name: string;
  description: string;
  unit: string;
  unit_price: number;
  category: string;
  tva_rate: number;
  is_active: boolean;
  created_at: string;
}

const UNITS = [
  { value: 'u', label: 'Unite (u)' },
  { value: 'h', label: 'Heure (h)' },
  { value: 'm2', label: 'M carre (m2)' },
  { value: 'ml', label: 'Metre lineaire (ml)' },
  { value: 'm3', label: 'M cube (m3)' },
  { value: 'kg', label: 'Kilo (kg)' },
  { value: 'forfait', label: 'Forfait' },
  { value: 'jour', label: 'Jour' },
];

const DEFAULT_CATEGORIES = [
  'Plomberie', 'Electricite', 'Maconnerie', 'Peinture', 'Carrelage',
  'Menuiserie', 'Isolation', 'Toiture', 'Demolition', 'Nettoyage',
  'Main d\'oeuvre', 'Fourniture', 'Deplacement', 'Autre',
];

const emptyForm = {
  name: '',
  description: '',
  unit: 'u',
  unit_price: 0,
  category: '',
  tva_rate: 20,
  is_active: true,
};

export default function PrestationsPage() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (user) loadServices(); }, [user]);

  async function loadServices() {
    setLoading(true);
    const { data } = await supabase
      .from('services')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });
    setServices((data as Service[]) || []);
    setLoading(false);
  }

  const categories = useMemo(() => {
    const cats = new Set(services.map(s => s.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [services]);

  const filtered = useMemo(() => {
    let list = services;
    if (categoryFilter !== 'all') {
      list = list.filter(s => s.category === categoryFilter);
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }, [services, search, categoryFilter]);

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(s: Service) {
    setForm({
      name: s.name,
      description: s.description,
      unit: s.unit,
      unit_price: s.unit_price,
      category: s.category,
      tva_rate: s.tva_rate,
      is_active: s.is_active,
    });
    setEditingId(s.id);
    setShowForm(true);
  }

  async function saveService() {
    if (!form.name.trim() || !user) return;
    setSubmitting(true);

    if (editingId) {
      await supabase.from('services').update({
        ...form,
        updated_at: new Date().toISOString(),
      }).eq('id', editingId);
    } else {
      await supabase.from('services').insert({
        ...form,
        user_id: user.id,
      });
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setSubmitting(false);
    loadServices();
  }

  async function deleteService(id: string) {
    await supabase.from('services').delete().eq('id', id);
    loadServices();
  }

  async function toggleActive(s: Service) {
    await supabase.from('services').update({ is_active: !s.is_active, updated_at: new Date().toISOString() }).eq('id', s.id);
    loadServices();
  }

  // Group services by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of filtered) {
      const cat = s.category || 'Sans categorie';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(s);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader title="Mes prestations" description="Bibliotheque de vos produits et services — reutilisables dans vos devis">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle prestation
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher une prestation..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Categorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total prestations</p>
          <p className="text-xl font-semibold">{services.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Categories</p>
          <p className="text-xl font-semibold">{categories.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Prix moyen</p>
          <p className="text-xl font-semibold">
            {services.length > 0 ? formatCurrency(services.reduce((s, p) => s + p.unit_price, 0) / services.length) : '—'}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Actives</p>
          <p className="text-xl font-semibold">{services.filter(s => s.is_active).length}</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aucune prestation"
          description="Creez vos prestations une fois, reutilisez-les dans tous vos devis."
        >
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Creer ma premiere prestation
          </Button>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Aucun resultat pour cette recherche.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{category}</h3>
              <div className="space-y-2">
                {items.map(s => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border bg-card p-3 sm:p-4 transition-colors hover:bg-muted/30',
                      !s.is_active && 'opacity-50'
                    )}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        {!s.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                      </div>
                      {s.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{s.description}</p>
                      )}
                    </div>
                    <div className="hidden sm:flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatCurrency(s.unit_price)}</p>
                        <p className="text-[11px] text-muted-foreground">/ {s.unit}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">TVA {s.tva_rate}%</Badge>
                    </div>
                    {/* Mobile price */}
                    <div className="sm:hidden text-right shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(s.unit_price)}</p>
                      <p className="text-[10px] text-muted-foreground">/ {s.unit}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <GripVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4 mr-2" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(s)}>
                          {s.is_active ? 'Desactiver' : 'Reactiver'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteService(s.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier la prestation' : 'Nouvelle prestation'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Nom *</label>
              <Input
                className="mt-1"
                placeholder="Ex: Pose de carrelage 60x60"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={2}
                placeholder="Details, references, marque..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Prix unitaire HT *</label>
                <Input
                  className="mt-1"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.unit_price || ''}
                  onChange={e => setForm({ ...form, unit_price: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Unite</label>
                <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Categorie</label>
                <Select value={form.category || 'none'} onValueChange={v => setForm({ ...form, category: v === 'none' ? '' : v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Categorie..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans categorie</SelectItem>
                    {DEFAULT_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    {/* Show user custom categories not in defaults */}
                    {categories.filter(c => !DEFAULT_CATEGORIES.includes(c)).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">TVA</label>
                <Select value={String(form.tva_rate)} onValueChange={v => setForm({ ...form, tva_rate: Number(v) })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5.5">5.5%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="20">20%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={saveService} disabled={!form.name.trim() || submitting}>
                {editingId ? 'Enregistrer' : 'Creer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
