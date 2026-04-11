'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArrowRightLeft,
  CircleCheck as CheckCircle,
  ChevronDown,
  Clock,
  CreditCard,
  Eye,
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
import { useAuth } from '@/lib/auth-context';
import { INVOICE_STATUSES, QUOTE_STATUSES, formatCurrency, formatDate } from '@/lib/constants';
import { LINE_TVA_RATES, computeTvaBreakdown, formatTvaRate } from '@/lib/tva';
import { getNextInvoiceNumber } from '@/lib/document-numbers';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { ImportCsvButton } from '@/components/shared/import-csv-button';
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
import { DocumentPreviewDialog } from '@/components/shared/document-preview-dialog';
import { BankAccountPicker } from '@/components/shared/bank-account-picker';
import { FirstBankAccountDialog } from '@/components/shared/first-bank-account-dialog';
import { QuoteBillingCard } from '@/components/devis/quote-billing-card';
import type { DepositInvoice } from '@/lib/invoices/deposits';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  invoice_type: 'standard' | 'acompte' | 'solde';
  deposit_percentage: number | null;
  clients: { name: string; email?: string | null } | null;
}

interface QuoteLine {
  id: string;
  description: string;
  detail?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tva_rate: number;
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
  tva_rate: number;
  created_at: string;
  valid_until: string | null;
  bank_account_id: string | null;
  client_id: string | null;
  project_id: string | null;
  clients: { name: string; email?: string | null } | null;
  /** Indique s'il existe au moins une facture liée (tous types confondus) */
  has_linked_invoice: boolean;
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
  // Utilisé quand on arrive sur /factures?billing=<quote_id> depuis une autre
  // page (devis, chantiers, etc.) : on ouvre la carte de facturation une fois
  // les devis chargés.
  const pendingBillingQuoteId = useRef<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<QuoteCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [quoteFilter, setQuoteFilter] = useState<QuoteInvoiceFilter>('to_invoice');
  const [quoteSort, setQuoteSort] = useState<QuoteSortKey>('recent');
  const [form, setForm] = useState({ title: '', clientName: '', totalHt: 0, tvaRate: 20 });
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string | null>(null);
  const [hasBankAccount, setHasBankAccount] = useState<boolean | null>(null);
  const [showFirstRibDialog, setShowFirstRibDialog] = useState(false);
  // Quote en attente lorsqu'on doit forcer l'ajout d'un RIB avant la conversion
  const [pendingQuoteForInvoice, setPendingQuoteForInvoice] = useState<QuoteCandidate | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState<Invoice | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  // Devis pour lequel on affiche le dialog "Facturation" (carte de facturation)
  const [billingQuote, setBillingQuote] = useState<QuoteCandidate | null>(null);
  // Loaded from profiles.document_config — controls the inline warning shown
  // in the create-invoice dialog when payment terms are disabled.
  const [paymentTermsOnInvoices, setPaymentTermsOnInvoices] = useState<boolean>(true);

  useEffect(() => {
    loadData();

    // Pré-remplissage depuis l'URL (venant d'un chantier, d'une fiche client ou du devis)
    const params = new URLSearchParams(window.location.search);
    const paramClientId = params.get('client_id');
    const paramProjectId = params.get('project_id');
    // ?billing=<quote_id> → ouvre directement le dialog de facturation pour ce devis
    const paramBilling = params.get('billing');

    if (paramBilling) {
      // On charge le devis dans le state "pending" pour qu'il soit ouvert une
      // fois que loadData() a fini (géré dans un effet séparé ci-dessous).
      pendingBillingQuoteId.current = paramBilling;
      router.replace('/factures', { scroll: false });
    } else if (paramClientId || paramProjectId) {
      if (paramProjectId) prefillProjectId.current = paramProjectId;
      if (paramClientId) {
        supabase.from('clients').select('name').eq('id', paramClientId).is('deleted_at', null).single().then(({ data }) => {
          if (data) setForm(prev => ({ ...prev, clientName: data.name }));
        });
      }
      setShowCreate(true);
      router.replace('/factures', { scroll: false });
    }
  }, []);

  // Une fois les devis chargés, si on arrive avec ?billing=<quote_id>, ouvre la facturation
  useEffect(() => {
    if (!pendingBillingQuoteId.current || quotes.length === 0) return;
    const quote = quotes.find((q) => q.id === pendingBillingQuoteId.current);
    pendingBillingQuoteId.current = null;
    if (!quote) return;

    if (quote.bank_account_id || hasBankAccount) {
      setBillingQuote(quote);
    } else {
      setPendingQuoteForInvoice(quote);
      setShowFirstRibDialog(true);
    }
  }, [quotes, hasBankAccount]);

