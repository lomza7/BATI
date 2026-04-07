'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  FileText,
  FolderOpen,
  HardHat,
  ListTodo,
  Package,
  RotateCcw,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type RecycleBinItem,
  type RecycleEntityType,
  PROJECT_TRASH_RETENTION_DAYS,
  RECYCLE_ENTITY_LABELS,
  getProjectTrashExpiryDate,
  getRemainingTrashDays,
  permanentlyDeleteEntity,
  purgeExpiredRecycleBinItems,
  restoreEntityFromTrash,
} from '@/lib/recycle-bin';
import { formatCurrency, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

type TrashFilter = 'all' | RecycleEntityType;

function getTypeIcon(type: RecycleEntityType) {
  switch (type) {
    case 'project':
      return HardHat;
    case 'quote':
      return FileText;
    case 'todo':
      return ListTodo;
    case 'client':
      return User;
    case 'service':
      return Package;
    case 'catalog':
      return FolderOpen;
    case 'lead':
      return Users;
  }
}

function normalizeRelated<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

export default function CorbeillePage() {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TrashFilter>('all');
  const [actionKey, setActionKey] = useState<string | null>(null);

  useEffect(() => {
    void loadTrash();
  }, []);

  async function loadTrash() {
    setLoading(true);

    try {
      await purgeExpiredRecycleBinItems();

      const [projectsRes, quotesRes, todosRes, clientsRes, servicesRes, catalogsRes, leadsRes] = await Promise.all([
        supabase.from('projects').select('id, name, city, budget, deleted_at, clients(name)').not('deleted_at', 'is', null),
        supabase.from('quotes').select('id, quote_number, title, total_ttc, deleted_at, clients(name)').not('deleted_at', 'is', null),
        supabase.from('todos').select('id, title, category, completed, deleted_at').not('deleted_at', 'is', null),
        supabase.from('clients').select('id, name, email, phone, city, deleted_at').not('deleted_at', 'is', null),
        supabase.from('services').select('id, name, category, unit_price, deleted_at').not('deleted_at', 'is', null),
        supabase.from('catalogs').select('id, name, status, description, deleted_at').not('deleted_at', 'is', null),
        supabase.from('leads').select('id, name, company_name, project_city, value, stage, deleted_at').not('deleted_at', 'is', null),
      ]);

      const nextItems: RecycleBinItem[] = [
        ...(((projectsRes.data as Array<Record<string, unknown>>) || []).map((project) => {
          const client = normalizeRelated(project.clients as { name: string } | { name: string }[] | null);
          return {
            id: String(project.id),
            type: 'project' as const,
            title: String(project.name || 'Chantier sans nom'),
            subtitle: [client?.name || 'Sans client', project.city ? String(project.city) : ''].filter(Boolean).join(' - '),
            deleted_at: String(project.deleted_at || ''),
            meta: Number(project.budget || 0) > 0 ? formatCurrency(Number(project.budget || 0)) : null,
          };
        })),
        ...(((quotesRes.data as Array<Record<string, unknown>>) || []).map((quote) => {
          const client = normalizeRelated(quote.clients as { name: string } | { name: string }[] | null);
          return {
            id: String(quote.id),
            type: 'quote' as const,
            title: String(quote.title || quote.quote_number || 'Devis'),
            subtitle: [String(quote.quote_number || 'Sans numero'), client?.name || 'Sans client'].join(' - '),
            deleted_at: String(quote.deleted_at || ''),
            meta: Number(quote.total_ttc || 0) > 0 ? formatCurrency(Number(quote.total_ttc || 0)) : null,
          };
        })),
        ...(((todosRes.data as Array<Record<string, unknown>>) || []).map((todo) => ({
          id: String(todo.id),
          type: 'todo' as const,
          title: String(todo.title || 'Tache'),
          subtitle: [String(todo.category || 'autre'), todo.completed ? 'terminee' : 'active'].join(' - '),
          deleted_at: String(todo.deleted_at || ''),
          meta: null,
        }))),
        ...(((clientsRes.data as Array<Record<string, unknown>>) || []).map((client) => ({
          id: String(client.id),
          type: 'client' as const,
          title: String(client.name || 'Contact'),
          subtitle: [String(client.email || ''), String(client.phone || ''), String(client.city || '')].filter(Boolean).join(' - ') || 'Aucune coordonnee',
          deleted_at: String(client.deleted_at || ''),
          meta: null,
        }))),
        ...(((servicesRes.data as Array<Record<string, unknown>>) || []).map((service) => ({
          id: String(service.id),
          type: 'service' as const,
          title: String(service.name || 'Prestation'),
          subtitle: String(service.category || 'Sans categorie'),
          deleted_at: String(service.deleted_at || ''),
          meta: Number(service.unit_price || 0) > 0 ? formatCurrency(Number(service.unit_price || 0)) : null,
        }))),
        ...(((catalogsRes.data as Array<Record<string, unknown>>) || []).map((catalog) => ({
          id: String(catalog.id),
          type: 'catalog' as const,
          title: String(catalog.name || 'Catalogue'),
          subtitle: [String(catalog.status || 'draft'), String(catalog.description || '')].filter(Boolean).join(' - '),
          deleted_at: String(catalog.deleted_at || ''),
          meta: null,
        }))),
        ...(((leadsRes.data as Array<Record<string, unknown>>) || []).map((lead) => ({
          id: String(lead.id),
          type: 'lead' as const,
          title: String(lead.company_name || lead.name || 'Prospect'),
          subtitle: [String(lead.stage || 'nouveau'), String(lead.project_city || '')].filter(Boolean).join(' - '),
          deleted_at: String(lead.deleted_at || ''),
          meta: Number(lead.value || 0) > 0 ? formatCurrency(Number(lead.value || 0)) : null,
        }))),
      ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));

      setItems(nextItems);
    } catch (error) {
      console.error('Erreur chargement corbeille:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(item: RecycleBinItem) {
    setActionKey(`${item.type}:${item.id}`);

    try {
      const { error } = await restoreEntityFromTrash(item.type, item.id);
      if (error) throw error;
      await loadTrash();
    } catch (error) {
      console.error('Erreur restauration corbeille:', error);
      window.alert("Impossible de restaurer cet element.");
    } finally {
      setActionKey(null);
    }
  }

  async function handlePermanentDelete(item: RecycleBinItem) {
    const confirmed = window.confirm(
      `Supprimer definitivement "${item.title}" ? Cette action est irreversible.`
    );
    if (!confirmed) return;

    setActionKey(`${item.type}:${item.id}`);

    try {
      await permanentlyDeleteEntity(item.type, item.id);
      await loadTrash();
    } catch (error) {
      console.error('Erreur suppression definitive:', error);
      window.alert("Impossible de supprimer definitivement cet element.");
    } finally {
      setActionKey(null);
    }
  }

  const visibleItems = useMemo(
    () => items.filter((item) => filter === 'all' || item.type === filter),
    [filter, items]
  );

  const expiringSoonCount = useMemo(
    () => items.filter((item) => getRemainingTrashDays(item.deleted_at) <= 7).length,
    [items]
  );

  const countsByType = useMemo(() => {
    const counts = new Map<RecycleEntityType, number>();
    items.forEach((item) => counts.set(item.type, (counts.get(item.type) || 0) + 1));
    return counts;
  }, [items]);

  const filterOptions: { value: TrashFilter; label: string }[] = [
    { value: 'all', label: `Tout (${items.length})` },
    { value: 'project', label: `Chantiers (${countsByType.get('project') || 0})` },
    { value: 'quote', label: `Devis (${countsByType.get('quote') || 0})` },
    { value: 'todo', label: `Taches (${countsByType.get('todo') || 0})` },
    { value: 'client', label: `Contacts (${countsByType.get('client') || 0})` },
    { value: 'service', label: `Prestations (${countsByType.get('service') || 0})` },
    { value: 'catalog', label: `Catalogues (${countsByType.get('catalog') || 0})` },
    { value: 'lead', label: `Prospects (${countsByType.get('lead') || 0})` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corbeille"
        description={`Tous les elements supprimes restent recuperables pendant ${PROJECT_TRASH_RETENTION_DAYS} jours, sauf les factures qui ne passent pas par la corbeille.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Elements en corbeille</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Expirent sous 7 jours</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{expiringSoonCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Regle automatique</p>
          <p className="mt-2 text-sm font-medium text-foreground">Suppression definitive apres 30 jours</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              filter === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Corbeille vide"
          description="Aucun element supprime ne correspond a ce filtre."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleItems.map((item) => {
            const Icon = getTypeIcon(item.type);
            const daysRemaining = getRemainingTrashDays(item.deleted_at);
            const expiresAt = getProjectTrashExpiryDate(item.deleted_at);
            const isBusy = actionKey === `${item.type}:${item.id}`;

            return (
              <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        {RECYCLE_ENTITY_LABELS[item.type]}
                      </p>
                      <h2 className="mt-1 text-base font-semibold text-foreground">{item.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {daysRemaining > 0 ? `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restants` : 'Expiration atteinte'}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-muted/40 p-3 text-sm">
                    <p className="text-muted-foreground">Supprime le</p>
                    <p className="mt-1 font-medium text-foreground">{formatDate(item.deleted_at)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3 text-sm">
                    <p className="text-muted-foreground">Suppression definitive</p>
                    <p className="mt-1 font-medium text-foreground">{formatDate(expiresAt.toISOString())}</p>
                  </div>
                  {item.meta ? (
                    <div className="rounded-xl bg-muted/40 p-3 text-sm sm:col-span-2">
                      <p className="text-muted-foreground">Info</p>
                      <p className="mt-1 font-medium text-foreground">{item.meta}</p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" className="gap-2" disabled={isBusy} onClick={() => void handleRestore(item)}>
                    <RotateCcw className="h-4 w-4" />
                    Restaurer
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={isBusy}
                    onClick={() => void handlePermanentDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Supprimer definitivement
                  </Button>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  L element restera restaurable jusqu a sa date d expiration.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
