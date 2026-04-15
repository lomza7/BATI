'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Flame,
  Wind,
  Waves,
  FileText,
  TrendingUp,
  Calendar,
  MoveHorizontal as MoreHorizontal,
  Search,
  Receipt,
  ChevronDown,
  ChevronUp,
  Send,
  Euro,
  CircleCheck as CheckCircle,
  Clock,
  Percent,
  Edit,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { getNextInvoiceNumber, getNextQuoteNumber } from '@/lib/document-numbers';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, INVOICE_STATUSES, QUOTE_STATUSES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ClientPicker } from '@/components/shared/client-picker';
import { SendInvoiceDialog } from '@/components/factures/send-invoice-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

interface ContractInvoice {
  id: string;
  invoice_id: string;
  billing_period_start: string;
  billing_period_end: string;
  created_at: string;
  invoices: {
    id: string;
    invoice_number: string;
    title: string;
    status: keyof typeof INVOICE_STATUSES;
    total_ttc: number;
    paid_at: string | null;
  } | null;
}

interface Contract {
  id: string;
  title: string;
  description: string;
  contract_type: string;
  amount: number;
  frequency: string;
  tva_rate: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  next_billing: string | null;
  auto_send: boolean;
  notes: string;
  created_at: string;
  last_billed_at: string | null;
  quote_id: string | null;
  line_items: ContractLineItem[];
  quotes: { id: string; quote_number: string; status: string } | null;
  clients: { id: string; name: string; email: string | null } | null;
  contract_invoices: ContractInvoice[];
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  chaudiere: Flame,
  clim: Wind,
  piscine: Waves,
  autre: FileText,
};

const TYPE_LABELS: Record<string, string> = {
  chaudiere: 'Chaudière',
  clim: 'Climatisation',
  piscine: 'Piscine',
  autre: 'Autre',
};

const FREQ_LABELS: Record<string, string> = {
  mensuel: '/mois',
  trimestriel: '/trim.',
  annuel: '/an',
};

const mrrChartConfig = {
  mrr: { label: 'MRR collecté', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig;

const TVA_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 5.5, label: '5,5%' },
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
];

interface ContractLineItem {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
}

interface FormState {
  title: string;
  clientId: string | null;
  contractType: string;
  amount: number;
  frequency: string;
  tvaRate: number;
  description: string;
  notes: string;
  autoSend: boolean;
  startDate: string;
  endDate: string;
  lineItems: ContractLineItem[];
}

const emptyForm: FormState = {
  title: '',
  clientId: null,
  contractType: 'chaudiere',
  amount: 0,
  frequency: 'mensuel',
  tvaRate: 20,
  description: '',
  notes: '',
  autoSend: false,
  startDate: new Date().toLocaleDateString('fr-CA'),
  endDate: '',
  lineItems: [],
};

