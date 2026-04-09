'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, User, Phone, Mail, MapPin, Pencil, Trash2,
  FileText, HardHat, Receipt, StickyNote, ChevronDown, X,
  ListTodo, CircleCheck as CheckCircle2, Circle, ArrowUpRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { moveEntityToTrash } from '@/lib/recycle-bin';
import { formatCurrency, formatDate, CONTACT_TYPES } from '@/lib/constants';
import { DEFAULT_LEAD_SOURCES } from '@/lib/lead-sources';
import { TODO_PRIORITIES, TODO_CATEGORIES, type Todo } from '@/lib/todo-constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { ImportCsvButton } from '@/components/shared/import-csv-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type ContactType = keyof typeof CONTACT_TYPES;

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  notes: string;
  contact_type: ContactType;
  source: string;
  created_at: string;
}

interface ClientQuote { id: string; quote_number: string; title: string; status: string; total_ttc: number; created_at: string; }
interface ClientInvoice { id: string; invoice_number: string; title: string; status: string; total_ttc: number; created_at: string; }
interface ClientProject { id: string; name: string; status: string; city: string; progress: number; }

const emptyForm = { name: '', email: '', phone: '', address: '', city: '', postal_code: '', notes: '', contact_type: 'client' as ContactType, source: '' };

