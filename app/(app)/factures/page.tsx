'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArrowRightLeft,
  CircleCheck as CheckCircle,
  ChevronDown,
  Clock,
  CreditCard,
  FileCheck,
  MoveHorizontal as MoreHorizontal,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Send,
  TriangleAlert as AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ProfileGate } from '@/components/shared/profile-gate';
import { useAuth } from '@/lib/auth-context';
import { INVOICE_STATUSES, QUOTE_STATUSES, formatCurrency, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SendInvoiceDialog } from '@/components/factures/send-invoice-dialog';

interface Invoice {
  id: string;
  invoice_number: string;
  quote_id: string | null;
  recurring_contract_id: string | null;
  title: string;
  status: keyof typeof INVOICE_STATUSES;
  total_ttc: number;
  total_ht: number;
  due_date: string | null;
  paid_at: string | null;
  issued_at: string | null;
  is_archived: boolean;
  created_at: string;
  payment_method: string;
  clients: { name: string; email?: string | null } | null;
}

interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  position: number;
}

interface QuoteCandidate {
  id: string;
  quote_number: string;
  title: string;
  status: keyof typeof QUOTE_STATUSES;
  total_ht: number;
  total_ttc: number;
  created_at: string;
  valid_until: string | null;
  clients: { name: string } | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_status: keyof typeof INVOICE_STATUSES | null;
  quote_lines: QuoteLine[];
}

