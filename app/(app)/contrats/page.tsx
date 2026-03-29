'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Flame, Wind, Waves, FileText, TrendingUp, Calendar, MoveHorizontal as MoreHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/constants';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface Contract {
  id: string;
  title: string;
  contract_type: string;
  amount: number;
  frequency: string;
  status: string;
  start_date: string | null;
  next_billing: string | null;
  created_at: string;
  clients: { name: string } | null;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  chaudiere: Flame,
  clim: Wind,
  piscine: Waves,
  autre: FileText,
};

const FREQ_LABELS: Record<string, string> = {
  mensuel: '/mois',
  trimestriel: '/trim.',
  annuel: '/an',
};

export default function ContratsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', clientName: '', contractType: 'chaudiere', amount: 0, frequency: 'mensuel' });

  useEffect(() => { loadContracts(); }, []);

  async function loadContracts() {
    const { data } = await supabase
      .from('recurring_contracts')
      .select('id, title, contract_type, amount, frequency, status, start_date, next_billing, created_at, clients(name)')
      .order('created_at', { ascending: false });
    setContracts((data as unknown as Contract[]) || []);
    setLoading(false);
  }

  async function createContract() {
    let clientId: string | null = null;
    if (form.clientName.trim()) {
      const { data: existing } = await supabase.from('clients').select('id').eq('name', form.clientName.trim()).maybeSingle();
      if (existing) { clientId = existing.id; }
      else {
        const { data: newC } = await supabase.from('clients').insert({ name: form.clientName.trim() }).select('id').single();
        clientId = newC?.id || null;
      }
    }
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('recurring_contracts').insert({
      title: form.title,
      client_id: clientId,
      contract_type: form.contractType,
      amount: form.amount,
      frequency: form.frequency,
      start_date: today,
      next_billing: today,
    });
    setShowCreate(false);
    setForm({ title: '', clientName: '', contractType: 'chaudiere', amount: 0, frequency: 'mensuel' });
    loadContracts();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('recurring_contracts').update({ status }).eq('id', id);
    loadContracts();
  }

  const activeContracts = contracts.filter(c => c.status === 'actif');
  const mrr = activeContracts.reduce((s, c) => {
    if (c.frequency === 'mensuel') return s + c.amount;
    if (c.frequency === 'trimestriel') return s + c.amount / 3;
    if (c.frequency === 'annuel') return s + c.amount / 12;
    return s;
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Contrats recurrents" description="Abonnements et contrats d'entretien">
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau contrat
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 text-primary" /> Contrats actifs</div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{activeContracts.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4 text-emerald-500" /> MRR</div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(mrr)}</p>
          <p className="text-xs text-muted-foreground">Revenu mensuel recurrent</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-4 w-4 text-blue-500" /> ARR</div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(mrr * 12)}</p>
          <p className="text-xs text-muted-foreground">Revenu annuel recurrent</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : contracts.length === 0 ? (
        <EmptyState icon={RefreshCw} title="Aucun contrat" description="Creez des contrats d'entretien recurrents pour generer du revenu previsible.">
          <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="h-4 w-4" /> Creer un contrat</Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {contracts.map(c => {
            const Icon = TYPE_ICONS[c.contract_type] || FileText;
            return (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.clients?.name || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-6 justify-between sm:justify-end">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(c.amount)}{FREQ_LABELS[c.frequency] || ''}</p>
                    {c.next_billing && <p className="text-xs text-muted-foreground">Proch. : {formatDate(c.next_billing)}</p>}
                  </div>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    c.status === 'actif' ? 'bg-emerald-50 text-emerald-700' :
                    c.status === 'suspendu' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                  )}>
                    {c.status === 'actif' ? 'Actif' : c.status === 'suspendu' ? 'Suspendu' : 'Resilie'}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatus(c.id, 'actif')}>Activer</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(c.id, 'suspendu')}>Suspendre</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(c.id, 'resilie')}>Resilier</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau contrat</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><label className="text-sm font-medium">Titre</label><Input className="mt-1" placeholder="Ex: Entretien chaudiere" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Client</label><Input className="mt-1" placeholder="Nom du client" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={form.contractType} onValueChange={v => setForm({ ...form, contractType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chaudiere">Chaudiere</SelectItem>
                    <SelectItem value="clim">Climatisation</SelectItem>
                    <SelectItem value="piscine">Piscine</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Frequence</label>
                <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensuel">Mensuel</SelectItem>
                    <SelectItem value="trimestriel">Trimestriel</SelectItem>
                    <SelectItem value="annuel">Annuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><label className="text-sm font-medium">Montant</label><Input className="mt-1" type="number" placeholder="0" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createContract} disabled={!form.title.trim()}>Creer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