export default function ClientsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContactType | 'all'>('all');

  // Detail
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<ClientQuote[]>([]);
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [clientTodos, setClientTodos] = useState<Todo[]>([]);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showDelete, setShowDelete] = useState<string | null>(null);


  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').is('deleted_at', null).order('name');
    setClients((data as Client[]) || []);
    setLoading(false);
  }

  async function loadClientDetails(id: string) {
    setSelectedId(id);
    const [q, inv, proj, td] = await Promise.all([
      supabase.from('quotes').select('id, quote_number, title, status, total_ttc, created_at').eq('client_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('invoices').select('id, invoice_number, title, status, total_ttc, created_at').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name, status, city, progress').eq('client_id', id).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('todos').select('*').eq('client_id', id).is('deleted_at', null).order('completed', { ascending: true }).order('created_at', { ascending: false }),
    ]);
    setQuotes((q.data as ClientQuote[]) || []);
    setInvoices((inv.data as ClientInvoice[]) || []);
    setProjects((proj.data as ClientProject[]) || []);
    setClientTodos((td.data as Todo[]) || []);
  }

  async function saveClient() {
    if (!editingId && !user) return;

    if (editingId) {
      await supabase.from('clients').update(form).eq('id', editingId);
    } else {
      await supabase.from('clients').insert({ ...form, user_id: user!.id });
    }
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    loadClients();
    if (selectedId === editingId) loadClientDetails(editingId!);
  }

  async function deleteClient(id: string) {
    if (!user) return;
    await moveEntityToTrash('client', id, user.id);
    setShowDelete(null);
    if (selectedId === id) setSelectedId(null);
    loadClients();
  }

  async function toggleClientTodo(todoId: string, completed: boolean) {
    await supabase.from('todos').update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', todoId);
    if (selectedId) loadClientDetails(selectedId);
  }

  function openEdit(c: Client) {
    setForm({ name: c.name, email: c.email, phone: c.phone, address: c.address, city: c.city, postal_code: c.postal_code, notes: c.notes, contact_type: c.contact_type || 'client', source: c.source || '' });
    setEditingId(c.id);
    setShowForm(true);
  }

  const filtered = useMemo(() => {
    let list = clients;
    if (typeFilter !== 'all') {
      list = list.filter(c => (c.contact_type || 'client') === typeFilter);
    }
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  }, [clients, search, typeFilter]);

  const selected = clients.find(c => c.id === selectedId);

  // Stats du client selectionné
  const totalDevis = quotes.reduce((s, q) => s + (q.total_ttc || 0), 0);
  const totalFactures = invoices.reduce((s, inv) => s + (inv.total_ttc || 0), 0);
  const totalPaye = invoices.filter(inv => inv.status === 'payee').reduce((s, inv) => s + (inv.total_ttc || 0), 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader title="Contacts" description="Votre carnet d'adresses">
        <ImportCsvButton type="clients" onImported={loadClients} />
        <Button onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau contact
        </Button>
      </PageHeader>

      {/* Filtres par type + Recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={typeFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTypeFilter('all')}
          >
            Tous ({clients.length})
          </Button>
          {(Object.entries(CONTACT_TYPES) as [ContactType, typeof CONTACT_TYPES[ContactType]][]).map(([key, val]) => {
            const count = clients.filter(c => (c.contact_type || 'client') === key).length;
            return (
              <Button
                key={key}
                variant={typeFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTypeFilter(key)}
                className="gap-1.5"
              >
                <span className={cn('h-2 w-2 rounded-full', val.color.split(' ')[0].replace('bg-', 'bg-'))} style={{ backgroundColor: key === 'client' ? '#3b82f6' : key === 'prospect' ? '#f59e0b' : '#a855f7' }} />
                {val.label} ({count})
              </Button>
            );
          })}
        </div>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher un contact..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={User} title="Aucun contact" description="Ajoutez votre premier contact pour commencer.">
          <Button onClick={() => { setForm(emptyForm); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" /> Ajouter un contact</Button>
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Liste */}
          <div className="lg:col-span-1 space-y-2 max-h-[650px] overflow-y-auto pr-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{filtered.length} contact{filtered.length > 1 ? 's' : ''}</p>
            {filtered.map(c => (
              <div
                key={c.id}
                className={cn(
                  'rounded-lg border border-border bg-card p-3 cursor-pointer transition-all hover:shadow-sm',
                  selectedId === c.id && 'ring-2 ring-primary border-primary'
                )}
                onClick={() => loadClientDetails(c.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                    {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={e => e.stopPropagation()}>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setShowDelete(c.id); }}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {c.contact_type && CONTACT_TYPES[c.contact_type as ContactType] && (
                        <StatusBadge label={CONTACT_TYPES[c.contact_type as ContactType].label} color={CONTACT_TYPES[c.contact_type as ContactType].color} />
                      )}
                      {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                      {c.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.city}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 min-h-[300px]">
                <div className="text-center text-muted-foreground">
                  <User className="h-10 w-10 mx-auto" />
                  <p className="mt-3 text-sm">Sélectionnez un contact pour voir sa fiche</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-border">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-semibold">
                      {selected.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold">{selected.name}</h2>
                          {selected.contact_type && CONTACT_TYPES[selected.contact_type] && (
                            <StatusBadge label={CONTACT_TYPES[selected.contact_type].label} color={CONTACT_TYPES[selected.contact_type].color} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" variant="outline" className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => router.push(`/devis?client_id=${selected.id}`)}>
                            <FileText className="h-3.5 w-3.5" /> Nouveau devis
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={() => router.push(`/factures?client_id=${selected.id}`)}>
                            <Receipt className="h-3.5 w-3.5" /> Nouvelle facture
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEdit(selected)} className="gap-1.5">
                            <Pencil className="h-3.5 w-3.5" /> Modifier
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {selected.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{selected.phone}</span>}
                        {selected.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{selected.email}</span>}
                        {(selected.address || selected.city) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[selected.address, selected.postal_code, selected.city].filter(Boolean).join(', ')}
                          </span>
                        )}
                        {selected.source && (
                          <span className="flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {DEFAULT_LEAD_SOURCES.find(s => s.slug === selected.source)?.name || selected.source}
                          </span>
                        )}
                      </div>
                      {selected.notes && (
                        <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1">
                          <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                          {selected.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* KPI */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Devis</p>
                      <p className="text-sm font-semibold mt-0.5">{quotes.length} — {formatCurrency(totalDevis)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Factures</p>
                      <p className="text-sm font-semibold mt-0.5">{invoices.length} — {formatCurrency(totalFactures)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Payé</p>
                      <p className="text-sm font-semibold mt-0.5">{formatCurrency(totalPaye)}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Chantiers</p>
                      <p className="text-sm font-semibold mt-0.5">{projects.length}</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Tâches</p>
                      <p className="text-sm font-semibold mt-0.5">{clientTodos.filter(t => !t.completed).length} en cours</p>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="chantiers" className="p-4 sm:p-6">
                  <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex sm:grid-cols-none">
                    <TabsTrigger value="chantiers" className="gap-1.5"><HardHat className="h-3.5 w-3.5" /> Chantiers</TabsTrigger>
                    <TabsTrigger value="devis" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Devis</TabsTrigger>
                    <TabsTrigger value="factures" className="gap-1.5"><Receipt className="h-3.5 w-3.5" /> Factures</TabsTrigger>
                    <TabsTrigger value="taches" className="gap-1.5"><ListTodo className="h-3.5 w-3.5" /> Tâches</TabsTrigger>
                  </TabsList>

                  <TabsContent value="chantiers" className="mt-4">
                    {projects.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Aucun chantier</p>
                    ) : (
                      <div className="space-y-2">
                        {projects.map(p => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">{p.city} — {p.progress}%</p>
                            </div>
                            <span className={cn('text-xs px-2 py-0.5 rounded-full',
                              p.status === 'en_cours' ? 'bg-blue-50 text-blue-700' :
                              p.status === 'termine' ? 'bg-emerald-50 text-emerald-700' :
                              'bg-slate-100 text-slate-600'
                            )}>
                              {p.status === 'en_cours' ? 'En cours' : p.status === 'termine' ? 'Terminé' : p.status === 'en_pause' ? 'En pause' : 'À planifier'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="devis" className="mt-4">
                    {quotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Aucun devis</p>
                    ) : (
                      <div className="space-y-2">
                        {quotes.map(q => (
                          <div key={q.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div>
                              <p className="text-sm font-medium">{q.title || q.quote_number}</p>
                              <p className="text-xs text-muted-foreground">{q.quote_number} — {formatDate(q.created_at)}</p>
                            </div>
                            <p className="text-sm font-semibold">{formatCurrency(q.total_ttc || 0)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="factures" className="mt-4">
                    {invoices.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Aucune facture</p>
                    ) : (
                      <div className="space-y-2">
                        {invoices.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div>
                              <p className="text-sm font-medium">{inv.title || inv.invoice_number}</p>
                              <p className="text-xs text-muted-foreground">{inv.invoice_number} — {formatDate(inv.created_at)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{formatCurrency(inv.total_ttc || 0)}</p>
                              <span className={cn('text-[10px]',
                                inv.status === 'payee' ? 'text-emerald-600' :
                                inv.status === 'en_retard' ? 'text-red-600' :
                                'text-muted-foreground'
                              )}>
                                {inv.status === 'payee' ? 'Payée' : inv.status === 'en_retard' ? 'En retard' : inv.status === 'envoyee' ? 'Envoyée' : 'Brouillon'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="taches" className="mt-4">
                    {clientTodos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Aucune tâche liée à ce contact</p>
                    ) : (
                      <div className="space-y-2">
                        {clientTodos.map(todo => {
                          const priority = TODO_PRIORITIES[todo.priority] || TODO_PRIORITIES.moyenne;
                          const category = TODO_CATEGORIES[todo.category] || TODO_CATEGORIES.autre;
                          const isOverdue = todo.due_date && !todo.completed && todo.due_date < new Date().toISOString().split('T')[0];
                          return (
                            <div key={todo.id} className={cn(
                              'flex items-start gap-3 rounded-lg border border-border p-3 transition-all',
                              todo.completed && 'opacity-60'
                            )}>
                              <button
                                onClick={() => toggleClientTodo(todo.id, !todo.completed)}
                                className={cn(
                                  'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all',
                                  todo.completed
                                    ? 'border-emerald-500 bg-emerald-500'
                                    : 'border-muted-foreground/30 hover:border-primary'
                                )}
                              >
                                {todo.completed && (
                                  <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-sm font-medium', todo.completed && 'line-through text-muted-foreground')}>{todo.title}</p>
                                {todo.description && <p className="text-xs text-muted-foreground mt-0.5">{todo.description}</p>}
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', priority.color)}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', priority.dot)} />
                                    {priority.label}
                                  </span>
                                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', category.color)}>
                                    {category.label}
                                  </span>
                                  {todo.due_date && (
                                    <span className={cn('text-[10px] font-medium', isOverdue ? 'text-red-600' : 'text-muted-foreground')}>
                                      {formatDate(todo.due_date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog formulaire */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier' : 'Nouveau'} contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nom *</label>
                <Input className="mt-1" placeholder="Nom du contact" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={form.contact_type} onValueChange={(v) => setForm({ ...form, contact_type: v as ContactType })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(CONTACT_TYPES) as [ContactType, typeof CONTACT_TYPES[ContactType]][]).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Source</label>
                <Select value={form.source || 'none'} onValueChange={(v) => setForm({ ...form, source: v === 'none' ? '' : v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Source..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non renseigné</SelectItem>
                    {DEFAULT_LEAD_SOURCES.map(s => (
                      <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Téléphone</label>
                <Input className="mt-1" placeholder="06 12 34 56 78" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Email *</label>
                <Input className="mt-1" type="email" required placeholder="contact@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Adresse</label>
              <Input className="mt-1" placeholder="Adresse" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Code postal</label>
                <Input className="mt-1" placeholder="75000" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Ville</label>
                <Input className="mt-1" placeholder="Paris" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea className="mt-1" placeholder="Notes sur ce contact..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Annuler</Button>
              <Button onClick={saveClient} disabled={!form.name.trim() || !form.email.trim()}>{editingId ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={!!showDelete} onOpenChange={() => setShowDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer ce contact ?</DialogTitle>
            <DialogDescription>Les devis, factures et chantiers liés ne seront pas supprimés.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDelete(null)}>Annuler</Button>
            <Button variant="destructive" onClick={() => showDelete && deleteClient(showDelete)}>Supprimer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