type QuoteInvoiceFilter = 'to_invoice' | 'already_invoiced';
type QuoteSortKey = 'recent' | 'oldest' | 'amount_desc' | 'amount_asc' | 'client';

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function FacturesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const prefillProjectId = useRef<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<QuoteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creatingFromQuoteId, setCreatingFromQuoteId] = useState<string | null>(null);
  const [quoteFilter, setQuoteFilter] = useState<QuoteInvoiceFilter>('to_invoice');
  const [quoteSort, setQuoteSort] = useState<QuoteSortKey>('recent');
  const [form, setForm] = useState({ title: '', clientName: '', totalHt: 0 });
  const [showArchived, setShowArchived] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadData();

    // Pré-remplissage depuis l'URL (venant d'un chantier ou d'une fiche client)
    const params = new URLSearchParams(window.location.search);
    const paramClientId = params.get('client_id');
    const paramProjectId = params.get('project_id');

    if (paramClientId || paramProjectId) {
      if (paramProjectId) prefillProjectId.current = paramProjectId;
      if (paramClientId) {
        supabase.from('clients').select('name').eq('id', paramClientId).single().then(({ data }) => {
          if (data) setForm(prev => ({ ...prev, clientName: data.name }));
        });
      }
      setShowCreate(true);
      router.replace('/factures', { scroll: false });
    }
  }, []);

  async function loadData() {
    setLoading(true);

    const [invoiceRes, quoteRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, quote_id, recurring_contract_id, title, status, total_ht, total_ttc, due_date, paid_at, issued_at, is_archived, created_at, payment_method, clients(name, email)')
        .order('created_at', { ascending: false }),
      supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          title,
          status,
          total_ht,
          total_ttc,
          created_at,
          valid_until,
          clients(name),
          quote_lines(id, description, quantity, unit, unit_price, total, position),
          invoices(id, invoice_number, status)
        `)
        .order('created_at', { ascending: false }),
    ]);

    setInvoices((invoiceRes.data as unknown as Invoice[]) || []);

    const nextQuotes = (((quoteRes.data as unknown as Array<Record<string, unknown>>) || []).map((quote) => {
      const linkedInvoices = Array.isArray(quote.invoices) ? (quote.invoices as Array<Record<string, unknown>>) : [];
      const latestInvoice = linkedInvoices[0] || null;

      return {
        id: String(quote.id),
        quote_number: String(quote.quote_number || ''),
        title: String(quote.title || ''),
        status: (quote.status as QuoteCandidate['status']) || 'brouillon',
        total_ht: Number(quote.total_ht || 0),
        total_ttc: Number(quote.total_ttc || 0),
        created_at: String(quote.created_at || ''),
        valid_until: quote.valid_until ? String(quote.valid_until) : null,
        clients: (quote.clients as { name: string } | null) || null,
        invoice_id: latestInvoice?.id ? String(latestInvoice.id) : null,
        invoice_number: latestInvoice?.invoice_number ? String(latestInvoice.invoice_number) : null,
        invoice_status: (latestInvoice?.status as QuoteCandidate['invoice_status']) || null,
        quote_lines: Array.isArray(quote.quote_lines)
          ? (quote.quote_lines as QuoteLine[]).map((line) => ({
              ...line,
              quantity: Number(line.quantity || 0),
              unit_price: Number(line.unit_price || 0),
              total: Number(line.total || 0),
              position: Number(line.position || 0),
            }))
          : [],
      } satisfies QuoteCandidate;
    })) as QuoteCandidate[];

    setQuotes(nextQuotes);
    setLoading(false);
  }

  async function createInvoice() {
    if (!user) return;

    let clientId: string | null = null;
    if (form.clientName.trim()) {
      const { data: existing } = await supabase.from('clients').select('id').eq('name', form.clientName.trim()).maybeSingle();
      if (existing) {
        clientId = existing.id;
      } else {
        const { data: newC } = await supabase.from('clients').insert({ name: form.clientName.trim(), user_id: user.id }).select('id').single();
        clientId = newC?.id || null;
      }
    }
    const now = new Date();
    const invNumber = `F-${now.getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    await supabase.from('invoices').insert({
      user_id: user.id,
      invoice_number: invNumber,
      client_id: clientId,
      project_id: prefillProjectId.current || null,
      title: form.title,
      total_ht: form.totalHt,
      total_ttc: form.totalHt * 1.2,
      due_date: dueDate.toISOString().split('T')[0],
    });

    setShowCreate(false);
    setForm({ title: '', clientName: '', totalHt: 0 });
    prefillProjectId.current = null;
    loadData();
  }

  async function createInvoiceFromQuote(quote: QuoteCandidate) {
    if (quote.invoice_id) return;
    if (!user) return;

    setCreatingFromQuoteId(quote.id);

    try {
      const now = new Date();
      const invNumber = `F-${now.getFullYear()}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: client } = quote.clients?.name
        ? await supabase.from('clients').select('id').eq('name', quote.clients.name).maybeSingle()
        : { data: null };

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user.id,
          invoice_number: invNumber,
          quote_id: quote.id,
          client_id: client?.id || null,
          title: quote.title || `Facture ${quote.quote_number}`,
          total_ht: quote.total_ht,
          total_ttc: quote.total_ttc,
          due_date: dueDate.toISOString().split('T')[0],
        })
        .select('id')
        .single();

      if (invoiceError || !invoice) {
        throw invoiceError || new Error('Impossible de creer la facture.');
      }

      if (quote.quote_lines.length > 0) {
        const { error: linesError } = await supabase.from('invoice_lines').insert(
          quote.quote_lines.map((line, index) => ({
            user_id: user.id,
            invoice_id: invoice.id,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unit_price: line.unit_price,
            total: line.total || line.quantity * line.unit_price,
            position: typeof line.position === 'number' ? line.position : index,
          }))
        );

        if (linesError) {
          throw linesError;
        }
      }

      // Passer le devis en "Accepté" automatiquement
      await supabase
        .from('quotes')
        .update({ status: 'accepte', updated_at: new Date().toISOString() })
        .eq('id', quote.id);

      // Créer le chantier associé automatiquement
      const { data: newProject } = await supabase.from('projects').insert({
        user_id: user.id,
        quote_id: quote.id,
        client_id: client?.id || null,
        name: quote.title,
        budget: quote.total_ht,
        status: 'a_planifier',
      }).select('id').single();

      // Lier le devis au chantier
      if (newProject?.id) {
        await supabase.from('quotes').update({ project_id: newProject.id }).eq('id', quote.id);
      }

      await loadData();
    } finally {
      setCreatingFromQuoteId(null);
    }
  }

  async function updateStatus(id: string, status: string) {
    const updates: Record<string, string> = { status, updated_at: new Date().toISOString() };
    if (status === 'payee') updates.paid_at = new Date().toISOString();
    // Horodatage d'émission officielle : settée lors de la création officielle de la facture
    if (status === 'creee') {
      const inv = invoices.find(i => i.id === id);
      if (inv && !inv.issued_at) {
        updates.issued_at = new Date().toISOString();
      }
    }
    // Fallback : si on passe directement en envoyée sans passer par créée
    if (status === 'envoyee') {
      const inv = invoices.find(i => i.id === id);
      if (inv && !inv.issued_at) {
        updates.issued_at = new Date().toISOString();
      }
    }
    await supabase.from('invoices').update(updates).eq('id', id);
    loadData();
  }

  async function archiveInvoice(id: string) {
    await supabase.from('invoices').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id);
    loadData();
  }

  async function unarchiveInvoice(id: string) {
    await supabase.from('invoices').update({ is_archived: false, updated_at: new Date().toISOString() }).eq('id', id);
    loadData();
  }

  const activeInvoices = invoices.filter(inv => !inv.is_archived);
  const archivedInvoices = invoices.filter(inv => inv.is_archived);

  const filteredInvoices = activeInvoices.filter((inv) =>
    inv.title.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredArchived = archivedInvoices.filter((inv) =>
    inv.title.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    inv.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const quoteSearchTerm = search.toLowerCase();

  const visibleQuotes = useMemo(() => {
    const next = quotes
      .filter((quote) => {
        const matchesSearch =
          quote.title.toLowerCase().includes(quoteSearchTerm) ||
          quote.quote_number.toLowerCase().includes(quoteSearchTerm) ||
          quote.clients?.name?.toLowerCase().includes(quoteSearchTerm);

        if (!matchesSearch) return false;
        if (quoteFilter === 'to_invoice') return !quote.invoice_id;
        return Boolean(quote.invoice_id);
      })
      .sort((a, b) => {
        switch (quoteSort) {
          case 'oldest':
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          case 'amount_desc':
            return b.total_ttc - a.total_ttc;
          case 'amount_asc':
            return a.total_ttc - b.total_ttc;
          case 'client':
            return (a.clients?.name || '').localeCompare(b.clients?.name || '', 'fr');
          case 'recent':
          default:
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
      });

    return next;
  }, [quotes, quoteFilter, quoteSearchTerm, quoteSort]);

  const totalUnpaid = activeInvoices.filter(i => i.status === 'envoyee' || i.status === 'en_retard').reduce((s, i) => s + i.total_ttc, 0);
  const totalPaid = activeInvoices.filter(i => i.status === 'payee').reduce((s, i) => s + i.total_ttc, 0);
  const totalLate = activeInvoices.filter(i => i.status === 'en_retard').reduce((s, i) => s + i.total_ttc, 0);
  const quotesToInvoice = quotes.filter((quote) => !quote.invoice_id);

  function renderInvoiceRow(inv: Invoice, archived = false) {
    const st = INVOICE_STATUSES[inv.status] || INVOICE_STATUSES.brouillon;
    return (
      <tr key={inv.id} className={`transition-colors hover:bg-muted/20 ${archived ? 'opacity-60' : ''}`}>
        <td className="px-4 py-3 text-sm font-medium text-foreground">{inv.invoice_number}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{inv.clients?.name || '-'}</td>
        <td className="px-4 py-3 text-sm text-foreground">{inv.title}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {inv.recurring_contract_id ? (
            <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Contrat recurrent</span>
          ) : inv.quote_id ? 'Depuis un devis' : 'Facture manuelle'}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusBadge label={st.label} color={st.color} />
            {inv.status === 'brouillon' && !archived && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-violet-300 text-violet-700 hover:bg-violet-50 text-xs"
                onClick={() => updateStatus(inv.id, 'creee')}
              >
                <FileCheck className="h-3 w-3" /> Créer
              </Button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm font-medium text-foreground text-right">{formatCurrency(inv.total_ttc)}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          <span title="Date de création">{formatDateTime(inv.created_at)}</span>
          {inv.issued_at && (
            <span className="block text-violet-600" title="Date de création officielle">
              Créée le {formatDateTime(inv.issued_at)}
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : '-'}</td>
        <td className="px-4 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!archived && (
                <>
                  {inv.status === 'brouillon' && (
                    <DropdownMenuItem onClick={() => updateStatus(inv.id, 'creee')}>
                      <FileCheck className="mr-2 h-4 w-4" /> Créer la facture
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setSendingInvoice(inv)}>
                    <Send className="mr-2 h-4 w-4" /> Envoyer au client
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => updateStatus(inv.id, 'envoyee')}>Marquer envoyée</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateStatus(inv.id, 'payee')}>Marquer payée</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateStatus(inv.id, 'en_retard')}>Marquer en retard</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => archiveInvoice(inv.id)} className="text-muted-foreground">
                    <Archive className="mr-2 h-4 w-4" /> Archiver
                  </DropdownMenuItem>
                </>
              )}
              {archived && (
                <DropdownMenuItem onClick={() => unarchiveInvoice(inv.id)}>
                  Désarchiver
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  }

  function renderInvoiceCard(inv: Invoice, archived = false) {
    const st = INVOICE_STATUSES[inv.status] || INVOICE_STATUSES.brouillon;
    return (
      <div key={inv.id} className={`rounded-xl border border-border bg-card p-4 space-y-3 ${archived ? 'opacity-60' : ''}`}>
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
              {!archived && (
                <>
                  {inv.status === 'brouillon' && (
                    <DropdownMenuItem onClick={() => updateStatus(inv.id, 'creee')}>
                      <FileCheck className="mr-2 h-4 w-4" /> Créer la facture
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => setSendingInvoice(inv)}>
                    <Send className="mr-2 h-4 w-4" /> Envoyer au client
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => updateStatus(inv.id, 'envoyee')}>Marquer envoyée</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateStatus(inv.id, 'payee')}>Marquer payée</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateStatus(inv.id, 'en_retard')}>Marquer en retard</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => archiveInvoice(inv.id)} className="text-muted-foreground">
                    <Archive className="mr-2 h-4 w-4" /> Archiver
                  </DropdownMenuItem>
                </>
              )}
              {archived && (
                <DropdownMenuItem onClick={() => unarchiveInvoice(inv.id)}>Désarchiver</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{inv.invoice_number}</span>
          <StatusBadge label={st.label} color={st.color} />
          {inv.status === 'brouillon' && !archived && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-violet-300 text-violet-700 hover:bg-violet-50 text-xs"
              onClick={() => updateStatus(inv.id, 'creee')}
            >
              <FileCheck className="h-3 w-3" /> Créer la facture
            </Button>
          )}
          {inv.recurring_contract_id && (
            <Badge variant="outline" className="gap-1"><RefreshCw className="h-3 w-3" /> Contrat</Badge>
          )}
          {inv.quote_id && !inv.recurring_contract_id && <Badge variant="outline">Depuis devis</Badge>}
          {inv.payment_method === 'stripe' && (
            <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-50">
              <CreditCard className="mr-1 h-3 w-3" /> Stripe
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{formatCurrency(inv.total_ttc)}</p>
          <p className="text-xs text-muted-foreground">{inv.due_date ? formatDate(inv.due_date) : '-'}</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Ajoutée le {formatDateTime(inv.created_at)}
          {inv.issued_at && (
            <span className="block text-violet-600">Créée officiellement le {formatDateTime(inv.issued_at)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <ProfileGate>
    <div className="space-y-6">
      <PageHeader title="Factures" description="Transformez vos devis en factures et suivez les paiements">
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle facture
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(totalLate)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowRightLeft className="h-4 w-4 text-[#d35400]" /> Devis a facturer</div>
          <p className="mt-1 text-xl font-semibold text-foreground">{quotesToInvoice.length}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.4fr]">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Devis convertibles</p>
              <p className="text-sm text-muted-foreground">
                Tous les devis sont visibles ici. Triez-les et transformez-les en facture en un clic.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant={quoteFilter === 'to_invoice' ? 'default' : 'outline'} size="sm" onClick={() => setQuoteFilter('to_invoice')}>
                A facturer
              </Button>
              <Button variant={quoteFilter === 'already_invoiced' ? 'default' : 'outline'} size="sm" onClick={() => setQuoteFilter('already_invoiced')}>
                Deja factures
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher un devis ou une facture..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <select
              value={quoteSort}
              onChange={(e) => setQuoteSort(e.target.value as QuoteSortKey)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="recent">Plus recents</option>
              <option value="oldest">Plus anciens</option>
              <option value="amount_desc">Montant decroissant</option>
              <option value="amount_asc">Montant croissant</option>
              <option value="client">Client A-Z</option>
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)
            ) : visibleQuotes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                Aucun devis ne correspond a ce filtre.
              </div>
            ) : (
              visibleQuotes.map((quote) => {
                const quoteStatus = QUOTE_STATUSES[quote.status] || QUOTE_STATUSES.brouillon;
                const invoiceStatus = quote.invoice_status ? INVOICE_STATUSES[quote.invoice_status] : null;
                const canCreateInvoice = !quote.invoice_id;

                return (
                  <div key={quote.id} className="rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{quote.title}</p>
                          <Badge variant="outline">{quote.quote_number}</Badge>
                          <StatusBadge label={quoteStatus.label} color={quoteStatus.color} />
                          {invoiceStatus ? (
                            <StatusBadge label={`Facture ${invoiceStatus.label.toLowerCase()}`} color={invoiceStatus.color} />
                          ) : (
                            <Badge className="bg-[#fff1e8] text-[#a34700] hover:bg-[#fff1e8]">A facturer</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {quote.clients?.name || 'Sans client'} • {formatCurrency(quote.total_ttc)} • Cree le {formatDate(quote.created_at)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {quote.invoice_number ? `Lie a ${quote.invoice_number}` : 'Pret a etre transforme en facture en reprenant les lignes du devis.'}
                        </p>
                      </div>

                      <div className="flex flex-col items-stretch gap-2 sm:min-w-[180px]">
                        <Button
                          onClick={() => createInvoiceFromQuote(quote)}
                          disabled={!canCreateInvoice || creatingFromQuoteId === quote.id}
                          className="gap-2"
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                          {quote.invoice_id
                            ? 'Deja facture'
                            : creatingFromQuoteId === quote.id
                              ? 'Conversion...'
                              : 'Transformer en facture'}
                        </Button>
                        {quote.valid_until && (
                          <p className="text-center text-xs text-muted-foreground">Validite jusqu&apos;au {formatDate(quote.valid_until)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Factures emises</p>
              <p className="text-sm text-muted-foreground">Suivez les paiements et reprenez le fil de vos devis convertis.</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : filteredInvoices.length === 0 ? (
            <EmptyState icon={Receipt} title="Aucune facture" description="Creez votre premiere facture ou convertissez un devis.">
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
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Origine</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Statut</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Dates</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Echeance</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredInvoices.map(inv => renderInvoiceRow(inv, false))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="sm:hidden space-y-3">
                {filteredInvoices.map(inv => renderInvoiceCard(inv, false))}
              </div>
            </>
          )}

          {/* Factures archivées */}
          {(archivedInvoices.length > 0 || (!loading && filteredArchived.length === 0 && archivedInvoices.length > 0)) && (
            <div className="mt-6">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground hover:bg-muted/40 transition-colors"
              >
                <Archive className="h-4 w-4" />
                <span className="font-medium">Factures archivées ({archivedInvoices.length})</span>
                <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${showArchived ? 'rotate-180' : ''}`} />
              </button>

              {showArchived && (
                <div className="mt-3">
                  <p className="mb-3 text-xs text-muted-foreground">
                    Les factures archivées sont conservées conformément aux obligations légales (art. L. 102 B LPF — 6 ans minimum). Elles ne peuvent pas être supprimées.
                  </p>

                  {filteredArchived.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune facture archivée ne correspond à la recherche.</p>
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
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Origine</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Statut</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Dates</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Echeance</th>
                                <th className="px-4 py-3 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {filteredArchived.map(inv => renderInvoiceRow(inv, true))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="sm:hidden space-y-3">
                        {filteredArchived.map(inv => renderInvoiceCard(inv, true))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {sendingInvoice && (
        <SendInvoiceDialog
          invoice={sendingInvoice}
          onClose={() => setSendingInvoice(null)}
          onSent={() => loadData()}
        />
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
    </ProfileGate>
  );
}
