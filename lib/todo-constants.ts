export const TODO_PRIORITIES = {
  haute: { label: 'Haute', color: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  moyenne: { label: 'Moyenne', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  basse: { label: 'Basse', color: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400' },
} as const;

export const TODO_CATEGORIES = {
  chantier: { label: 'Chantier', color: 'bg-blue-50 text-blue-700' },
  administratif: { label: 'Administratif', color: 'bg-emerald-50 text-emerald-700' },
  achat: { label: 'Achat', color: 'bg-amber-50 text-amber-700' },
  client: { label: 'Client', color: 'bg-cyan-50 text-cyan-700' },
  autre: { label: 'Autre', color: 'bg-slate-100 text-slate-600' },
} as const;

export type TodoPriority = keyof typeof TODO_PRIORITIES;
export type TodoCategory = keyof typeof TODO_CATEGORIES;

export interface Todo {
  id: string;
  title: string;
  description: string;
  priority: TodoPriority;
  category: TodoCategory;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  time_spent: number; // minutes
  position: number;
  client_id: string | null;
  client_name?: string;
  created_at: string;
  updated_at: string;
}