  async function loadData() {
    setLoading(true);

    const [invoiceRes, quoteRes] = await Promise.all([
      supabase
        .from('invoices')
        .select('id, invoice_number, quote_id, recurring_contract_id, title, status, total_ht, total_ttc, due_date, paid_at, issued_at, is_archived, created_at, payment_method, invoice_type, deposit_percentage, clients(name, email, deleted_at)')
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
          tva_rate,
          created_at,
          valid_until,
          bank_account_id,
          client_id,
          project_id,
          clients(name, email, deleted_at),
          quote_lines(id, description, quantity, unit, unit_price, tva_rate, total, position),
          invoices(id)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ]);

    setInvoices((((invoiceRes.data as unknown as Array<Record<string, unknown>>) || [])).map((invoice) => {
      const clientValue = Array.isArray(invoice.clients) ? invoice.clients[0] : invoice.clients;
      return {
        ...invoice,
        invoice_type: (invoice.invoice_type as Invoice['invoice_type']) || 'standard',
        deposit_percentage:
          invoice.deposit_percentage === null || invoice.deposit_percentage === undefined
            ? null
            : Number(invoice.deposit_percentage),
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? {
              name: String((clientValue as { name?: string }).name || ''),
              email: (clientValue as { email?: string | null }).email || null,
            }
          : null,
      } as Invoice;
    }));

    const nextQuotes = (((quoteRes.data as unknown as Array<Record<string, unknown>>) || []).map((quote) => {
      const linkedInvoices = Array.isArray(quote.invoices) ? (quote.invoices as Array<Record<string, unknown>>) : [];
      const clientValue = Array.isArray(quote.clients) ? quote.clients[0] : quote.clients;

      return {
        id: String(quote.id),
        quote_number: String(quote.quote_number || ''),
        title: String(quote.title || ''),
        status: (quote.status as QuoteCandidate['status']) || 'brouillon',
        total_ht: Number(quote.total_ht || 0),
        total_ttc: Number(quote.total_ttc || 0),
        tva_rate: Number(quote.tva_rate ?? 20),
        created_at: String(quote.created_at || ''),
        valid_until: quote.valid_until ? String(quote.valid_until) : null,
        bank_account_id: quote.bank_account_id ? String(quote.bank_account_id) : null,
        client_id: quote.client_id ? String(quote.client_id) : null,
        project_id: quote.project_id ? String(quote.project_id) : null,
        clients: clientValue && typeof clientValue === 'object' && !(clientValue as { deleted_at?: string | null }).deleted_at
          ? { name: String((clientValue as { name?: string }).name || ''), email: (clientValue as { email?: string | null }).email || null }
          : null,
        has_linked_invoice: linkedInvoices.length > 0,
        quote_lines: Array.isArray(quote.quote_lines)
          ? (quote.quote_lines as QuoteLine[]).map((line) => ({
              ...line,
              quantity: Number(line.quantity || 0),
              unit_price: Number(line.unit_price || 0),
              tva_rate: Number(line.tva_rate ?? 20),
              total: Number(line.total || 0),
              position: Number(line.position || 0),
            }))
          : [],
      } satisfies QuoteCandidate;
    })) as QuoteCandidate[];

    setQuotes(nextQuotes);
    setLoading(false);

    // Vérifie la présence d'un RIB pour la modale de première facture.
    const { data: bankRows } = await supabase
      .from('bank_accounts')
      .select('id')
      .is('deleted_at', null)
      .limit(1);
    setHasBankAccount((bankRows?.length || 0) > 0);

    // Charge le flag "conditions de paiement sur les factures" depuis le profil
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('document_config')
        .eq('id', user.id)
        .maybeSingle();
      const config = (profile?.document_config || {}) as { payment_terms_on_invoices?: boolean };
      setPaymentTermsOnInvoices(config.payment_terms_on_invoices !== false);
    }
  }

  function handleOpenCreate() {
    if (hasBankAccount === false) {
      setShowFirstRibDialog(true);
      return;
    }
    setShowCreate(true);
  }

  function handleConvertQuote(quote: QuoteCandidate) {
    // Si le devis a déjà son propre RIB, on ouvre directement la carte de facturation
    if (quote.bank_account_id || hasBankAccount) {
      setBillingQuote(quote);
      return;
    }
    // Sinon, on force l'ajout d'un RIB avant la facturation
    setPendingQuoteForInvoice(quote);
    setShowFirstRibDialog(true);
  }

  async function createInvoice() {
    if (!user) return;

    let clientId: string | null = null;
    if (form.clientName.trim()) {
      const { data: existing } = await supabase.from('clients').select('id').eq('name', form.clientName.trim()).is('deleted_at', null).maybeSingle();
      if (existing) {
        clientId = existing.id;
      } else {
        const { data: newC } = await supabase.from('clients').insert({ name: form.clientName.trim(), user_id: user.id }).select('id').single();
        clientId = newC?.id || null;
      }
    }
    const invNumber = await getNextInvoiceNumber(supabase, user.id);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const tva = computeTvaBreakdown([
      { quantity: 1, unit_price: form.totalHt, tva_rate: form.tvaRate },
    ]);

    const { data: invoice } = await supabase.from('invoices').insert({
      user_id: user.id,
      invoice_number: invNumber,
      client_id: clientId,
      project_id: prefillProjectId.current || null,
      bank_account_id: selectedBankAccountId,
      title: form.title,
      total_ht: tva.total_ht,
      total_tva: tva.total_tva,
      total_ttc: tva.total_ttc,
      tva_rate: tva.primary_rate,
      tva_breakdown: tva.tva_breakdown,
      due_date: dueDate.toISOString().split('T')[0],
    }).select('id').single();

    // Crée une ligne unique pour que le PDF / la preview / la compta aient un breakdown cohérent
    if (invoice && form.totalHt > 0) {
      await supabase.from('invoice_lines').insert({
        user_id: user.id,
        invoice_id: invoice.id,
        description: form.title || 'Prestation',
        quantity: 1,
        unit: 'forfait',
        unit_price: form.totalHt,
        tva_rate: form.tvaRate,
        total: form.totalHt,
        position: 0,
      });
    }

    setShowCreate(false);
    setForm({ title: '', clientName: '', totalHt: 0, tvaRate: 20 });
    setSelectedBankAccountId(null);
    prefillProjectId.current = null;
    loadData();
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
        if (quoteFilter === 'to_invoice') return !quote.has_linked_invoice && quote.status !== 'refuse';
        return quote.has_linked_invoice;
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
  const quotesToInvoice = quotes.filter((quote) => !quote.has_linked_invoice && quote.status !== 'refuse');

  function handleInvoiceClick(inv: Invoice) {
    if (inv.quote_id) {
      const linkedQuote = quotes.find((q) => q.id === inv.quote_id);
      if (linkedQuote) {
        setBillingQuote(linkedQuote);
        return;
      }
    }
    setPreviewInvoiceId(inv.id);
  }

  function renderInvoiceRow(inv: Invoice, archived = false) {
    const st = INVOICE_STATUSES[inv.status] || INVOICE_STATUSES.brouillon;
    return (
      <tr
        key={inv.id}
        className={`transition-colors hover:bg-muted/20 cursor-pointer ${archived ? 'opacity-60' : ''}`}
        onClick={() => handleInvoiceClick(inv)}
      >
        <td className="px-4 py-3 text-sm font-medium text-foreground">
          <div className="flex items-center gap-1.5">
            {inv.invoice_number}
            {inv.invoice_type === 'acompte' && (
              <Badge className="bg-[#fff7f0] text-[#d35400] hover:bg-[#fff7f0] font-normal">
                Acompte{inv.deposit_percentage ? ` ${Number.isInteger(inv.deposit_percentage) ? inv.deposit_percentage : inv.deposit_percentage.toFixed(2).replace('.', ',')}%` : ''}
              </Badge>
            )}
            {inv.invoice_type === 'solde' && (
              <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 font-normal">
                Solde
              </Badge>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{inv.clients?.name || '-'}</td>
        <td className="px-4 py-3 text-sm text-foreground">{inv.title}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {inv.recurring_contract_id ? (
            <span className="inline-flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Contrat récurrent</span>
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
                onClick={(e) => { e.stopPropagation(); updateStatus(inv.id, 'creee'); }}
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
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPreviewInvoiceId(inv.id)}>
                <Eye className="mr-2 h-4 w-4" /> Visualiser
              </DropdownMenuItem>
              {inv.quote_id && (
                <DropdownMenuItem onClick={() => handleInvoiceClick(inv)}>
                  <Receipt className="mr-2 h-4 w-4" /> Suivi facturation
                </DropdownMenuItem>
              )}
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
      <div
        key={inv.id}
        className={`rounded-xl border border-border bg-card p-4 space-y-3 cursor-pointer transition-colors hover:bg-muted/10 ${archived ? 'opacity-60' : ''}`}
        onClick={() => handleInvoiceClick(inv)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{inv.title}</p>
            <p className="text-xs text-muted-foreground">{inv.clients?.name || '-'}</p>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setPreviewInvoiceId(inv.id)}>
                  <Eye className="mr-2 h-4 w-4" /> Visualiser
                </DropdownMenuItem>
                {inv.quote_id && (
                  <DropdownMenuItem onClick={() => handleInvoiceClick(inv)}>
                    <Receipt className="mr-2 h-4 w-4" /> Suivi facturation
                  </DropdownMenuItem>
                )}
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{inv.invoice_number}</span>
          {inv.invoice_type === 'acompte' && (
            <Badge className="bg-[#fff7f0] text-[#d35400] hover:bg-[#fff7f0] font-normal">
              Acompte{inv.deposit_percentage ? ` ${Number.isInteger(inv.deposit_percentage) ? inv.deposit_percentage : inv.deposit_percentage.toFixed(2).replace('.', ',')}%` : ''}
            </Badge>
          )}
          {inv.invoice_type === 'solde' && (
            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 font-normal">
              Solde
            </Badge>
          )}
          <StatusBadge label={st.label} color={st.color} />
          {inv.status === 'brouillon' && !archived && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-violet-300 text-violet-700 hover:bg-violet-50 text-xs"
              onClick={(e) => { e.stopPropagation(); updateStatus(inv.id, 'creee'); }}
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
    <div className="space-y-6">
      <PageHeader title="Factures" description="Transformez vos devis en factures et suivez les paiements">
        <ImportCsvButton type="invoices" onImported={loadData} />
        <Button onClick={handleOpenCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle facture
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle className="h-4 w-4 text-emerald-500" /> Encaissé</div>
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowRightLeft className="h-4 w-4 text-[#d35400]" /> Devis à facturer</div>
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
                À facturer
              </Button>
              <Button variant={quoteFilter === 'already_invoiced' ? 'default' : 'outline'} size="sm" onClick={() => setQuoteFilter('already_invoiced')}>
                Déjà facturés
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher un devis ou une facture…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <select
              value={quoteSort}
              onChange={(e) => setQuoteSort(e.target.value as QuoteSortKey)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="recent">Plus récents</option>
              <option value="oldest">Plus anciens</option>
              <option value="amount_desc">Montant décroissant</option>
              <option value="amount_asc">Montant croissant</option>
              <option value="client">Client A-Z</option>
            </select>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              [1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)
            ) : visibleQuotes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                Aucun devis ne correspond à ce filtre.
              </div>
            ) : (
              visibleQuotes.map((quote) => {
                const quoteStatus = QUOTE_STATUSES[quote.status] || QUOTE_STATUSES.brouillon;
                const alreadyHasInvoices = quote.has_linked_invoice;

                return (
                  <div key={quote.id} className="rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{quote.title}</p>
                          <Badge variant="outline">{quote.quote_number}</Badge>
                          <StatusBadge label={quoteStatus.label} color={quoteStatus.color} />
                          {alreadyHasInvoices ? (
                            <Badge className="bg-[#fff7f0] text-[#d35400] hover:bg-[#fff7f0]">En facturation</Badge>
                          ) : (
                            <Badge className="bg-[#fff1e8] text-[#a34700] hover:bg-[#fff1e8]">À facturer</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {quote.clients?.name || 'Sans client'} • {formatCurrency(quote.total_ttc)} • Créé le {formatDate(quote.created_at)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {alreadyHasInvoices
                            ? 'Ouvrez la facturation pour émettre un nouvel acompte ou la facture de solde.'
                            : 'Prêt à être facturé : acompte, facture de solde ou facture totale.'}
                        </p>
                      </div>

                      <div className="flex flex-col items-stretch gap-2 sm:min-w-[180px]">
                        <Button onClick={() => handleConvertQuote(quote)} className="gap-2">
                          <Receipt className="h-4 w-4" />
                          {alreadyHasInvoices ? 'Ouvrir la facturation' : 'Facturer'}
                        </Button>
                        {quote.valid_until && (
                          <p className="text-center text-xs text-muted-foreground">Validité jusqu&apos;au {formatDate(quote.valid_until)}</p>
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
              <p className="text-sm font-semibold text-foreground">Factures émises</p>
              <p className="text-sm text-muted-foreground">Suivez les paiements et reprenez le fil de vos devis convertis.</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : filteredInvoices.length === 0 ? (
            <EmptyState icon={Receipt} title="Aucune facture" description="Créez votre première facture ou convertissez un devis.">
              <Button onClick={handleOpenCreate} className="gap-2"><Plus className="h-4 w-4" /> Créer une facture</Button>
            </EmptyState>
          ) : (
            <>
              <div className="hidden sm:block rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Numéro</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Titre</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Origine</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Statut</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Dates</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Échéance</th>
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
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Numéro</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Client</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Titre</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Origine</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Statut</th>
                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Montant</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Dates</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Échéance</th>
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

      {/* Dialog "Facturation" : carte de facturation (acompte / solde / total) */}
      <Dialog
        open={billingQuote !== null}
        onOpenChange={(open) => {
          if (!open) setBillingQuote(null);
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Facturation</DialogTitle>
          </DialogHeader>
          {billingQuote && (
            <QuoteBillingCard
              quote={billingQuote}
              onBillingChanged={loadData}
              onSendInvoice={(inv: DepositInvoice) => {
                // Reconstruit un objet compatible avec SendInvoiceDialog
                setSendingInvoice({
                  id: inv.id,
                  invoice_number: inv.invoice_number,
                  title: billingQuote.title,
                  total_ttc: Number(inv.total_ttc),
                  status: inv.status,
                  clients: billingQuote.clients
                    ? { name: billingQuote.clients.name, email: (billingQuote.clients as { name: string; email?: string | null }).email || null }
                    : null,
                } as Invoice);
                setBillingQuote(null);
              }}
              onPreviewInvoice={(inv: DepositInvoice) => {
                setPreviewInvoiceId(inv.id);
                setBillingQuote(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {sendingInvoice && (
        <SendInvoiceDialog
          invoice={sendingInvoice}
          onClose={() => setSendingInvoice(null)}
          onSent={() => loadData()}
        />
      )}

      <DocumentPreviewDialog
        mode="invoice"
        open={!!previewInvoiceId}
        onClose={() => setPreviewInvoiceId(null)}
        documentId={previewInvoiceId}
      />

      <FirstBankAccountDialog
        open={showFirstRibDialog}
        onOpenChange={(open) => {
          setShowFirstRibDialog(open);
          if (!open) setPendingQuoteForInvoice(null);
        }}
        context="facture"
        onSaved={(account) => {
          setHasBankAccount(true);
          setShowFirstRibDialog(false);
          // Si on était en train de facturer un devis, on ouvre directement la carte
          // de facturation avec ce RIB fraîchement créé.
          if (pendingQuoteForInvoice) {
            const quoteWithBank = { ...pendingQuoteForInvoice, bank_account_id: account.id };
            setPendingQuoteForInvoice(null);
            setBillingQuote(quoteWithBank);
            return;
          }
          // Sinon on ouvre le formulaire de facture manuelle avec ce RIB sélectionné
          setSelectedBankAccountId(account.id);
          setShowCreate(true);
        }}
      />

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle facture</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            {!paymentTermsOnInvoices && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-red-700 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-red-900">
                    Vos conditions de paiement sont désactivées
                  </p>
                  <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
                    Elles sont obligatoires sur une facture en France. Activez-les
                    avant d&apos;émettre cette facture pour rester conforme.
                  </p>
                  <Link
                    href="/parametres?tab=documents"
                    className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-red-900 underline hover:text-red-700"
                  >
                    Activer dans les paramètres
                  </Link>
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Titre</label>
              <Input className="mt-1" placeholder="Ex: Travaux salle de bain" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Client</label>
              <Input className="mt-1" placeholder="Nom du client" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Montant HT</label>
                <Input className="mt-1" type="number" placeholder="0" value={form.totalHt || ''} onChange={e => setForm({ ...form, totalHt: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-sm font-medium">Taux de TVA</label>
                <Select value={String(form.tvaRate)} onValueChange={v => setForm({ ...form, tvaRate: Number(v) })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_TVA_RATES.map(r => (
                      <SelectItem key={r} value={String(r)}>TVA {formatTvaRate(r)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <BankAccountPicker
              value={selectedBankAccountId}
              onChange={setSelectedBankAccountId}
            />
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm flex items-center justify-between">
              <div className="text-muted-foreground">
                <p>Total HT : <span className="font-medium text-foreground">{formatCurrency(form.totalHt || 0)}</span></p>
                <p className="text-xs mt-0.5">TVA {formatTvaRate(form.tvaRate)} : {formatCurrency((form.totalHt || 0) * form.tvaRate / 100)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">TTC</p>
                <p className="text-lg font-semibold">{formatCurrency((form.totalHt || 0) * (1 + form.tvaRate / 100))}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Astuce : pour facturer avec plusieurs taux de TVA, créez d&apos;abord un devis détaillé puis convertissez-le en facture.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={createInvoice} disabled={!form.title.trim()}>Créer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