export default function ContratsPage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('tous');
  const [filterType, setFilterType] = useState('tous');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [billingContractId, setBillingContractId] = useState<string | null>(null);
  const [sendInvoice, setSendInvoice] = useState<{ id: string; invoice_number: string; title: string; total_ttc: number; status: string; clients?: { name: string; email?: string | null } | null } | null>(null);

  useEffect(() => { loadContracts(); }, []);

  async function loadContracts() {
    const { data } = await supabase
      .from('recurring_contracts')
      .select(`
        id, title, description, contract_type, amount, frequency, tva_rate, status,
        start_date, end_date, next_billing, auto_send, notes, created_at, last_billed_at,
        quote_id, line_items, quotes(id, quote_number, status, deleted_at),
        clients(id, name, email, deleted_at),
        contract_invoices(id, invoice_id, billing_period_start, billing_period_end, created_at, invoices(id, invoice_number, title, status, total_ttc, paid_at))
      `)
      .order('created_at', { ascending: false });
    setContracts((((data as unknown as Array<Record<string, unknown>>) || [])).map((contract) => {
      const quoteValue = Array.isArray(contract.quotes) ? contract.quotes[0] : contract.quotes;
      const clientValue = Array.isArray(contract.clients) ? contract.clients[0] : contract.clients;
      return {
        ...contract,
        quotes: quoteValue && typeof quoteValue === 'object' && !(quoteValue as { deleted_at?: string | null }).deleted_at
          ? {
              id: String((quoteValue as { id?: string }).id || ''),
              quote_number: String((quoteValue as { quote_number?: string }).quote_number || ''),
              status: String((quoteValue as { status?: string }).status || ''),
            }
          : null,
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? {
              id: String((clientValue as { id?: string }).id || ''),
              name: String((clientValue as { name?: string }).name || ''),
              email: (clientValue as { email?: string | null }).email || null,
            }
          : null,
      } as Contract;
    }));
    setLoading(false);
  }

  async function saveContract() {
    if (!user || !form.title.trim()) return;

    // Recalculate amount from line items if present
    const validLineItems = form.lineItems.filter(l => l.description.trim());
    const computedAmount = validLineItems.length > 0
      ? validLineItems.reduce((sum, l) => sum + l.quantity * l.unit_price, 0)
      : form.amount;

    const payload = {
      user_id: user.id,
      title: form.title,
      client_id: form.clientId,
      contract_type: form.contractType,
      amount: computedAmount,
      frequency: form.frequency,
      tva_rate: form.tvaRate,
      description: form.description,
      notes: form.notes,
      auto_send: form.autoSend,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      next_billing: form.startDate || new Date().toLocaleDateString('fr-CA'),
      updated_at: new Date().toISOString(),
      line_items: validLineItems.length > 0 ? validLineItems : [],
    };

    if (editingId) {
      await supabase.from('recurring_contracts').update(payload).eq('id', editingId);
    } else {
      await supabase.from('recurring_contracts').insert(payload);
    }

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    loadContracts();
  }

  function openEdit(c: Contract) {
    setEditingId(c.id);
    setForm({
      title: c.title,
      clientId: c.clients?.id || null,
      contractType: c.contract_type,
      amount: c.amount,
      frequency: c.frequency,
      tvaRate: c.tva_rate ?? 20,
      description: c.description || '',
      notes: c.notes || '',
      autoSend: c.auto_send,
      startDate: c.start_date || '',
      endDate: c.end_date || '',
      lineItems: Array.isArray(c.line_items) ? c.line_items : [],
    });
    setShowForm(true);
  }

  async function updateStatus(id: string, status: string) {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'resilie') updates.cancelled_at = new Date().toISOString();
    await supabase.from('recurring_contracts').update(updates).eq('id', id);
    loadContracts();
  }

  async function generateInvoice(contract: Contract) {
    if (!user) return;
    setBillingContractId(contract.id);

    try {
      const invoiceNumber = await getNextInvoiceNumber(supabase, user.id);

      const totalHt = contract.amount;
      const tvaRate = contract.tva_rate ?? 20;
      const totalTtc = Math.round(totalHt * (1 + tvaRate / 100) * 100) / 100;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: invoice } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          invoice_number: invoiceNumber,
          client_id: contract.clients?.id || null,
          recurring_contract_id: contract.id,
          title: contract.title,
          total_ht: totalHt,
          total_ttc: totalTtc,
          tva_rate: tvaRate,
          due_date: dueDate.toLocaleDateString('fr-CA'),
          status: 'creee',
          issued_at: new Date().toISOString(),
        })
        .select('id, invoice_number, title, total_ttc, status')
        .single();

      if (!invoice) return;

      // Create invoice lines (multi-line if contract has line_items)
      const items = Array.isArray(contract.line_items) && contract.line_items.length > 0
        ? contract.line_items
        : null;

      if (items) {
        await supabase.from('invoice_lines').insert(
          items.map((item: ContractLineItem, i: number) => ({
            user_id: user.id,
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit || 'forfait',
            unit_price: item.unit_price,
            tva_rate: item.tva_rate ?? tvaRate,
            total: item.quantity * item.unit_price,
            position: i,
          }))
        );
      } else {
        await supabase.from('invoice_lines').insert({
          user_id: user.id,
          invoice_id: invoice.id,
          description: contract.title,
          quantity: 1,
          unit: 'forfait',
          unit_price: totalHt,
          total: totalHt,
          position: 0,
        });
      }

      // Link contract to invoice
      const billingStart = contract.next_billing || new Date().toLocaleDateString('fr-CA');
      const periodEnd = new Date(billingStart);
      if (contract.frequency === 'mensuel') periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (contract.frequency === 'trimestriel') periodEnd.setMonth(periodEnd.getMonth() + 3);
      else periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);

      await supabase.from('contract_invoices').insert({
        user_id: user.id,
        contract_id: contract.id,
        invoice_id: invoice.id,
        billing_period_start: billingStart,
        billing_period_end: periodEnd.toLocaleDateString('fr-CA'),
      });

      // Advance billing date
      await supabase.rpc('advance_contract_billing', { p_contract_id: contract.id });

      await loadContracts();

      // Open send dialog
      setSendInvoice({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        title: invoice.title,
        total_ttc: invoice.total_ttc,
        status: invoice.status,
        clients: contract.clients ? { name: contract.clients.name, email: contract.clients.email } : null,
      });
    } finally {
      setBillingContractId(null);
    }
  }

  async function generateQuote(contract: Contract) {
    if (!user) return;

    const quoteNumber = await getNextQuoteNumber(supabase, user.id);

    const totalHt = contract.amount;
    const tvaRate = contract.tva_rate ?? 20;
    const totalTtc = Math.round(totalHt * (1 + tvaRate / 100) * 100) / 100;

    // Compute validity date (30 days)
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);

    const { data: quote } = await supabase
      .from('quotes')
      .insert({
        user_id: user.id,
        quote_number: quoteNumber,
        client_id: contract.clients?.id || null,
        title: `${contract.title} — Contrat ${FREQ_LABELS[contract.frequency] ? contract.frequency : ''}`,
        description: contract.description || '',
        total_ht: totalHt,
        tva_rate: tvaRate,
        total_ttc: totalTtc,
        valid_until: validUntil.toLocaleDateString('fr-CA'),
        status: 'brouillon',
      })
      .select('id')
      .single();

    if (!quote) return;

    // Create quote line
    await supabase.from('quote_lines').insert({
      user_id: user.id,
      quote_id: quote.id,
      description: contract.title,
      detail: contract.description || null,
      quantity: 1,
      unit: 'forfait',
      unit_price: totalHt,
      total: totalHt,
      position: 0,
    });

    // Link contract to quote
    await supabase.from('recurring_contracts').update({
      quote_id: quote.id,
      updated_at: new Date().toISOString(),
    }).eq('id', contract.id);

    await loadContracts();
  }

  // Computed data
  const activeContracts = contracts.filter(c => c.status === 'actif');

  const mrr = activeContracts.reduce((s, c) => {
    if (c.frequency === 'mensuel') return s + c.amount;
    if (c.frequency === 'trimestriel') return s + c.amount / 3;
    if (c.frequency === 'annuel') return s + c.amount / 12;
    return s;
  }, 0);

  const now = new Date();
  const upcomingBillings = activeContracts.filter(c => {
    if (!c.next_billing) return false;
    const d = new Date(c.next_billing);
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  const allContractInvoices = contracts.flatMap(c => c.contract_invoices || []);
  const paidInvoices = allContractInvoices.filter(ci => ci.invoices?.status === 'payee');
  const collectionRate = allContractInvoices.length > 0
    ? Math.round((paidInvoices.length / allContractInvoices.length) * 100)
    : 0;

  const avgContractValue = activeContracts.length > 0
    ? activeContracts.reduce((s, c) => {
        if (c.frequency === 'mensuel') return s + c.amount;
        if (c.frequency === 'trimestriel') return s + c.amount / 3;
        if (c.frequency === 'annuel') return s + c.amount / 12;
        return s;
      }, 0) / activeContracts.length
    : 0;

  // MRR chart data (last 12 months from paid contract invoices)
  const mrrChartData = useMemo(() => {
    const months: { month: string; mrr: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const monthPaid = paidInvoices
        .filter(ci => ci.invoices?.paid_at?.startsWith(key))
        .reduce((s, ci) => s + (ci.invoices?.total_ttc || 0), 0);
      months.push({ month: label, mrr: monthPaid });
    }
    return months;
  }, [paidInvoices]);

  // Filtered contracts
  const filtered = contracts.filter(c => {
    if (filterStatus !== 'tous' && c.status !== filterStatus) return false;
    if (filterType !== 'tous' && c.contract_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.clients?.name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Contrats récurrents" description="Abonnements et contrats d&apos;entretien">
        <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nouveau contrat
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Contrats actifs"
          value={String(activeContracts.length)}
          subtitle={`${contracts.filter(c => c.status === 'suspendu').length} suspendu${contracts.filter(c => c.status === 'suspendu').length > 1 ? 's' : ''}`}
          icon={RefreshCw}
        />
        <KpiCard
          title="MRR"
          value={formatCurrency(mrr)}
          subtitle="Revenu mensuel récurrent"
          icon={TrendingUp}
          sparkline={mrrChartData.map(d => ({ value: d.mrr }))}
          sparklineColor="hsl(var(--chart-1))"
        />
        <KpiCard
          title="ARR"
          value={formatCurrency(mrr * 12)}
          subtitle="Revenu annuel récurrent"
          icon={Euro}
        />
        <KpiCard
          title="Prochaines échéances"
          value={String(upcomingBillings.length)}
          subtitle="À facturer dans les 7 jours"
          icon={Calendar}
        />
        <KpiCard
          title="Taux d'encaissement"
          value={`${collectionRate}%`}
          subtitle={`${paidInvoices.length}/${allContractInvoices.length} factures payées`}
          icon={Percent}
        />
        <KpiCard
          title="Valeur moyenne"
          value={formatCurrency(avgContractValue)}
          subtitle="Par contrat actif (mensuel)"
          icon={Receipt}
        />
      </div>

      {/* MRR Chart */}
      {mrrChartData.some(d => d.mrr > 0) && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Revenus récurrents collectés</h2>
          <p className="text-sm text-muted-foreground mt-1">Encaissements des contrats sur les 12 derniers mois</p>
          <div className="mt-4 h-[200px]">
            <ChartContainer config={mrrChartConfig} className="h-full w-full">
              <AreaChart data={mrrChartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={v => `${v}€`} width={50} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="var(--color-mrr)"
                  fill="var(--color-mrr)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher un contrat…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="tous">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="actif">Actif</option>
          <option value="suspendu">Suspendu</option>
          <option value="resilie">Résilié</option>
        </select>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="tous">Tous les types</option>
          <option value="chaudiere">Chaudière</option>
          <option value="clim">Climatisation</option>
          <option value="piscine">Piscine</option>
          <option value="autre">Autre</option>
        </select>
      </div>

      {/* Contract List */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        contracts.length === 0 ? (
          <EmptyState icon={RefreshCw} title="Aucun contrat" description="Créez des contrats d&apos;entretien récurrents pour générer du revenu prévisible.">
            <Button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }} className="gap-2"><Plus className="h-4 w-4" /> Créer un contrat</Button>
          </EmptyState>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            Aucun contrat ne correspond aux filtres.
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const Icon = TYPE_ICONS[c.contract_type] || FileText;
            const isExpanded = expandedId === c.id;
            const invoices = (c.contract_invoices || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const isBillingDue = c.status === 'actif' && c.next_billing && new Date(c.next_billing) <= now;

            return (
              <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-sm">
                {/* Main row */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', c.status === 'actif' || c.status === 'en_attente' ? 'bg-primary/10' : 'bg-muted')}>
                      <Icon className={cn('h-5 w-5', c.status === 'actif' || c.status === 'en_attente' ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{c.title}</p>
                        {isBillingDue && (
                          <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">À facturer</Badge>
                        )}
                        {c.quotes && (() => {
                          const qst = QUOTE_STATUSES[c.quotes.status as keyof typeof QUOTE_STATUSES];
                          return qst ? (
                            <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0">
                              <FileText className="h-2.5 w-2.5" /> {c.quotes.quote_number} — {qst.label}
                            </Badge>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground">{c.clients?.name || '-'}</p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <p className="text-xs text-muted-foreground">{TYPE_LABELS[c.contract_type] || c.contract_type}</p>
                        {c.auto_send && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">Auto</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 justify-between sm:justify-end">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(c.amount)} HT{FREQ_LABELS[c.frequency] || ''}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatCurrency(Math.round(c.amount * (1 + (c.tva_rate ?? 20) / 100) * 100) / 100)} TTC
                        {c.tva_rate !== 20 && c.tva_rate != null && ` (TVA ${c.tva_rate}%)`}
                      </p>
                      {c.next_billing && c.status === 'actif' && (
                        <p className="text-xs text-muted-foreground">Proch. : {formatDate(c.next_billing)}</p>
                      )}
                    </div>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      c.status === 'en_attente' ? 'bg-blue-50 text-blue-700' :
                      c.status === 'actif' ? 'bg-emerald-50 text-emerald-700' :
                      c.status === 'suspendu' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    )}>
                      {c.status === 'en_attente' ? 'En attente' : c.status === 'actif' ? 'Actif' : c.status === 'suspendu' ? 'Suspendu' : 'Résilié'}
                    </span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {c.status === 'actif' && (
                          <DropdownMenuItem onClick={() => generateInvoice(c)} disabled={billingContractId === c.id}>
                            <Receipt className="mr-2 h-4 w-4" />
                            {billingContractId === c.id ? 'Génération…' : 'Facturer maintenant'}
                          </DropdownMenuItem>
                        )}
                        {!c.quote_id && (
                          <DropdownMenuItem onClick={() => generateQuote(c)}>
                            <FileText className="mr-2 h-4 w-4" /> Générer un devis
                          </DropdownMenuItem>
                        )}
                        {c.quotes && (
                          <DropdownMenuItem onClick={() => window.location.href = '/devis'}>
                            <FileText className="mr-2 h-4 w-4" /> Voir le devis {c.quotes.quote_number}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => openEdit(c)}>
                          <Edit className="mr-2 h-4 w-4" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {c.status !== 'actif' && (
                          <DropdownMenuItem onClick={() => updateStatus(c.id, 'actif')}>Réactiver</DropdownMenuItem>
                        )}
                        {c.status === 'actif' && (
                          <DropdownMenuItem onClick={() => updateStatus(c.id, 'suspendu')}>Suspendre</DropdownMenuItem>
                        )}
                        {c.status !== 'resilie' && (
                          <DropdownMenuItem onClick={() => updateStatus(c.id, 'resilie')} className="text-red-600">Résilier</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded section */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-4 bg-muted/10 space-y-4">
                    {/* Contract details */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Début</p>
                        <p className="font-medium text-foreground">{c.start_date ? formatDate(c.start_date) : '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fin</p>
                        <p className="font-medium text-foreground">{c.end_date ? formatDate(c.end_date) : 'Indéterminée'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Dernière facturation</p>
                        <p className="font-medium text-foreground">{c.last_billed_at ? formatDate(c.last_billed_at) : 'Jamais'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Devis</p>
                        {c.quotes ? (
                          <a href="/devis" className="font-medium text-primary hover:underline">
                            {c.quotes.quote_number} — {(QUOTE_STATUSES[c.quotes.status as keyof typeof QUOTE_STATUSES])?.label || c.quotes.status}
                          </a>
                        ) : (
                          <button onClick={() => generateQuote(c)} className="font-medium text-primary hover:underline">
                            Générer un devis
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Payment summary */}
                    {invoices.length > 0 && (() => {
                      const paid = invoices.filter(ci => ci.invoices?.status === 'payee');
                      const pending = invoices.filter(ci => ci.invoices && ci.invoices.status !== 'payee');
                      const totalPaid = paid.reduce((s, ci) => s + (ci.invoices?.total_ttc || 0), 0);
                      const totalPending = pending.reduce((s, ci) => s + (ci.invoices?.total_ttc || 0), 0);
                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="rounded-lg border border-border bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-2">
                            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Encaissé</p>
                            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(totalPaid)}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
                            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">En attente</p>
                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mt-0.5">{formatCurrency(totalPending)}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Factures</p>
                            <p className="text-sm font-semibold text-foreground mt-0.5">{invoices.length}</p>
                          </div>
                          <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">TVA</p>
                            <p className="text-sm font-semibold text-foreground mt-0.5">{c.tva_rate ?? 20}%</p>
                          </div>
                        </div>
                      );
                    })()}

                    {(c.description || c.notes) && (
                      <div className="text-sm">
                        {c.description && <p className="text-muted-foreground">{c.description}</p>}
                        {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
                      </div>
                    )}

                    {/* Billing history */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Historique de facturation</p>
                      {invoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucune facture générée pour ce contrat.</p>
                      ) : (
                        <div className="space-y-2">
                          {invoices.map(ci => {
                            const inv = ci.invoices;
                            if (!inv) return null;
                            const st = INVOICE_STATUSES[inv.status] || INVOICE_STATUSES.brouillon;
                            return (
                              <div key={ci.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                                <div className="flex items-center gap-3">
                                  <Receipt className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{inv.invoice_number}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDate(ci.billing_period_start)} → {formatDate(ci.billing_period_end)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 justify-between sm:justify-end">
                                  <span className="text-sm font-medium text-foreground">{formatCurrency(inv.total_ttc)}</span>
                                  <StatusBadge label={st.label} color={st.color} />
                                  {inv.status !== 'payee' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 gap-1 text-xs"
                                      onClick={e => {
                                        e.stopPropagation();
                                        setSendInvoice({
                                          id: inv.id,
                                          invoice_number: inv.invoice_number,
                                          title: inv.title,
                                          total_ttc: inv.total_ttc,
                                          status: inv.status,
                                          clients: c.clients ? { name: c.clients.name, email: c.clients.email } : null,
                                        });
                                      }}
                                    >
                                      <Send className="h-3 w-3" /> Envoyer
                                    </Button>
                                  )}
                                  {inv.status === 'payee' && (
                                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                                      <CheckCircle className="h-3 w-3" />
                                      {inv.paid_at ? formatDate(inv.paid_at) : 'Payée'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Send Invoice Dialog */}
      {sendInvoice && (
        <SendInvoiceDialog
          invoice={sendInvoice}
          onClose={() => setSendInvoice(null)}
          onSent={() => loadContracts()}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) { setShowForm(false); setEditingId(null); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le contrat' : 'Nouveau contrat'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">Titre *</label>
              <Input className="mt-1" placeholder="Ex : Entretien chaudière annuel" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>

            <div>
              <label className="text-sm font-medium">Client</label>
              <div className="mt-1">
                <ClientPicker value={form.clientId} onChange={(id) => setForm({ ...form, clientId: id })} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Type</label>
                <Select value={form.contractType} onValueChange={v => setForm({ ...form, contractType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="chaudiere">Chaudière</SelectItem>
                    <SelectItem value="clim">Climatisation</SelectItem>
                    <SelectItem value="piscine">Piscine</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Fréquence</label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Montant HT</label>
                <Input className="mt-1" type="number" placeholder="0" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">TVA</label>
                <Select value={String(form.tvaRate)} onValueChange={v => setForm({ ...form, tvaRate: Number(v) })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TVA_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.amount > 0 && form.lineItems.length === 0 && (
              <p className="text-xs text-muted-foreground -mt-2">
                TTC : {formatCurrency(Math.round(form.amount * (1 + form.tvaRate / 100) * 100) / 100)}
              </p>
            )}

            {/* Line items (optional detailed breakdown) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Lignes du contrat</label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs h-7"
                  onClick={() => setForm({
                    ...form,
                    lineItems: [...form.lineItems, { description: '', quantity: 1, unit: 'forfait', unit_price: 0, tva_rate: form.tvaRate }],
                  })}
                >
                  <Plus className="h-3 w-3" /> Ligne
                </Button>
              </div>
              {form.lineItems.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune ligne. Le montant HT ci-dessus sera utilisé comme forfait unique.</p>
              ) : (
                <div className="space-y-2">
                  {form.lineItems.map((item, i) => (
                    <div key={i} className="rounded-lg border border-border p-2.5 space-y-2">
                      <div className="flex items-start gap-2">
                        <Input
                          className="flex-1 text-xs h-8"
                          placeholder="Description"
                          value={item.description}
                          onChange={e => {
                            const updated = [...form.lineItems];
                            updated[i] = { ...updated[i], description: e.target.value };
                            setForm({ ...form, lineItems: updated });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, lineItems: form.lineItems.filter((_, j) => j !== i) })}
                          className="text-muted-foreground hover:text-red-500 p-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          className="w-16 text-xs h-7 text-center"
                          type="number"
                          min={0}
                          value={item.quantity || ''}
                          onChange={e => {
                            const updated = [...form.lineItems];
                            updated[i] = { ...updated[i], quantity: Number(e.target.value) };
                            setForm({ ...form, lineItems: updated });
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">×</span>
                        <Input
                          className="w-24 text-xs h-7"
                          type="number"
                          step="0.01"
                          placeholder="Prix unit."
                          value={item.unit_price || ''}
                          onChange={e => {
                            const updated = [...form.lineItems];
                            updated[i] = { ...updated[i], unit_price: Number(e.target.value) };
                            setForm({ ...form, lineItems: updated });
                          }}
                        />
                        <span className="text-[10px] text-muted-foreground">=</span>
                        <span className="text-xs font-medium whitespace-nowrap">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground">Total HT :</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(form.lineItems.reduce((s, l) => s + l.quantity * l.unit_price, 0))}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date de début</label>
                <Input className="mt-1" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Date de fin (optionnel)</label>
                <Input className="mt-1" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                placeholder="Scope du contrat…"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Notes internes</label>
              <Input className="mt-1" placeholder="Notes…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoSend}
                onChange={e => setForm({ ...form, autoSend: e.target.checked })}
                className="rounded border-input"
              />
              <span className="text-sm">Envoyer automatiquement les factures par email</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); }}>Annuler</Button>
              <Button onClick={saveContract} disabled={!form.title.trim()}>
                {editingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
