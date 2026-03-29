'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, SquareCheck as CheckSquare, Filter, ListTodo, CalendarDays, CircleCheck as CheckCircle2, Circle, Clock, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/constants';
import {
  TODO_PRIORITIES,
  TODO_CATEGORIES,
  type Todo,
  type TodoPriority,
  type TodoCategory,
} from '@/lib/todo-constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { TodoCard } from '@/components/todos/todo-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type FilterView = 'toutes' | 'actives' | 'terminees' | 'en_retard' | 'aujourdhui';

const QUICK_TASKS = [
  'Commander materiaux',
  'Appeler le client',
  'Faire le devis',
  'Verifier le chantier',
  'Relancer la facture',
];

export default function TachesPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterView, setFilterView] = useState<FilterView>('actives');
  const [filterCategory, setFilterCategory] = useState<string>('toutes');
  const [showCreate, setShowCreate] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [quickAdd, setQuickAdd] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'moyenne' as TodoPriority,
    category: 'autre' as TodoCategory,
    due_date: '',
  });

  useEffect(() => { loadTodos(); }, []);

  async function loadTodos() {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('completed', { ascending: true })
      .order('position', { ascending: true })
      .order('created_at', { ascending: false });
    setTodos((data as unknown as Todo[]) || []);
    setLoading(false);
  }

  async function createTodo() {
    await supabase.from('todos').insert({
      title: form.title,
      description: form.description,
      priority: form.priority,
      category: form.category,
      due_date: form.due_date || null,
      position: todos.length,
    });
    setShowCreate(false);
    resetForm();
    loadTodos();
  }

  async function quickCreateTodo(title: string) {
    if (!title.trim()) return;
    await supabase.from('todos').insert({
      title: title.trim(),
      priority: 'moyenne',
      category: 'autre',
      position: todos.length,
    });
    setQuickAdd('');
    loadTodos();
  }

  async function updateTodo() {
    if (!editingTodo) return;
    await supabase.from('todos').update({
      title: form.title,
      description: form.description,
      priority: form.priority,
      category: form.category,
      due_date: form.due_date || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingTodo.id);
    setEditingTodo(null);
    resetForm();
    loadTodos();
  }

  async function toggleTodo(id: string, completed: boolean) {
    await supabase.from('todos').update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    loadTodos();
  }

  async function deleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id);
    loadTodos();
  }

  async function clearCompleted() {
    await supabase.from('todos').delete().eq('completed', true);
    loadTodos();
  }

  function openEdit(todo: Todo) {
    setEditingTodo(todo);
    setForm({
      title: todo.title,
      description: todo.description || '',
      priority: todo.priority,
      category: todo.category,
      due_date: todo.due_date || '',
    });
  }

  function resetForm() {
    setForm({ title: '', description: '', priority: 'moyenne', category: 'autre', due_date: '' });
  }

  const today = new Date(new Date().toDateString()).toISOString().split('T')[0];

  const filtered = useMemo(() => {
    let result = todos;

    if (filterView === 'actives') result = result.filter(t => !t.completed);
    else if (filterView === 'terminees') result = result.filter(t => t.completed);
    else if (filterView === 'en_retard') result = result.filter(t => !t.completed && t.due_date && t.due_date < today);
    else if (filterView === 'aujourdhui') result = result.filter(t => !t.completed && t.due_date === today);

    if (filterCategory !== 'toutes') {
      result = result.filter(t => t.category === filterCategory);
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s));
    }

    return result;
  }, [todos, filterView, filterCategory, search, today]);

  const stats = useMemo(() => ({
    total: todos.length,
    actives: todos.filter(t => !t.completed).length,
    terminees: todos.filter(t => t.completed).length,
    enRetard: todos.filter(t => !t.completed && t.due_date && t.due_date < today).length,
    aujourdhui: todos.filter(t => !t.completed && t.due_date === today).length,
  }), [todos, today]);

  const completionPercent = stats.total > 0 ? Math.round((stats.terminees / stats.total) * 100) : 0;

  const filters: { key: FilterView; label: string; count: number; icon: React.ElementType }[] = [
    { key: 'toutes', label: 'Toutes', count: stats.total, icon: ListTodo },
    { key: 'actives', label: 'Actives', count: stats.actives, icon: Circle },
    { key: 'terminees', label: 'Terminees', count: stats.terminees, icon: CheckCircle2 },
    { key: 'en_retard', label: 'En retard', count: stats.enRetard, icon: Clock },
    { key: 'aujourdhui', label: "Aujourd'hui", count: stats.aujourdhui, icon: CalendarDays },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title="Mes taches" description="Organisez votre quotidien d'artisan">
        <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle tache
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Progression</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{completionPercent}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">A faire</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{stats.actives}</p>
          <p className="text-xs text-muted-foreground mt-0.5">taches actives</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Terminees</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{stats.terminees}</p>
          <p className="text-xs text-muted-foreground mt-0.5">completees</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">En retard</p>
          <p className={cn('mt-1 text-2xl font-semibold', stats.enRetard > 0 ? 'text-red-600' : 'text-foreground')}>{stats.enRetard}</p>
          <p className="text-xs text-muted-foreground mt-0.5">a traiter</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <Input
            placeholder="Ajouter rapidement une tache..."
            value={quickAdd}
            onChange={e => setQuickAdd(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') quickCreateTodo(quickAdd); }}
            className="border-0 shadow-none focus-visible:ring-0 px-0 text-sm"
          />
          {quickAdd.trim() && (
            <Button size="sm" onClick={() => quickCreateTodo(quickAdd)} className="flex-shrink-0">
              Ajouter
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {QUICK_TASKS.map(task => (
            <button
              key={task}
              onClick={() => quickCreateTodo(task)}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              + {task}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterView(f.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap',
                filterView === f.key
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <f.icon className="h-3.5 w-3.5" />
              {f.label}
              {f.count > 0 && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  filterView === f.key ? 'bg-background/20' : 'bg-background'
                )}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 text-xs"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs gap-1">
              <Filter className="h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="toutes">Toutes</SelectItem>
              {Object.entries(TODO_CATEGORIES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={filterView === 'actives' ? 'Tout est fait !' : 'Aucune tache'}
          description={
            filterView === 'actives'
              ? 'Felicitations, toutes vos taches sont terminees.'
              : 'Ajoutez votre premiere tache pour organiser votre journee.'
          }
        >
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Ajouter une tache
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {filtered.map(todo => (
            <TodoCard
              key={todo.id}
              todo={todo}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {stats.terminees > 0 && filterView !== 'terminees' && (
        <div className="flex justify-center">
          <button
            onClick={clearCompleted}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Supprimer les {stats.terminees} tache{stats.terminees > 1 ? 's' : ''} terminee{stats.terminees > 1 ? 's' : ''}
          </button>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle tache</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input
                className="mt-1"
                placeholder="Ex: Commander carrelage salle de bain"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optionnel)</label>
              <Textarea
                className="mt-1 resize-none"
                rows={2}
                placeholder="Details supplementaires..."
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Priorite</label>
                <Select value={form.priority} onValueChange={(v: TodoPriority) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TODO_PRIORITIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categorie</label>
                <Select value={form.category} onValueChange={(v: TodoCategory) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TODO_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Date limite (optionnel)</label>
              <Input
                className="mt-1"
                type="date"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createTodo} disabled={!form.title.trim()}>Creer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTodo} onOpenChange={open => { if (!open) setEditingTodo(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la tache</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input
                className="mt-1"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                className="mt-1 resize-none"
                rows={2}
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Priorite</label>
                <Select value={form.priority} onValueChange={(v: TodoPriority) => setForm({ ...form, priority: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TODO_PRIORITIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Categorie</label>
                <Select value={form.category} onValueChange={(v: TodoCategory) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TODO_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Date limite</label>
              <Input
                className="mt-1"
                type="date"
                value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingTodo(null)}>Annuler</Button>
              <Button onClick={updateTodo} disabled={!form.title.trim()}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
