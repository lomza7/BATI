'use client';

import { useState, useEffect } from 'react';
import { Plus, Calculator, Upload, Search, TrendingUp, TrendingDown, Receipt, Sparkles, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { EXPENSE_CATEGORIES, formatCurrency, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  supplier: string;
  tva_amount: number;
  created_at: string;
}

export default function ComptabilitePage() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [form, setForm] = useState({ description: '', amount: 0, category: 'materiaux', date: '', supplier: '', tvaAmount: 0 });

  useEffect(() => { loadExpenses(); }, []);

  async function loadExpenses() {
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    setExpenses((data as unknown as Expense[]) || []);
    setLoading(false);
  }

  async function createExpense() {
    if (!user) return;

    await supabase.from('expenses').insert({
      user_id: user.id,
      description: form.description,
      amount: form.amount,
      category: form.category,
      date: form.date || new Date().toISOString().split('T')[0],
      supplier: form.supplier,
      tva_amount: form.tvaAmount,
    });
    setShowCreate(false);
    setForm({ description: '', amount: 0, category: 'materiaux', date: '', supplier: '', tvaAmount: 0 });
    loadExpenses();
  }

  const filtered = expenses.filter(e =>
    e.description.toLowerCase().includes(search.toLowerCase()) ||
    e.supplier.toLowerCase().includes(search.toLowerCase())
  );

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalTva = expenses.reduce((s, e) => s + e.tva_amount, 0);

  const categorySums = Object.keys(EXPENSE_CATEGORIES).map(cat => ({
    key: cat,
    ...EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES],
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Comptabilite IA" description="Suivi des depenses, TVA et chat comptable">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowChat(true)} className="gap-2">
            <MessageSquare className="h-4 w-4" /> Chat comptable
          </Button>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nouvelle depense
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingDown className="h-4 w-4 text-red-500" /> Total depenses</div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Receipt className="h-4 w-4 text-blue-500" /> TVA deductible</div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalTva)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Upload className="h-4 w-4 text-primary" /> OCR Factures</div>
          <p className="mt-2 text-sm font-medium text-foreground">Scannez vos factures</p>
          <Button variant="outline" size="sm" className="mt-2 gap-1"><Upload className="h-3 w-3" /> Importer</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {categorySums.filter(c => c.total > 0).map(cat => (
          <div key={cat.key} className="rounded-lg border border-border bg-card p-3">
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cat.color)}>{cat.label}</span>
            <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(cat.total)}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher une depense..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Calculator} title="Aucune depense" description="Ajoutez vos premieres depenses ou importez des factures par OCR.">
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> Ajouter une depense</Button>
        </EmptyState>
      ) : (
        <>
          <div className="hidden sm:block rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Fournisseur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Categorie</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">TVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(e => {
                    const cat = EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.autre;
                    return (
                      <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(e.date)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{e.description}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{e.supplier || '-'}</td>
                        <td className="px-4 py-3"><span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cat.color)}>{cat.label}</span></td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(e.amount)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground text-right">{formatCurrency(e.tva_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="sm:hidden space-y-3">
            {filtered.map(e => {
              const cat = EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.autre;
              return (
                <div key={e.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{e.description}</p>
                    <p className="text-sm font-semibold text-foreground whitespace-nowrap">{formatCurrency(e.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(e.date)}</span>
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', cat.color)}>{cat.label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{e.supplier || '-'}</span>
                    <span className="text-xs text-muted-foreground">TVA: {formatCurrency(e.tva_amount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle depense</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><label className="text-sm font-medium">Description</label><Input className="mt-1" placeholder="Ex: Achat carrelage" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Montant TTC</label><Input className="mt-1" type="number" placeholder="0" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
              <div><label className="text-sm font-medium">TVA</label><Input className="mt-1" type="number" placeholder="0" value={form.tvaAmount || ''} onChange={e => setForm({ ...form, tvaAmount: Number(e.target.value) })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Categorie</label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><label className="text-sm font-medium">Date</label><Input className="mt-1" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            </div>
            <div><label className="text-sm font-medium">Fournisseur</label><Input className="mt-1" placeholder="Nom du fournisseur" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createExpense} disabled={!form.description.trim()}>Ajouter</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showChat} onOpenChange={setShowChat}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Chat comptable IA</DialogTitle></DialogHeader>
          <div className="mt-4 min-h-[300px] rounded-lg bg-muted/30 p-4 flex flex-col">
            <div className="flex-1 space-y-3">
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 text-sm max-w-[80%]">
                  <p>Bonjour ! Je suis votre assistant comptable. Posez-moi vos questions sur la TVA, les depenses, les declarations...</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <Input placeholder="Ex: Quel est mon taux de TVA a declarer ?" className="flex-1" />
              <Button size="icon"><Sparkles className="h-4 w-4" /></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
