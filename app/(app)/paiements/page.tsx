'use client';

import { useState } from 'react';
import { CreditCard, Link2, Send, Copy, Check, Euro, ArrowUpRight, Shield } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/constants';

interface PaymentLink {
  id: string;
  client: string;
  amount: number;
  description: string;
  status: 'active' | 'paid' | 'expired';
  url: string;
  created_at: string;
}

const DEMO_LINKS: PaymentLink[] = [
  { id: '1', client: 'Jean Dupont', amount: 4800, description: 'Acompte renovation cuisine', status: 'active', url: 'https://pay.stripe.com/...', created_at: '2024-03-28' },
  { id: '2', client: 'Marie Martin', amount: 12500, description: 'Solde travaux salle de bain', status: 'paid', url: 'https://pay.stripe.com/...', created_at: '2024-03-25' },
  { id: '3', client: 'Pierre Bernard', amount: 2500, description: 'Acompte 30% terrasse', status: 'active', url: 'https://pay.stripe.com/...', created_at: '2024-03-22' },
];

export default function PaiementsPage() {
  const [links] = useState<PaymentLink[]>(DEMO_LINKS);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({ client: '', amount: 0, description: '' });

  function copyLink(id: string) {
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const totalCollected = links.filter(l => l.status === 'paid').reduce((s, l) => s + l.amount, 0);
  const totalPending = links.filter(l => l.status === 'active').reduce((s, l) => s + l.amount, 0);

  const STATUS_MAP = {
    active: { label: 'En attente', color: 'bg-blue-50 text-blue-700' },
    paid: { label: 'Paye', color: 'bg-emerald-50 text-emerald-700' },
    expired: { label: 'Expire', color: 'bg-slate-100 text-slate-500' },
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Paiements Stripe" description="Liens de paiement et prelevement SEPA">
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Link2 className="h-4 w-4" /> Creer un lien de paiement
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Euro className="h-4 w-4 text-emerald-500" /> Encaisse</div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4 text-blue-500" /> En attente</div>
          <p className="mt-2 text-2xl font-semibold text-foreground">{formatCurrency(totalPending)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Shield className="h-4 w-4 text-primary" /> Stripe Connect</div>
          <p className="mt-2 text-sm font-medium text-foreground">Paiements securises</p>
          <p className="text-xs text-muted-foreground">CB, SEPA, Apple Pay</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Liens de paiement</h2>
        </div>
        <div className="divide-y divide-border">
          {links.map(link => {
            const st = STATUS_MAP[link.status];
            return (
              <div key={link.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{link.description}</p>
                    <p className="text-xs text-muted-foreground">{link.client}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end">
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(link.amount)}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>{st.label}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(link.id)}>
                      {copied === link.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
            <ArrowUpRight className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Prelevement SEPA</h3>
            <p className="text-sm text-muted-foreground">Configurez le prelevement automatique pour les contrats recurrents</p>
          </div>
        </div>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Creer un lien de paiement</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><label className="text-sm font-medium">Client</label><Input className="mt-1" placeholder="Nom du client" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Montant</label><Input className="mt-1" type="number" placeholder="0" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><label className="text-sm font-medium">Description</label><Input className="mt-1" placeholder="Ex: Acompte travaux cuisine" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button disabled={!form.client || !form.amount} className="gap-2"><Link2 className="h-4 w-4" /> Generer le lien</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
