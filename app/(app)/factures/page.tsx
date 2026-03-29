'use client';

import { useState, useEffect } from 'react';
import { Plus, Receipt, Search, MoveHorizontal as MoreHorizontal, CircleCheck as CheckCircle, Clock, TriangleAlert as AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { INVOICE_STATUSES, formatCurrency, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Invoice {
  id: string;
  invoice_number: string;
  title: string;
  status: keyof typeof INVOICE_STATUSES;
  total_ttc: number;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  clients: { name: string } | null;
}

export default function FacturesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', clientName: '', totalHt: 0 });

  useEffect(() => { loadInvoices(); }, []);

  async function loadInvoices() {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, title, status, total_ttc, due_date, paid_at, created_at, clients(name)')
      .order('created_at', { ascending: false });
    setInvoices((data as unknown as Invoice[]) || []);
    setLoading(false);
  }

  async function createInvoice() {
    let clientId: string | null = null;
    if (form.clientName.trim()) {
      const { data: existing } = await supabase.from('clients').select('id').eq('name', form.clientName.trim()).maybeSingle();
      if (existing) { clientId = existing.id; }
      else {
        const { data: newC } = await supabase.from('clients').insert({ name: form.clientName.trim() }).select('id').single();
        clientId = newC?.id || null;
      }
    }
    const now = new Date();
    const invNumber = `F-${now.getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    await supabase.from('invoices').insert({
      invoice_number: invNumber,
      client_id: clientId,
      title: form.title,
      total_ht: form.totalHt,
      total_ttc: form.totalHt * 1.2,
      due_date: dueDate.toISOString().split('T')[0],
    });
    setShowCreate(false);
    setForm({ title: '', clientName: '', totalHt: 0 });
    loadInvoices();
  }

  async function updateStatus(id: string, status: string) {
    const updates: Record<string, string> = { status, updated_at: new Date().toISOString() };
    if (status === 'payee') updates.paid_at = new Date().toISOString();
    await supabase.from('invoices').update(updates).eq('id', id);
    loadInvoices();
  }

  const filtered = invoices.filter(inv =>
    inv.title.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnpaid = invoices.filter(i => i.status === 'envoyee' || i.status === 'en_retard').reduce((s, i) => s + i.total_ttc, 0);
  const totalPaid = invoices.filter(i => i.status === 'payee').reduce((s, i) => s + i.total_ttc, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Factures" description="Gerez vos factures et suivez les paiements">
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle facture
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4 text-emerald-500" /> Encaisse</div>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4 text-blue-500" /> En attente</div>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(totalUnpaid)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertTriangle className="h-4 w-4 text-red-500" /> En retard</div>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {formatCurrency(invoices.filter(i => i.status === 'en_retard').reduce((s, i) => s + i.total_ttc, 0))}
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Rechercher une facture..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucune facture" description="Creez votre premiere facture.">
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> Creer une facture</Button>
        </EmptyState>
      ) : (
        <>
          <div className="hidden sm:block rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Numero</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Titre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Echeance</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(inv => {
                    const st = INVOICE_STATUSES[inv.status] || INVOICE_STATUSES.brouillon;
                    return (
                      <tr key={inv.id} className="transition-colors hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{inv.clients?.name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{inv.title}</td>
                        <td className="px-4 py-3"><StatusBadge label={st.label} color={st.color} /></td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(inv.total_ttc)}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
                        <td className="px-4 py-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => updateStatus(inv.id, 'envoyee')}>Marquer envoyee</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(inv.id, 'payee')}>Marquer payee</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(inv.id, 'en_retard')}>Marquer en retard</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sm:hidden space-y-3">
            {filtered.map(inv => {
              const st = INVOICE_STATUSES[inv.status] || INVOICE_STATUSES.brouillon;
              return (
                <div key={inv.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{inv.title}</p>
                      <p className="text-xs text-muted-foreground">{inv.clients?.name || '-'}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => updateStatus(inv.id, 'envoyee')}>Marquer envoyee</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(inv.id, 'payee')}>Marquer payee</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(inv.id, 'en_retard')}>Marquer en retard</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{inv.invoice_number}</span>
                    <StatusBadge label={st.label} color={st.color} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{formatCurrency(inv.total_ttc)}</p>
                    <p className="text-xs text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : '-'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle facture</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input className="mt-1" placeholder="Ex: Travaux salle de bain" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Client</label>
              <Input className="mt-1" placeholder="Nom du client" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Montant HT</label>
              <Input className="mt-1" type="number" placeholder="0" value={form.totalHt || ''} onChange={e => setForm({ ...form, totalHt: Number(e.target.value) })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createInvoice} disabled={!form.title.trim()}>Creer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
