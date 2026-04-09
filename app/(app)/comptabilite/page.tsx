'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Receipt,
  TrendingDown,
  TrendingUp,
  Trash2,
  Pencil,
  Mail,
  Copy,
  Link as LinkIcon,
  ShieldOff,
  Calendar,
  Clock,
  Eye,
  ExternalLink,
  RefreshCw,
  Sparkles,
  BarChart3,
  Calculator,
  Camera,
  Bot,
  FileText,
  FileCheck2,
  FileX2,
  Download,
  Filter,
  ArrowLeftRight,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  MailCheck,
  MailX,
  Landmark,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ExpenseOcrDropzone } from '@/components/comptabilite/expense-ocr-dropzone';
import {
  ExpenseFormDialog,
  type ExpenseFormValues,
} from '@/components/comptabilite/expense-form-dialog';
import { TvaPanel } from '@/components/comptabilite/tva-panel';
import {
  AccountantInviteDialog,
  type AccountantInviteValues,
} from '@/components/comptabilite/accountant-invite-dialog';
import { BankReconciliationTab } from '@/components/comptabilite/bank-reconciliation-tab';

interface ExpenseRow {
  id: string;
  date: string;
  description: string;
  supplier: string;
  amount_ht: number | null;
  tva_rate: number | null;
  tva_amount: number | null;
  amount: number | null;
  expense_category_id: string | null;
  payment_method: string | null;
  is_autoliquidation: boolean | null;
  project_id: string | null;
  source: string | null;
  ocr_confidence: number | null;
  receipt_storage_path: string | null;
  bank_transaction_id: string | null;
}

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
}

interface ProjectRow {
  id: string;
  name: string;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  total_ht: number | null;
  total_ttc: number | null;
  tva_rate: number | null;
  tva_breakdown: unknown;
  paid_at: string | null;
  issued_at: string | null;
  due_date: string | null;
  created_at: string;
  clients: { name: string } | { name: string }[] | null;
  bank_transaction_id: string | null;
  invoice_type?: string | null;
  quote_id?: string | null;
}

interface AccessRow {
  id: string;
  accountant_email: string;
  accountant_name: string | null;
  token: string;
  scope: string;
  scope_year: number | null;
  scope_start: string | null;
  scope_end: string | null;
  expires_at: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manuel',
  ocr: 'OCR IA',
  recurring: 'Récurrent',
};

const PIE_COLORS = ['#D35400', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4', '#84CC16', '#EF4444', '#6366F1', '#14B8A6', '#F97316', '#64748B'];

type FluxStatusKey =
  | 'draft'
  | 'upcoming'
  | 'late'
  | 'paid'
  | 'justified'
  | 'missing';

const FLUX_STATUS_LABELS: Record<FluxStatusKey, { label: string; color: string }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  upcoming: { label: 'À venir', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  late: { label: 'En retard', color: 'bg-red-100 text-red-800 border-red-200' },
  paid: { label: 'Payée', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  justified: { label: 'Justifiée', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  missing: { label: 'Justificatif manquant', color: 'bg-red-100 text-red-800 border-red-200' },
};

function fmtEur(n: number | null | undefined) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtRelative(d: string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `il y a ${diffD} j`;
  if (diffD < 30) return `il y a ${Math.round(diffD / 7)} sem.`;
  if (diffD < 365) return `il y a ${Math.round(diffD / 30)} mois`;
  return `il y a ${Math.round(diffD / 365)} an${diffD >= 730 ? 's' : ''}`;
}

function getClientName(c: InvoiceRow['clients']): string {
  if (!c) return '—';
  if (Array.isArray(c)) return c[0]?.name || '—';
  return c.name || '—';
}

// ───────────────── Period helpers (Dashboard) ─────────────────

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quarterOfMonth(month0: number): number {
  return Math.floor(month0 / 3) + 1;
}

interface PeriodOption {
  value: string;
  label: string;
}

function buildDashboardPeriodOptions(): {
  current: PeriodOption[];
  months: PeriodOption[];
  quarters: PeriodOption[];
  years: PeriodOption[];
} {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const currentMonthKey = ymKey(now);
  const prevMonth = new Date(y, m - 1, 1);
  const currentQuarter = quarterOfMonth(m);
  const prevQuarterMonth = new Date(y, (currentQuarter - 1) * 3 - 3, 1);
  const prevQuarterYear = prevQuarterMonth.getFullYear();
  const prevQuarter = quarterOfMonth(prevQuarterMonth.getMonth());

  const current: PeriodOption[] = [
    { value: `month:${currentMonthKey}`, label: 'Mois en cours' },
    { value: `month:${ymKey(prevMonth)}`, label: 'Mois précédent' },
    { value: `quarter:${y}:${currentQuarter}`, label: 'Trimestre en cours' },
    { value: `quarter:${prevQuarterYear}:${prevQuarter}`, label: 'Trimestre précédent' },
    { value: `year:${y}`, label: 'Année en cours' },
    { value: `year:${y - 1}`, label: 'Année précédente' },
  ];

  // Évite les collisions de value entre les groupes — Radix Select rendrait
  // les deux SelectItem qui partagent la même value côte à côte dans le trigger.
  const usedValues = new Set(current.map((p) => p.value));

  const months: PeriodOption[] = [];
  for (let i = 0; i < 12; i += 1) {
    const d = new Date(y, m - i, 1);
    const value = `month:${ymKey(d)}`;
    if (usedValues.has(value)) continue;
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    months.push({
      value,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    });
    usedValues.add(value);
  }

  const quarters: PeriodOption[] = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(y, m - i * 3, 1);
    const qy = d.getFullYear();
    const q = quarterOfMonth(d.getMonth());
    const value = `quarter:${qy}:${q}`;
    if (usedValues.has(value)) continue;
    quarters.push({ value, label: `T${q} ${qy}` });
    usedValues.add(value);
  }

  const years: PeriodOption[] = [];
  for (let i = 0; i < 4; i += 1) {
    const value = `year:${y - i}`;
    if (usedValues.has(value)) continue;
    years.push({ value, label: `Année ${y - i}` });
    usedValues.add(value);
  }

  return { current, months, quarters, years };
}

function isInPeriod(dateStr: string | null | undefined, period: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (period.startsWith('year:')) {
    return d.getFullYear() === Number(period.split(':')[1]);
  }
  if (period.startsWith('quarter:')) {
    const [, y, q] = period.split(':');
    if (d.getFullYear() !== Number(y)) return false;
    return quarterOfMonth(d.getMonth()) === Number(q);
  }
  if (period.startsWith('month:')) {
    return ymKey(d) === period.split(':')[1];
  }
  return false;
}

function getPeriodLabel(period: string): string {
  if (period.startsWith('year:')) return `Année ${period.split(':')[1]}`;
  if (period.startsWith('quarter:')) {
    const [, y, q] = period.split(':');
    return `T${q} ${y}`;
  }
  if (period.startsWith('month:')) {
    const [, ym] = period.split(':');
    const [yy, mm] = ym.split('-').map(Number);
    const d = new Date(yy, mm - 1, 1);
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  return '';
}

export default function ComptabilitePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  // Data
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [accesses, setAccesses] = useState<AccessRow[]>([]);
  const [vatRegime, setVatRegime] = useState<string | null>(null);
  const [tvaMethod, setTvaMethod] = useState<'encaissements' | 'debits'>('encaissements');

  // OCR state
  const [ocrBusy, setOcrBusy] = useState(false);

  // Expense form state
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseInitial, setExpenseInitial] = useState<Partial<ExpenseFormValues> | null>(null);

  // Delete confirm state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Accountant
  const [showInvite, setShowInvite] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const [dashboardPeriod, setDashboardPeriod] = useState<string>(
    () => `month:${ymKey(new Date())}`,
  );

  // Flux tab state
  const [fluxSearch, setFluxSearch] = useState('');
  const [fluxType, setFluxType] = useState<'all' | 'expense' | 'invoice'>('all');
  const [fluxSubTab, setFluxSubTab] = useState<
    'all' | 'draft' | 'upcoming' | 'late' | 'paid' | 'missing'
  >('all');
  const [fluxSortKey, setFluxSortKey] = useState<'date' | 'amountHt' | 'amountTtc'>('date');
  const [fluxSortDir, setFluxSortDir] = useState<'asc' | 'desc'>('desc');
  const [fluxPage, setFluxPage] = useState(1);
  const [fluxPageSize, setFluxPageSize] = useState<25 | 50 | 100>(25);
  const [fluxSelected, setFluxSelected] = useState<Set<string>>(new Set());
  // Période Flux : 'all' | 'month:YYYY-MM' | 'quarter:YYYY:Q' | 'year:YYYY' | 'custom'
  const [fluxPeriod, setFluxPeriod] = useState<string>('all');
  const [fluxCustomStart, setFluxCustomStart] = useState<string>('');
  const [fluxCustomEnd, setFluxCustomEnd] = useState<string>('');
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void loadAll();
  }, [user]);

  async function loadAll() {
    setLoading(true);
    try {
      const [expRes, catRes, projRes, invRes, accRes, settingsRes] = await Promise.all([
        supabase
          .from('expenses')
          .select(
            `id, date, description, supplier, amount_ht, tva_rate, tva_amount, amount,
             expense_category_id, payment_method, is_autoliquidation, project_id,
             source, ocr_confidence, receipt_storage_path, bank_transaction_id`,
          )
          .order('date', { ascending: false }),
        supabase.from('expense_categories').select('id, slug, name').order('sort_order'),
        supabase.from('projects').select('id, name').order('name'),
        supabase
          .from('invoices')
          .select(
            `id, invoice_number, title, status, total_ht, total_ttc, tva_rate, tva_breakdown,
             paid_at, issued_at, due_date, created_at, clients(name), bank_transaction_id,
             invoice_type, quote_id`,
          )
          .order('issued_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('accountant_access')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('business_reminder_settings')
          .select('vat_regime, tva_method')
          .maybeSingle(),
      ]);

      setExpenses((expRes.data as ExpenseRow[]) || []);
      setCategories((catRes.data as CategoryRow[]) || []);
      setProjects((projRes.data as ProjectRow[]) || []);

      // Pour éviter un double-comptage du CA, on déduit les acomptes déjà
      // émis du montant des factures de solde (même logique que l'export FEC et
      // le dashboard). Le total brut reste en base, seul l'affichage comptable
      // utilise le montant net.
      const rawInvoices = (invRes.data as InvoiceRow[]) || [];
      const depositsByQuote = new Map<string, number>();
      for (const inv of rawInvoices) {
        if (
          inv.invoice_type === 'acompte' &&
          inv.quote_id &&
          inv.status !== 'annulee'
        ) {
          const prev = depositsByQuote.get(inv.quote_id) || 0;
          depositsByQuote.set(inv.quote_id, prev + Number(inv.total_ttc || 0));
        }
      }
      const normalizedInvoices: InvoiceRow[] = rawInvoices.map((inv) => {
        if (inv.invoice_type !== 'solde' || !inv.quote_id) return inv;
        const rawHt = Number(inv.total_ht || 0);
        const rawTtc = Number(inv.total_ttc || 0);
        const deducted = depositsByQuote.get(inv.quote_id) || 0;
        const effectiveTtc = Math.max(0, rawTtc - deducted);
        // Applique le même ratio au HT pour garder (HT + TVA) cohérent avec le
        // TTC effectif (évite que TvaPanel double-compte la base).
        const effectiveHt =
          rawTtc > 0
            ? Math.round((effectiveTtc * rawHt / rawTtc) * 100) / 100
            : 0;
        return {
          ...inv,
          total_ht: effectiveHt,
          total_ttc: effectiveTtc,
          // On neutralise le breakdown (qui correspond au brut) : le panneau
          // TVA retombera sur le taux legacy pour générer une paire cohérente
          // avec le HT effectif.
          tva_breakdown: null,
        };
      });
      setInvoices(normalizedInvoices);
      setAccesses((accRes.data as AccessRow[]) || []);
      setVatRegime(settingsRes.data?.vat_regime || null);
      setTvaMethod((settingsRes.data?.tva_method as 'encaissements' | 'debits') || 'encaissements');
    } finally {
      setLoading(false);
    }
  }

  // Recharge uniquement les accès comptables (utilisé pour rafraîchir les
  // dernières connexions sans recharger toutes les dépenses/factures).
  async function loadAccesses() {
    const { data } = await supabase
      .from('accountant_access')
      .select('*')
      .order('created_at', { ascending: false });
    setAccesses((data as AccessRow[]) || []);
  }

  // Refresh des accès quand l'utilisateur ouvre l'onglet "Comptable" — permet
  // de voir en direct quand le comptable s'est connecté sans recharger la page.
  useEffect(() => {
    if (tab === 'accountant' && user) {
      loadAccesses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user]);

  // ───────────────────────── OCR ─────────────────────────

  async function handleOcrFile(file: File) {
    if (!user) return;
    setOcrBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Session expirée', variant: 'destructive' });
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/ai/expense-ocr', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: 'Échec de l\'analyse',
          description: data.error || 'Erreur OCR',
          variant: 'destructive',
        });
        return;
      }
      const ex = data.extracted;

      // Match category by slug
      const cat = categories.find((c) => c.slug === ex.category_slug);

      const initial: Partial<ExpenseFormValues> = {
        description: ex.description || '',
        supplier: ex.supplier || '',
        date: ex.date || new Date().toISOString().split('T')[0],
        amount_ht: Number(ex.amount_ht || 0),
        tva_rate: ex.tva_breakdown?.[0]?.rate ?? 20,
        tva_amount: Number(ex.tva_total || 0),
        amount: Number(ex.amount_ttc || 0),
        expense_category_id: cat?.id || null,
        payment_method: ex.payment_method || null,
        is_autoliquidation: Boolean(ex.is_autoliquidation),
        source: 'ocr',
        ocr_confidence: ex.confidence ?? null,
        receipt_storage_path: data.receipt_storage_path || null,
      };
      setExpenseInitial(initial);
      setShowExpenseForm(true);
    } catch (e) {
      toast({
        title: "Erreur lors de l'analyse",
        description: e instanceof Error ? e.message : 'Erreur inconnue',
        variant: 'destructive',
      });
    } finally {
      setOcrBusy(false);
    }
  }

  // ───────────────────────── CRUD ─────────────────────────

  function openCreate() {
    setExpenseInitial(null);
    setShowExpenseForm(true);
  }

  function openEdit(e: ExpenseRow) {
    setExpenseInitial({
      id: e.id,
      description: e.description,
      supplier: e.supplier,
      date: e.date,
      amount_ht: Number(e.amount_ht || 0),
      tva_rate: Number(e.tva_rate || 20),
      tva_amount: Number(e.tva_amount || 0),
      amount: Number(e.amount || 0),
      expense_category_id: e.expense_category_id,
      payment_method: e.payment_method,
      is_autoliquidation: Boolean(e.is_autoliquidation),
      project_id: e.project_id,
      source: (e.source as 'manual' | 'ocr' | 'recurring') || 'manual',
      ocr_confidence: e.ocr_confidence,
      receipt_storage_path: e.receipt_storage_path,
    });
    setShowExpenseForm(true);
  }

  async function handleExpenseSubmit(values: ExpenseFormValues, newReceiptFile: File | null) {
    if (!user) return;

    // Upload the new receipt first (mandatory — enforced by the form)
    let receiptPath = values.receipt_storage_path ?? null;
    if (newReceiptFile) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Session expirée', variant: 'destructive' });
        throw new Error('Session expirée');
      }
      const uploadForm = new FormData();
      uploadForm.append('file', newReceiptFile);
      const uploadRes = await fetch('/api/comptabilite/expenses/upload-receipt', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: uploadForm,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        toast({
          title: 'Échec du dépôt du justificatif',
          description: uploadData.error || 'Erreur inconnue',
          variant: 'destructive',
        });
        throw new Error(uploadData.error || 'upload failed');
      }
      receiptPath = uploadData.path;
    }

    const payload = {
      description: values.description,
      supplier: values.supplier,
      date: values.date,
      amount_ht: values.amount_ht,
      tva_rate: values.tva_rate,
      tva_amount: values.tva_amount,
      amount: values.amount,
      expense_category_id: values.expense_category_id,
      payment_method: values.payment_method,
      is_autoliquidation: values.is_autoliquidation,
      project_id: values.project_id,
      source: values.source,
      ocr_confidence: values.ocr_confidence ?? null,
      receipt_storage_path: receiptPath,
      // Legacy "category" column kept as slug for backward compat
      category:
        categories.find((c) => c.id === values.expense_category_id)?.slug || 'autres',
    };

    if (values.id) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', values.id);
      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        throw error;
      }
      toast({ title: 'Dépense mise à jour' });
    } else {
      const { error } = await supabase
        .from('expenses')
        .insert({ ...payload, user_id: user.id });
      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        throw error;
      }
      toast({ title: 'Dépense enregistrée' });
    }
    await loadAll();
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from('expenses').delete().eq('id', deleteId);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dépense supprimée' });
      setExpenses((prev) => prev.filter((e) => e.id !== deleteId));
    }
    setDeleteId(null);
  }

  // ───────────────────────── Accountant ─────────────────────────

  async function handleInviteSubmit(values: AccountantInviteValues) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Session expirée');
    const res = await fetch('/api/comptabilite/accountant/invite', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Impossible d'envoyer l'invitation");
    toast({
      title: 'Invitation envoyée',
      description: data.email_sent
        ? `Email envoyé à ${values.accountant_email}`
        : 'Lien créé (email non envoyé)',
    });
    await loadAll();
  }

  async function handleRevoke() {
    if (!revokeId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/comptabilite/accountant/${revokeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) {
      toast({ title: 'Accès révoqué' });
      await loadAll();
    } else {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
    setRevokeId(null);
  }

  function copyAccessLink(token: string) {
    const url = `${window.location.origin}/comptable/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Lien copié' });
  }

  // ───────────────────────── Receipt view/download ─────────────────────────

  async function fetchReceiptUrl(expenseId: string): Promise<string | null> {
    setLoadingReceiptId(expenseId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Session expirée', variant: 'destructive' });
        return null;
      }
      const res = await fetch(`/api/comptabilite/expenses/${expenseId}/receipt-url`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: 'Justificatif indisponible',
          description: data.error || 'Erreur',
          variant: 'destructive',
        });
        return null;
      }
      return data.url as string;
    } finally {
      setLoadingReceiptId(null);
    }
  }

  async function handleViewReceipt(expenseId: string) {
    const url = await fetchReceiptUrl(expenseId);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleDownloadReceipt(expenseId: string, filename: string) {
    const url = await fetchReceiptUrl(expenseId);
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      toast({
        title: 'Téléchargement impossible',
        description: e instanceof Error ? e.message : 'Erreur',
        variant: 'destructive',
      });
    }
  }

  // ───────────────────────── Computed ─────────────────────────

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (search) {
        const s = search.toLowerCase();
        if (
          !e.description?.toLowerCase().includes(s) &&
          !e.supplier?.toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      if (filterCategory !== 'all' && e.expense_category_id !== filterCategory) return false;
      if (filterSource !== 'all' && e.source !== filterSource) return false;
      if (filterYear !== 'all' && e.date) {
        if (new Date(e.date).getFullYear() !== Number(filterYear)) return false;
      }
      return true;
    });
  }, [expenses, search, filterCategory, filterSource, filterYear]);

  // ───── Dashboard : données filtrées par dashboardPeriod ─────

  const periodExpenses = useMemo(
    () => expenses.filter((e) => isInPeriod(e.date, dashboardPeriod)),
    [expenses, dashboardPeriod],
  );

  const periodInvoices = useMemo(() => {
    return invoices.filter((i) => {
      // Méthode encaissements : on prend la date de paiement
      // Méthode débits      : on prend la date d'émission
      const refDate =
        tvaMethod === 'encaissements' ? i.paid_at : i.issued_at || i.created_at;
      return isInPeriod(refDate, dashboardPeriod);
    });
  }, [invoices, dashboardPeriod, tvaMethod]);

  const dashboardMetrics = useMemo(() => {
    // Dépenses
    const expHt = periodExpenses.reduce((s, e) => s + Number(e.amount_ht || 0), 0);
    const expTtc = periodExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const expCount = periodExpenses.length;

    // TVA déductible (récupérable) — exclut autoliquidation
    const tvaDeductible = periodExpenses.reduce(
      (s, e) => (e.is_autoliquidation ? s : s + Number(e.tva_amount || 0)),
      0,
    );
    const deductibleCount = periodExpenses.filter((e) => !e.is_autoliquidation).length;

    // Recettes (factures encaissées dans la période, selon tvaMethod)
    const paidInvoices = periodInvoices.filter(
      (i) => i.status === 'paid' || Boolean(i.paid_at),
    );
    const revHt = paidInvoices.reduce((s, i) => s + Number(i.total_ht || 0), 0);
    const revTtc = paidInvoices.reduce((s, i) => s + Number(i.total_ttc || 0), 0);
    const revCount = paidInvoices.length;

    // TVA collectée = différence TTC - HT sur les factures payées
    const tvaCollected = Math.max(0, revTtc - revHt);

    // TVA à reverser
    const tvaToPay = tvaCollected - tvaDeductible;

    // Marge
    const marginHt = revHt - expHt;
    const cashNet = revTtc - expTtc;

    // Justificatifs manquants (sur dépenses de la période)
    const missingCount = periodExpenses.filter((e) => !e.receipt_storage_path).length;
    const compliance =
      expCount === 0 ? 100 : Math.round(((expCount - missingCount) / expCount) * 100);

    // Pointage banque (sur dépenses + factures de la période)
    const totalActive = periodExpenses.length + paidInvoices.length;
    const pointedExp = periodExpenses.filter((e) => e.bank_transaction_id).length;
    const pointedInv = paidInvoices.filter((i) => i.bank_transaction_id).length;
    const pointedCount = pointedExp + pointedInv;
    const pointedRatio =
      totalActive === 0 ? 100 : Math.round((pointedCount / totalActive) * 100);

    return {
      expHt,
      expTtc,
      expCount,
      revHt,
      revTtc,
      revCount,
      tvaCollected,
      tvaDeductible,
      deductibleCount,
      tvaToPay,
      marginHt,
      cashNet,
      missingCount,
      compliance,
      pointedCount,
      totalActive,
      pointedRatio,
    };
  }, [periodExpenses, periodInvoices]);

  const monthlyData = useMemo(() => {
    const months: { month: string; depenses: number; recettes: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = ymKey(d);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const depenses = expenses
        .filter((e) => e.date?.startsWith(key))
        .reduce((s, e) => s + Number(e.amount_ht || 0), 0);
      const recettes = invoices
        .filter((i) => {
          const ref = tvaMethod === 'encaissements' ? i.paid_at : i.issued_at;
          if (!ref) return false;
          if (tvaMethod === 'encaissements' && !(i.status === 'paid' || i.paid_at)) {
            return false;
          }
          return ref.startsWith(key);
        })
        .reduce((s, i) => s + Number(i.total_ht || 0), 0);
      months.push({
        month: label,
        depenses: +depenses.toFixed(2),
        recettes: +recettes.toFixed(2),
      });
    }
    return months;
  }, [expenses, invoices, tvaMethod]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of periodExpenses) {
      const slug =
        categories.find((c) => c.id === e.expense_category_id)?.slug || 'autres';
      map[slug] = (map[slug] || 0) + Number(e.amount_ht || 0);
    }
    return Object.entries(map)
      .map(([slug, total]) => ({
        name: categories.find((c) => c.slug === slug)?.name || slug,
        value: +total.toFixed(2),
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [periodExpenses, categories]);

  const topCategoryName = categoryData[0]?.name || '—';
  const periodLabel = useMemo(() => getPeriodLabel(dashboardPeriod), [dashboardPeriod]);
  const isFranchise = vatRegime === 'franchise_en_base';
  const periodOptionGroups = useMemo(() => buildDashboardPeriodOptions(), []);

  // Recettes (paid invoices)
  const revenueRows = useMemo(
    () =>
      invoices.filter(
        (i) =>
          (i.status === 'paid' || i.paid_at) &&
          (filterYear === 'all' ||
            (i.paid_at &&
              new Date(i.paid_at).getFullYear() === Number(filterYear)) ||
            (i.issued_at &&
              new Date(i.issued_at).getFullYear() === Number(filterYear))),
      ),
    [invoices, filterYear],
  );
  const revenueHt = revenueRows.reduce((s, i) => s + Number(i.total_ht || 0), 0);
  const revenueTtc = revenueRows.reduce((s, i) => s + Number(i.total_ttc || 0), 0);
  const revenueTva = revenueTtc - revenueHt;

  // Available years for filter
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    expenses.forEach((e) => e.date && years.add(new Date(e.date).getFullYear()));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses]);

  // ───────────────────────── Flux (unified view : dépenses + factures) ─────────────────────────

  type FluxRow = {
    key: string;
    kind: 'expense' | 'invoice';
    date: string;
    deadline: string | null;
    label: string;
    sublabel: string;
    amountHt: number;
    amountTtc: number;
    tva: number;
    statusKey: FluxStatusKey;
    statusLabel: string;
    statusColor: string;
    sending: 'sent' | 'none' | null; // pour factures uniquement
    source: string;
    categoryName: string | null;
    hasReceipt: boolean;
    pointed: boolean;
    expenseId?: string;
    invoiceId?: string;
    receiptFilename?: string;
  };

  const flux = useMemo<FluxRow[]>(() => {
    const rows: FluxRow[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const e of expenses) {
      const catName =
        categories.find((c) => c.id === e.expense_category_id)?.name || null;
      const hasReceipt = Boolean(e.receipt_storage_path);
      const receiptFilename = e.receipt_storage_path?.split('/').pop() || undefined;
      const statusKey: FluxStatusKey = hasReceipt ? 'justified' : 'missing';
      rows.push({
        key: `exp-${e.id}`,
        kind: 'expense',
        date: e.date,
        deadline: null,
        label: e.supplier || e.description || '—',
        sublabel: e.supplier && e.description ? e.description : '',
        amountHt: Number(e.amount_ht || 0),
        amountTtc: Number(e.amount || 0),
        tva: Number(e.tva_amount || 0),
        statusKey,
        statusLabel: FLUX_STATUS_LABELS[statusKey].label,
        statusColor: FLUX_STATUS_LABELS[statusKey].color,
        sending: null,
        source: e.source === 'ocr' ? 'Maurice IA' : e.source === 'recurring' ? 'Récurrent' : 'Manuel',
        categoryName: catName,
        hasReceipt,
        pointed: Boolean(e.bank_transaction_id),
        expenseId: e.id,
        receiptFilename,
      });
    }

    for (const i of invoices) {
      const isPaid = i.status === 'paid' || Boolean(i.paid_at);
      const isDraft = i.status === 'draft' || i.status === 'brouillon';
      const isLate = !isPaid && !isDraft && i.due_date != null && i.due_date < today;
      let statusKey: FluxStatusKey;
      if (isPaid) statusKey = 'paid';
      else if (isDraft) statusKey = 'draft';
      else if (isLate) statusKey = 'late';
      else statusKey = 'upcoming';

      const sending: 'sent' | 'none' =
        i.status === 'sent' || i.status === 'envoyee' || isPaid ? 'sent' : 'none';

      rows.push({
        key: `inv-${i.id}`,
        kind: 'invoice',
        date: i.issued_at || i.created_at,
        deadline: i.due_date,
        label: i.invoice_number,
        sublabel: `${i.title} — ${getClientName(i.clients)}`,
        amountHt: Number(i.total_ht || 0),
        amountTtc: Number(i.total_ttc || 0),
        tva: Number(i.total_ttc || 0) - Number(i.total_ht || 0),
        statusKey,
        statusLabel: FLUX_STATUS_LABELS[statusKey].label,
        statusColor: FLUX_STATUS_LABELS[statusKey].color,
        sending,
        source: 'Émise',
        categoryName: null,
        hasReceipt: false,
        pointed: Boolean(i.bank_transaction_id),
        invoiceId: i.id,
      });
    }

    return rows;
  }, [expenses, invoices, categories]);

  const fluxStats = useMemo(() => {
    const all = flux.length;
    const draft = flux.filter((f) => f.kind === 'invoice' && f.statusKey === 'draft').length;
    const upcoming = flux.filter((f) => f.kind === 'invoice' && f.statusKey === 'upcoming').length;
    const late = flux.filter((f) => f.kind === 'invoice' && f.statusKey === 'late').length;
    const paid = flux.filter((f) => f.kind === 'invoice' && f.statusKey === 'paid').length;
    const missing = flux.filter((f) => f.kind === 'expense' && f.statusKey === 'missing').length;
    const expCount = flux.filter((f) => f.kind === 'expense').length;
    const invCount = flux.filter((f) => f.kind === 'invoice').length;
    return { all, draft, upcoming, late, paid, missing, expCount, invCount };
  }, [flux]);

  const filteredFlux = useMemo(() => {
    const filtered = flux.filter((f) => {
      if (fluxType !== 'all' && f.kind !== fluxType) return false;
      if (fluxSearch) {
        const s = fluxSearch.toLowerCase();
        if (
          !f.label.toLowerCase().includes(s) &&
          !f.sublabel.toLowerCase().includes(s)
        ) {
          return false;
        }
      }
      if (fluxSubTab !== 'all') {
        if (fluxSubTab === 'missing') {
          if (f.kind !== 'expense' || f.statusKey !== 'missing') return false;
        } else {
          if (f.kind !== 'invoice' || f.statusKey !== fluxSubTab) return false;
        }
      }
      // Filtre période Flux
      if (fluxPeriod !== 'all') {
        if (!f.date) return false;
        if (fluxPeriod === 'custom') {
          if (fluxCustomStart && f.date < fluxCustomStart) return false;
          if (fluxCustomEnd && f.date > fluxCustomEnd) return false;
        } else if (!isInPeriod(f.date, fluxPeriod)) {
          return false;
        }
      }
      return true;
    });

    const dir = fluxSortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (fluxSortKey === 'date') {
        const av = a.date || '';
        const bv = b.date || '';
        return av < bv ? -dir : av > bv ? dir : 0;
      }
      if (fluxSortKey === 'amountHt') {
        return (a.amountHt - b.amountHt) * dir;
      }
      return (a.amountTtc - b.amountTtc) * dir;
    });
    return filtered;
  }, [
    flux,
    fluxType,
    fluxSearch,
    fluxSubTab,
    fluxPeriod,
    fluxCustomStart,
    fluxCustomEnd,
    fluxSortKey,
    fluxSortDir,
  ]);

  const fluxTotalPages = Math.max(1, Math.ceil(filteredFlux.length / fluxPageSize));
  const pagedFlux = useMemo(
    () =>
      filteredFlux.slice(
        (fluxPage - 1) * fluxPageSize,
        fluxPage * fluxPageSize,
      ),
    [filteredFlux, fluxPage, fluxPageSize],
  );

  // Reset pagination + selection when filters change
  useEffect(() => {
    setFluxPage(1);
    setFluxSelected(new Set());
  }, [
    fluxSubTab,
    fluxType,
    fluxSearch,
    fluxPeriod,
    fluxCustomStart,
    fluxCustomEnd,
    fluxPageSize,
  ]);

  // Clamp page if data shrinks below current page
  useEffect(() => {
    if (fluxPage > fluxTotalPages) setFluxPage(fluxTotalPages);
  }, [fluxTotalPages, fluxPage]);

  const selectedTotalHt = useMemo(
    () =>
      flux
        .filter((f) => fluxSelected.has(f.key))
        .reduce((s, f) => s + f.amountHt, 0),
    [flux, fluxSelected],
  );

  function toggleFluxSort(key: 'date' | 'amountHt' | 'amountTtc') {
    if (fluxSortKey === key) {
      setFluxSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setFluxSortKey(key);
      setFluxSortDir('desc');
    }
  }

  function renderPageNumbers(current: number, total: number): (number | 'dots')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | 'dots')[] = [1];
    if (current > 3) pages.push('dots');
    for (
      let i = Math.max(2, current - 1);
      i <= Math.min(total - 1, current + 1);
      i++
    ) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('dots');
    pages.push(total);
    return pages;
  }

  // ───────────────────────── Render ─────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptabilité IA"
        description="Suivi dépenses, TVA, exports comptables et accès comptable sécurisé"
      >
        <Button onClick={openCreate} className="gap-2 bg-[#D35400] hover:bg-[#b8470a]">
          <Plus className="h-4 w-4" />
          Nouvelle dépense
        </Button>
      </PageHeader>

      {/* Maurice — Comptable IA */}
      <div className="relative overflow-hidden rounded-2xl border border-[#D35400]/30 bg-gradient-to-br from-orange-50 via-orange-50/60 to-amber-50/40 p-4 sm:p-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#D35400]/10 blur-2xl sm:-right-4 sm:-top-4" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#D35400] to-[#b8470a] text-white shadow-lg shadow-[#D35400]/20 sm:h-16 sm:w-16">
                <Bot className="h-7 w-7 sm:h-8 sm:w-8" />
              </div>
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-md">
                <Sparkles className="h-3 w-3 text-[#D35400]" />
              </div>
            </div>
            <div className="min-w-0 flex-1 sm:hidden">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-foreground">Maurice</h2>
                <Badge variant="secondary" className="bg-[#D35400]/10 text-[10px] font-medium text-[#D35400] hover:bg-[#D35400]/10">
                  Comptable IA
                </Badge>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Photographiez, Maurice range tout au bon endroit.
              </p>
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 sm:block">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Bonjour, moi c&apos;est Maurice</h2>
              <Badge variant="secondary" className="bg-[#D35400]/10 text-xs font-medium text-[#D35400] hover:bg-[#D35400]/10">
                Comptable IA
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Prenez vos factures en photo ou renseignez-les manuellement —{' '}
              <span className="font-medium text-foreground">je m&apos;occupe du reste</span>{' '}
              : extraction TVA, classement par catégorie, affectation au bon chantier.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
            <Button
              onClick={() => {
                setTab('expenses');
                setTimeout(() => {
                  document.getElementById('expense-ocr-zone')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              }}
              className="gap-1.5 bg-[#D35400] text-white shadow-sm hover:bg-[#b8470a]"
              size="sm"
            >
              <Camera className="h-4 w-4" />
              Photographier
            </Button>
            <Button
              onClick={openCreate}
              variant="outline"
              className="gap-1.5 border-[#D35400]/30 bg-white/60 text-foreground hover:bg-white"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Saisie manuelle
            </Button>
          </div>
        </div>
        <div className="relative mt-3 flex items-center gap-1.5 rounded-lg bg-white/70 px-3 py-2 text-[11px] text-muted-foreground sm:mt-4">
          <Sparkles className="h-3 w-3 shrink-0 text-[#D35400]" />
          <span>
            <strong className="font-medium text-foreground">Rappel&nbsp;:</strong> chaque dépense doit obligatoirement avoir un justificatif (photo ou PDF). C&apos;est la loi — et Maurice y veille.
          </span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        {/* Mobile : scroll horizontal — desktop : grille uniforme */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex h-auto w-max gap-1 sm:grid sm:w-full sm:grid-cols-7 sm:gap-0">
            <TabsTrigger value="dashboard" className="flex-shrink-0 whitespace-nowrap text-xs sm:text-sm">
              Tableau
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex-shrink-0 whitespace-nowrap text-xs sm:text-sm">
              Dépenses
            </TabsTrigger>
            <TabsTrigger value="flux" className="flex-shrink-0 whitespace-nowrap text-xs sm:text-sm">
              <ArrowLeftRight className="mr-1 h-3.5 w-3.5" />
              Flux
            </TabsTrigger>
            <TabsTrigger value="bank" className="flex-shrink-0 whitespace-nowrap text-xs sm:text-sm">
              <Landmark className="mr-1 h-3.5 w-3.5" />
              Banque
            </TabsTrigger>
            <TabsTrigger value="revenue" className="flex-shrink-0 whitespace-nowrap text-xs sm:text-sm">
              Recettes
            </TabsTrigger>
            <TabsTrigger value="tva" className="flex-shrink-0 whitespace-nowrap text-xs sm:text-sm">
              TVA
            </TabsTrigger>
            <TabsTrigger value="accountant" className="flex-shrink-0 whitespace-nowrap text-xs sm:text-sm">
              Comptable
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ─────── TABLEAU DE BORD ─────── */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          {/* Sélecteur de période */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Période</p>
              <Select value={dashboardPeriod} onValueChange={setDashboardPeriod}>
                <SelectTrigger className="mt-1 w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  <SelectGroup>
                    <SelectLabel>Périodes courantes</SelectLabel>
                    {periodOptionGroups.current.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>12 derniers mois</SelectLabel>
                    {periodOptionGroups.months.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Trimestres</SelectLabel>
                    {periodOptionGroups.quarters.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Années</SelectLabel>
                    {periodOptionGroups.years.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Données affichées pour&nbsp;: <span className="font-medium text-foreground">{periodLabel}</span>
                {!isFranchise && (
                  <>
                    {' · '}
                    Méthode TVA&nbsp;:{' '}
                    {tvaMethod === 'encaissements' ? 'encaissements' : 'débits'}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Row 1 — KPI financiers principaux */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingDown className="h-4 w-4 text-red-500" /> Dépenses HT
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">
                {fmtEur(dashboardMetrics.expHt)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                TTC&nbsp;: {fmtEur(dashboardMetrics.expTtc)} · {dashboardMetrics.expCount} dépense
                {dashboardMetrics.expCount > 1 ? 's' : ''}
              </p>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Recettes HT
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">
                {fmtEur(dashboardMetrics.revHt)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                TTC&nbsp;: {fmtEur(dashboardMetrics.revTtc)} · {dashboardMetrics.revCount} facture
                {dashboardMetrics.revCount > 1 ? 's' : ''}
              </p>
            </Card>

            {isFranchise ? (
              <>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wallet className="h-4 w-4 text-[#D35400]" /> Marge brute HT
                  </div>
                  <p
                    className={cn(
                      'mt-2 text-xl font-bold tabular-nums sm:text-2xl',
                      dashboardMetrics.marginHt >= 0 ? 'text-emerald-700' : 'text-red-600',
                    )}
                  >
                    {fmtEur(dashboardMetrics.marginHt)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Recettes − Dépenses</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wallet className="h-4 w-4 text-blue-500" /> Cash net TTC
                  </div>
                  <p
                    className={cn(
                      'mt-2 text-xl font-bold tabular-nums sm:text-2xl',
                      dashboardMetrics.cashNet >= 0 ? 'text-emerald-700' : 'text-red-600',
                    )}
                  >
                    {fmtEur(dashboardMetrics.cashNet)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Franchise en base — pas de TVA</p>
                </Card>
              </>
            ) : (
              <>
                <Card
                  className={cn(
                    'p-4',
                    dashboardMetrics.tvaToPay > 0
                      ? 'border-[#D35400]/30 bg-orange-50/40'
                      : dashboardMetrics.tvaToPay < 0
                      ? 'border-emerald-300/40 bg-emerald-50/40'
                      : '',
                  )}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Percent
                      className={cn(
                        'h-4 w-4',
                        dashboardMetrics.tvaToPay > 0 ? 'text-[#D35400]' : 'text-emerald-600',
                      )}
                    />
                    {dashboardMetrics.tvaToPay >= 0 ? 'TVA à payer' : 'Crédit de TVA'}
                  </div>
                  <p
                    className={cn(
                      'mt-2 text-xl font-bold tabular-nums sm:text-2xl',
                      dashboardMetrics.tvaToPay > 0
                        ? 'text-[#D35400]'
                        : dashboardMetrics.tvaToPay < 0
                        ? 'text-emerald-700'
                        : '',
                    )}
                  >
                    {fmtEur(Math.abs(dashboardMetrics.tvaToPay))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Collectée {fmtEur(dashboardMetrics.tvaCollected)} −{' '}
                    {fmtEur(dashboardMetrics.tvaDeductible)}
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Receipt className="h-4 w-4 text-blue-500" /> TVA récupérable
                  </div>
                  <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">
                    {fmtEur(dashboardMetrics.tvaDeductible)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {dashboardMetrics.deductibleCount} dépense
                    {dashboardMetrics.deductibleCount > 1 ? 's' : ''} déductible
                    {dashboardMetrics.deductibleCount > 1 ? 's' : ''}
                  </p>
                </Card>
              </>
            )}
          </div>

          {/* Row 2 — Indicators secondaires */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Justificatifs manquants */}
            <Card
              className={cn(
                'p-4',
                dashboardMetrics.missingCount > 0
                  ? 'border-red-200 bg-red-50/40'
                  : dashboardMetrics.expCount > 0
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : '',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {dashboardMetrics.missingCount > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  Justificatifs manquants
                </div>
              </div>
              <p
                className={cn(
                  'mt-2 text-xl font-bold tabular-nums sm:text-2xl',
                  dashboardMetrics.missingCount > 0 ? 'text-red-600' : 'text-emerald-700',
                )}
              >
                {dashboardMetrics.missingCount}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{dashboardMetrics.compliance}% conformes</span>
                {dashboardMetrics.missingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFluxSubTab('missing');
                      setTab('flux');
                    }}
                    className="font-medium text-red-600 underline-offset-2 hover:underline"
                  >
                    Voir →
                  </button>
                )}
              </div>
            </Card>

            {/* Pointage banque */}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Landmark className="h-4 w-4 text-blue-500" /> Pointage banque
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">
                {dashboardMetrics.pointedCount}
                <span className="text-base text-muted-foreground">
                  /{dashboardMetrics.totalActive}
                </span>
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{dashboardMetrics.pointedRatio}% rapprochés</span>
                <button
                  type="button"
                  onClick={() => setTab('bank')}
                  className="font-medium text-blue-600 underline-offset-2 hover:underline"
                >
                  Banque →
                </button>
              </div>
            </Card>

            {/* Top catégorie */}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-[#D35400]" /> Top catégorie
              </div>
              <p className="mt-2 text-base font-bold sm:text-lg line-clamp-1">{topCategoryName}</p>
              <p className="text-[11px] text-muted-foreground">
                {categoryData[0] ? fmtEur(categoryData[0].value) : '—'} HT
              </p>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h3 className="text-sm font-semibold">Dépenses vs Recettes (12 derniers mois)</h3>
              <p className="text-[11px] text-muted-foreground">Montants HT</p>
              {monthlyData.some((m) => m.depenses > 0 || m.recettes > 0) ? (
                <div className="mt-3 h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                      <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} width={50} />
                      <RechartsTooltip
                        formatter={(v: number) => fmtEur(v)}
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                      />
                      <Bar dataKey="recettes" name="Recettes" fill="#10b981" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="depenses" name="Dépenses" fill="#D35400" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Pas encore de mouvements sur les 12 derniers mois
                </p>
              )}
            </Card>

            <Card className="p-4">
              <h3 className="text-sm font-semibold">Répartition par catégorie</h3>
              <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
              {categoryData.length > 0 ? (
                <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
                  <PieChart width={180} height={180}>
                    <Pie data={categoryData} dataKey="value" outerRadius={70} innerRadius={40}>
                      {categoryData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(v: number) => fmtEur(v)}
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    />
                  </PieChart>
                  <ul className="flex-1 space-y-1 text-xs">
                    {categoryData.slice(0, 6).map((c, i) => (
                      <li key={c.name} className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="line-clamp-1">{c.name}</span>
                        </span>
                        <span className="tabular-nums font-medium">{fmtEur(c.value)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Aucune dépense sur {periodLabel.toLowerCase()}
                </p>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ─────── DÉPENSES ─────── */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div id="expense-ocr-zone" className="scroll-mt-20">
            <ExpenseOcrDropzone onFileSelected={handleOcrFile} busy={ocrBusy} />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher fournisseur ou description…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger>
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes sources</SelectItem>
                <SelectItem value="manual">Manuel</SelectItem>
                <SelectItem value="ocr">OCR IA</SelectItem>
                <SelectItem value="recurring">Récurrent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              icon={Calculator}
              title="Aucune dépense"
              description="Photographiez une facture pour la saisir en quelques secondes, ou ajoutez-la manuellement."
            >
              <Button onClick={openCreate} className="gap-2 bg-[#D35400] hover:bg-[#b8470a]">
                <Plus className="h-4 w-4" /> Nouvelle dépense
              </Button>
            </EmptyState>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-2 sm:hidden">
                {filteredExpenses.map((e) => {
                  const cat = categories.find((c) => c.id === e.expense_category_id);
                  const hasReceipt = !!e.receipt_storage_path;
                  return (
                    <Card
                      key={e.id}
                      className={cn(
                        'cursor-pointer p-3 hover:bg-muted/30',
                        !hasReceipt && 'border-l-2 border-l-red-400',
                      )}
                      onClick={() => openEdit(e)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{e.supplier || '—'}</p>
                          <p className="truncate text-xs text-muted-foreground">{e.description}</p>
                        </div>
                        <p className="whitespace-nowrap text-sm font-bold tabular-nums">
                          {fmtEur(e.amount)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">{fmtDate(e.date)}</span>
                          {cat && (
                            <Badge variant="secondary" className="text-[9px]">
                              {cat.name}
                            </Badge>
                          )}
                          {e.source === 'ocr' && (
                            <Badge className="bg-[#D35400]/10 text-[9px] text-[#D35400]">
                              <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                              OCR
                            </Badge>
                          )}
                          {hasReceipt ? (
                            <Badge className="gap-0.5 bg-emerald-100 text-[9px] text-emerald-700 hover:bg-emerald-100">
                              <FileCheck2 className="h-2.5 w-2.5" />
                              Justif
                            </Badge>
                          ) : (
                            <Badge className="gap-0.5 bg-red-100 text-[9px] text-red-700 hover:bg-red-100">
                              <FileX2 className="h-2.5 w-2.5" />
                              Sans justif
                            </Badge>
                          )}
                        </div>
                        <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                          TVA {fmtEur(e.tva_amount)}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Desktop table */}
              <Card className="hidden overflow-hidden sm:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Date</th>
                        <th className="px-3 py-2 text-left font-medium">Fournisseur</th>
                        <th className="px-3 py-2 text-left font-medium">Catégorie</th>
                        <th className="px-3 py-2 text-right font-medium">HT</th>
                        <th className="px-3 py-2 text-right font-medium">TVA</th>
                        <th className="px-3 py-2 text-right font-medium">TTC</th>
                        <th className="px-3 py-2 text-center font-medium">Justif</th>
                        <th className="px-3 py-2 text-center font-medium">Source</th>
                        <th className="px-3 py-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((e) => {
                        const cat = categories.find((c) => c.id === e.expense_category_id);
                        return (
                          <tr
                            key={e.id}
                            className="cursor-pointer border-t border-border/60 hover:bg-muted/20"
                            onClick={() => openEdit(e)}
                          >
                            <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{e.supplier || '—'}</div>
                              {e.description && (
                                <div className="line-clamp-1 text-[11px] text-muted-foreground">
                                  {e.description}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {cat ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  {cat.name}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                              {e.is_autoliquidation && (
                                <Badge variant="outline" className="ml-1 text-[10px]">
                                  Autoliq.
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtEur(e.amount_ht)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtEur(e.tva_amount)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-semibold">
                              {fmtEur(e.amount)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {e.receipt_storage_path ? (
                                <span
                                  className="inline-flex items-center justify-center text-emerald-600"
                                  title="Justificatif présent"
                                >
                                  <FileCheck2 className="h-4 w-4" />
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center justify-center text-red-500"
                                  title="Justificatif manquant"
                                >
                                  <FileX2 className="h-4 w-4" />
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {e.source === 'ocr' ? (
                                <Badge className="bg-[#D35400]/10 text-[10px] text-[#D35400]">
                                  <Sparkles className="mr-0.5 h-3 w-3" />
                                  IA
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  {SOURCE_LABELS[e.source || 'manual']}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div
                                className="inline-flex gap-1"
                                onClick={(ev) => ev.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEdit(e)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600"
                                  onClick={() => setDeleteId(e.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ─────── FLUX ─────── */}
        <TabsContent value="flux" className="mt-4 space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Total flux
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums">{fluxStats.all}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Receipt className="h-3.5 w-3.5 text-[#D35400]" /> Dépenses
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums">{fluxStats.expCount}</p>
            </Card>
            <Card className="p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FileCheck2 className="h-3.5 w-3.5 text-blue-500" /> Factures émises
              </div>
              <p className="mt-1 text-xl font-bold tabular-nums">{fluxStats.invCount}</p>
            </Card>
            <Card className={cn('p-3', fluxStats.missing > 0 && 'border-red-200 bg-red-50/40')}>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <FileX2 className={cn('h-3.5 w-3.5', fluxStats.missing > 0 ? 'text-red-500' : 'text-muted-foreground')} />
                Justificatifs manquants
              </div>
              <p className={cn('mt-1 text-xl font-bold tabular-nums', fluxStats.missing > 0 && 'text-red-600')}>
                {fluxStats.missing}
              </p>
            </Card>
          </div>

          {/* Sub-tabs with counts */}
          <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 pb-0">
            {([
              { key: 'all', label: 'Tous', count: fluxStats.all, tone: 'neutral' },
              { key: 'draft', label: 'Brouillons', count: fluxStats.draft, tone: 'neutral' },
              { key: 'upcoming', label: 'À venir', count: fluxStats.upcoming, tone: 'neutral' },
              { key: 'late', label: 'En retard', count: fluxStats.late, tone: 'red' },
              { key: 'paid', label: 'Payées', count: fluxStats.paid, tone: 'green' },
              { key: 'missing', label: 'Justificatifs manquants', count: fluxStats.missing, tone: 'red' },
            ] as const).map((t) => {
              const active = fluxSubTab === t.key;
              const badgeTone =
                active
                  ? 'bg-[#D35400]/10 text-[#D35400]'
                  : t.tone === 'red' && t.count > 0
                  ? 'bg-red-100 text-red-700'
                  : t.tone === 'green' && t.count > 0
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-muted text-muted-foreground';
              return (
                <button
                  key={t.key}
                  onClick={() => setFluxSubTab(t.key)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors',
                    active
                      ? 'border-[#D35400] text-[#D35400]'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums', badgeTone)}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter bar */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={fluxSearch}
                  onChange={(e) => setFluxSearch(e.target.value)}
                  placeholder="Rechercher un flux, un fournisseur, un client…"
                  className="pl-9"
                />
              </div>
              <Select value={fluxType} onValueChange={(v) => setFluxType(v as typeof fluxType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="expense">Dépenses</SelectItem>
                  <SelectItem value="invoice">Factures émises</SelectItem>
                </SelectContent>
              </Select>
              <Select value={fluxPeriod} onValueChange={setFluxPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent className="max-h-96">
                  <SelectItem value="all">Toutes les périodes</SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Périodes courantes</SelectLabel>
                    {periodOptionGroups.current.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>12 derniers mois</SelectLabel>
                    {periodOptionGroups.months.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Trimestres</SelectLabel>
                    {periodOptionGroups.quarters.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Années</SelectLabel>
                    {periodOptionGroups.years.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectItem value="custom">Période personnalisée…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bandeau date range — visible uniquement quand "Période personnalisée" est sélectionnée */}
            {fluxPeriod === 'custom' && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
                <span className="text-xs font-medium text-muted-foreground">Du</span>
                <Input
                  type="date"
                  value={fluxCustomStart}
                  onChange={(e) => setFluxCustomStart(e.target.value)}
                  className="h-9 sm:w-44"
                  max={fluxCustomEnd || undefined}
                />
                <span className="text-xs font-medium text-muted-foreground">au</span>
                <Input
                  type="date"
                  value={fluxCustomEnd}
                  onChange={(e) => setFluxCustomEnd(e.target.value)}
                  className="h-9 sm:w-44"
                  min={fluxCustomStart || undefined}
                />
                {(fluxCustomStart || fluxCustomEnd) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFluxCustomStart('');
                      setFluxCustomEnd('');
                    }}
                    className="h-8 text-xs sm:ml-auto"
                  >
                    Effacer les dates
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Selection toolbar */}
          {fluxSelected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#D35400]/30 bg-orange-50/60 px-4 py-2">
              <Check className="h-4 w-4 text-[#D35400]" />
              <span className="text-sm font-medium text-[#D35400]">
                {fluxSelected.size} sélectionné{fluxSelected.size > 1 ? 's' : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                Total HT : <span className="font-semibold tabular-nums text-foreground">{fmtEur(selectedTotalHt)}</span>
              </span>
              <div className="ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFluxSelected(new Set())}
                  className="h-7 text-xs"
                >
                  Tout désélectionner
                </Button>
              </div>
            </div>
          )}

          {/* Desktop table */}
          <Card className="hidden overflow-hidden sm:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="w-10 px-3 py-2">
                      <Checkbox
                        checked={
                          pagedFlux.length > 0 &&
                          pagedFlux.every((f) => fluxSelected.has(f.key))
                        }
                        onCheckedChange={(checked) => {
                          const next = new Set(fluxSelected);
                          if (checked) pagedFlux.forEach((f) => next.add(f.key));
                          else pagedFlux.forEach((f) => next.delete(f.key));
                          setFluxSelected(next);
                        }}
                        aria-label="Tout sélectionner"
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium">Envoi</th>
                    <th
                      className="cursor-pointer select-none px-3 py-2 font-medium hover:text-foreground"
                      onClick={() => toggleFluxSort('date')}
                    >
                      <span className="inline-flex items-center gap-1">
                        Date
                        {fluxSortKey === 'date' ? (
                          fluxSortDir === 'desc' ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronUp className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    </th>
                    <th className="px-3 py-2 font-medium">Échéance</th>
                    <th className="px-3 py-2 font-medium">Document</th>
                    <th className="px-3 py-2 font-medium">Catégorie</th>
                    <th
                      className="cursor-pointer select-none px-3 py-2 text-right font-medium hover:text-foreground"
                      onClick={() => toggleFluxSort('amountHt')}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        HT
                        {fluxSortKey === 'amountHt' ? (
                          fluxSortDir === 'desc' ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronUp className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium">TVA</th>
                    <th
                      className="cursor-pointer select-none px-3 py-2 text-right font-medium hover:text-foreground"
                      onClick={() => toggleFluxSort('amountTtc')}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        TTC
                        {fluxSortKey === 'amountTtc' ? (
                          fluxSortDir === 'desc' ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronUp className="h-3 w-3" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </span>
                    </th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedFlux.map((f) => {
                    const isSelected = fluxSelected.has(f.key);
                    const isOverdueDeadline =
                      f.deadline && f.deadline < new Date().toISOString().split('T')[0] && f.statusKey !== 'paid';
                    return (
                      <tr
                        key={f.key}
                        className={cn('hover:bg-muted/10', isSelected && 'bg-[#D35400]/5')}
                      >
                        <td className="px-3 py-2.5">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const next = new Set(fluxSelected);
                              if (checked) next.add(f.key);
                              else next.delete(f.key);
                              setFluxSelected(next);
                            }}
                            aria-label={`Sélectionner ${f.label}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                                f.statusColor,
                              )}
                            >
                              {f.statusLabel}
                            </span>
                            {f.pointed && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700"
                                title="Pointée avec une transaction bancaire"
                              >
                                <Check className="h-2.5 w-2.5" />
                                Pointée
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {f.kind === 'invoice' ? (
                            f.sending === 'sent' ? (
                              <span title="Envoyée par email">
                                <MailCheck className="h-4 w-4 text-emerald-600" />
                              </span>
                            ) : (
                              <span title="Non envoyée">
                                <MailX className="h-4 w-4 text-muted-foreground/60" />
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                          {fmtDate(f.date)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {f.deadline ? (
                            <span className={cn('text-xs', isOverdueDeadline && 'font-semibold text-red-600')}>
                              {fmtDate(f.deadline)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {f.kind === 'expense' ? (
                              <Receipt className="h-3.5 w-3.5 shrink-0 text-[#D35400]" />
                            ) : (
                              <FileText className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                            )}
                            <div className="min-w-0">
                              <p className="line-clamp-1 font-medium text-foreground">{f.label}</p>
                              {f.sublabel && (
                                <p className="line-clamp-1 text-[11px] text-muted-foreground">{f.sublabel}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {f.categoryName ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {f.categoryName}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                          {fmtEur(f.amountHt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {fmtEur(f.tva)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums">
                          {fmtEur(f.amountTtc)}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-muted-foreground">{f.source}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            {f.kind === 'expense' ? (
                              <>
                                {f.hasReceipt ? (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => handleViewReceipt(f.expenseId!)}
                                      disabled={loadingReceiptId === f.expenseId}
                                      title="Voir le justificatif"
                                      className="h-7 w-7"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        handleDownloadReceipt(
                                          f.expenseId!,
                                          f.receiptFilename || `justificatif-${f.expenseId}.pdf`,
                                        )
                                      }
                                      disabled={loadingReceiptId === f.expenseId}
                                      title="Télécharger"
                                      className="h-7 w-7"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const exp = expenses.find((x) => x.id === f.expenseId);
                                      if (exp) openEdit(exp);
                                    }}
                                    className="h-7 gap-1 border-red-200 text-red-700 hover:bg-red-50"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Ajouter
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const exp = expenses.find((x) => x.id === f.expenseId);
                                    if (exp) openEdit(exp);
                                  }}
                                  title="Éditer"
                                  className="h-7 w-7"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(`/factures?open=${f.invoiceId}`, '_self')}
                                className="h-7 gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Ouvrir
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pagedFlux.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Aucun flux ne correspond aux filtres
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {pagedFlux.length === 0 ? (
              <Card className="p-6 text-center text-sm text-muted-foreground">Aucun flux</Card>
            ) : (
              pagedFlux.map((f) => (
                <Card key={f.key} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {f.kind === 'expense' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium text-[#D35400]">
                            <Receipt className="h-2.5 w-2.5" /> Dépense
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium text-blue-700">
                            <FileText className="h-2.5 w-2.5" /> Facture
                          </span>
                        )}
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium',
                            f.statusColor,
                          )}
                        >
                          {f.statusLabel}
                        </span>
                        {f.pointed && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700"
                            title="Pointée avec une transaction bancaire"
                          >
                            <Check className="h-2.5 w-2.5" />
                            Pointée
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">{f.label}</p>
                      {f.sublabel && (
                        <p className="truncate text-[11px] text-muted-foreground">{f.sublabel}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{fmtDate(f.date)}</span>
                        {f.deadline && (
                          <span>
                            · Échéance{' '}
                            <span
                              className={cn(
                                f.deadline < new Date().toISOString().split('T')[0] &&
                                  f.statusKey !== 'paid' &&
                                  'font-semibold text-red-600',
                              )}
                            >
                              {fmtDate(f.deadline)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums">{fmtEur(f.amountTtc)}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">HT {fmtEur(f.amountHt)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 border-t border-border pt-2">
                    {f.kind === 'expense' ? (
                      <>
                        {f.hasReceipt ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewReceipt(f.expenseId!)}
                              disabled={loadingReceiptId === f.expenseId}
                              className="h-7 flex-1 gap-1 text-[11px]"
                            >
                              <Eye className="h-3 w-3" /> Voir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleDownloadReceipt(
                                  f.expenseId!,
                                  f.receiptFilename || `justificatif-${f.expenseId}.pdf`,
                                )
                              }
                              disabled={loadingReceiptId === f.expenseId}
                              className="h-7 flex-1 gap-1 text-[11px]"
                            >
                              <Download className="h-3 w-3" /> PDF
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const exp = expenses.find((x) => x.id === f.expenseId);
                              if (exp) openEdit(exp);
                            }}
                            className="h-7 flex-1 gap-1 border-red-200 text-[11px] text-red-700"
                          >
                            <Plus className="h-3 w-3" /> Ajouter un justificatif
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/factures?open=${f.invoiceId}`, '_self')}
                        className="h-7 flex-1 gap-1 text-[11px]"
                      >
                        <ExternalLink className="h-3 w-3" /> Ouvrir la facture
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Pagination footer */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-3 sm:flex-row">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Par page :</span>
              <div className="flex items-center gap-1">
                {([25, 50, 100] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setFluxPageSize(n)}
                    className={cn(
                      'rounded border border-border px-2 py-0.5 tabular-nums transition-colors',
                      fluxPageSize === n
                        ? 'border-[#D35400] bg-[#D35400]/5 text-[#D35400]'
                        : 'hover:bg-muted',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="ml-2 tabular-nums">
                {filteredFlux.length === 0
                  ? '0'
                  : `${(fluxPage - 1) * fluxPageSize + 1}–${Math.min(
                      fluxPage * fluxPageSize,
                      filteredFlux.length,
                    )}`}{' '}
                sur {filteredFlux.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={fluxPage === 1}
                onClick={() => setFluxPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {renderPageNumbers(fluxPage, fluxTotalPages).map((p, i) =>
                p === 'dots' ? (
                  <span key={`dots-${i}`} className="px-1 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setFluxPage(p)}
                    className={cn(
                      'h-7 min-w-7 rounded border px-2 text-xs tabular-nums transition-colors',
                      fluxPage === p
                        ? 'border-[#D35400] bg-[#D35400]/5 text-[#D35400]'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    {p}
                  </button>
                ),
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={fluxPage === fluxTotalPages}
                onClick={() => setFluxPage((p) => Math.min(fluxTotalPages, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Ce flux centralise toutes les factures émises et les dépenses enregistrées. Importez un
            relevé bancaire depuis l&apos;onglet &laquo;&nbsp;Banque&nbsp;&raquo; pour pointer les
            écritures réellement passées en banque. Votre comptable y accède en lecture seule via
            l&apos;onglet &laquo;&nbsp;Comptable&nbsp;&raquo;.
          </p>
        </TabsContent>

        {/* ─────── BANQUE ─────── */}
        <TabsContent value="bank" className="mt-4 space-y-4">
          <BankReconciliationTab />
        </TabsContent>

        {/* ─────── RECETTES ─────── */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes années</SelectItem>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Chiffre d&apos;affaires HT
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">{fmtEur(revenueHt)}</p>
              <p className="text-[11px] text-muted-foreground">{revenueRows.length} factures payées</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Receipt className="h-4 w-4 text-blue-500" /> CA TTC
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">
                {fmtEur(revenueTtc)}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Receipt className="h-4 w-4 text-[#D35400]" /> TVA collectée
              </div>
              <p className="mt-2 text-xl font-bold tabular-nums sm:text-2xl">
                {fmtEur(revenueTva)}
              </p>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase text-muted-foreground">
              Factures payées ({revenueRows.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Numéro</th>
                    <th className="px-3 py-2 text-left font-medium">Client</th>
                    <th className="px-3 py-2 text-left font-medium">Payée le</th>
                    <th className="px-3 py-2 text-right font-medium">HT</th>
                    <th className="px-3 py-2 text-right font-medium">TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueRows.map((inv) => (
                    <tr key={inv.id} className="border-b border-border/60">
                      <td className="px-3 py-2 font-medium">{inv.invoice_number}</td>
                      <td className="px-3 py-2">{getClientName(inv.clients)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{fmtDate(inv.paid_at)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtEur(inv.total_ht)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {fmtEur(inv.total_ttc)}
                      </td>
                    </tr>
                  ))}
                  {revenueRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Aucune facture payée sur la période
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-[11px] text-muted-foreground">
            Les recettes sont alimentées automatiquement par vos factures Hellobat dès qu&apos;elles sont
            marquées comme payées.
          </p>
        </TabsContent>

        {/* ─────── TVA ─────── */}
        <TabsContent value="tva" className="mt-4">
          <TvaPanel
            expenses={expenses.map((e) => ({
              date: e.date,
              amount_ht: e.amount_ht,
              tva_amount: e.tva_amount,
              tva_rate: e.tva_rate,
              is_autoliquidation: e.is_autoliquidation,
            }))}
            invoices={invoices.map((i) => ({
              paid_at: i.paid_at,
              issued_at: i.issued_at,
              created_at: i.created_at,
              total_ht: i.total_ht,
              total_ttc: i.total_ttc,
              tva_rate: i.tva_rate,
              tva_breakdown: i.tva_breakdown,
            }))}
            tvaMethod={tvaMethod}
            vatRegime={vatRegime}
          />
        </TabsContent>

        {/* ─────── COMPTABLE ─────── */}
        <TabsContent value="accountant" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Accès comptable</h2>
              <p className="text-xs text-muted-foreground">
                Donnez à votre expert-comptable un accès lecture seule pour télécharger le FEC, les
                dépenses et les factures.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={loadAccesses}
                title="Rafraîchir"
                className="flex-shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setShowInvite(true)}
                className="gap-2 bg-[#D35400] hover:bg-[#b8470a]"
              >
                <Mail className="h-4 w-4" />
                Inviter mon comptable
              </Button>
            </div>
          </div>

          {accesses.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="Aucun accès actif"
              description="Invitez votre comptable pour qu'il puisse consulter et exporter votre comptabilité en lecture seule."
            />
          ) : (
            <div className="space-y-3">
              {accesses.map((a) => {
                const isRevoked = !!a.revoked_at;
                const isExpired = !isRevoked && new Date(a.expires_at).getTime() < Date.now();
                const isActive = !isRevoked && !isExpired;
                let scopeLabel = 'Toutes les données';
                if (a.scope === 'fiscal_year' && a.scope_year) scopeLabel = `Année ${a.scope_year}`;
                if (a.scope === 'period' && a.scope_start && a.scope_end) {
                  scopeLabel = `${fmtDate(a.scope_start)} → ${fmtDate(a.scope_end)}`;
                }
                return (
                  <Card key={a.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{a.accountant_email}</p>
                          {isRevoked && (
                            <Badge variant="outline" className="text-[10px] text-red-600">
                              Révoqué
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="outline" className="text-[10px] text-amber-600">
                              Expiré
                            </Badge>
                          )}
                          {isActive && (
                            <Badge className="bg-emerald-100 text-[10px] text-emerald-700">
                              Actif
                            </Badge>
                          )}
                        </div>
                        {a.accountant_name && (
                          <p className="text-xs text-muted-foreground">{a.accountant_name}</p>
                        )}

                        {/* Statut de connexion — visible immédiatement */}
                        {isActive && (
                          <div
                            className={cn(
                              'mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs',
                              a.last_viewed_at
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                : 'border-amber-200 bg-amber-50 text-amber-800',
                            )}
                          >
                            {a.last_viewed_at ? (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>
                                  Dernière connexion&nbsp;
                                  <span className="font-semibold">{fmtRelative(a.last_viewed_at)}</span>
                                  <span className="hidden sm:inline">
                                    {' · '}
                                    {fmtDateTime(a.last_viewed_at)}
                                  </span>
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                                <span>Pas encore consulté par votre comptable</span>
                              </>
                            )}
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expire le {fmtDate(a.expires_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {a.view_count} vue{a.view_count > 1 ? 's' : ''}
                          </span>
                          <Badge variant="secondary" className="text-[10px]">
                            {scopeLabel}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isActive && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyAccessLink(a.token)}
                              className="gap-1.5"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copier
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="gap-1.5"
                            >
                              <a
                                href={`/comptable/${a.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Ouvrir
                              </a>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setRevokeId(a.id)}
                              className="gap-1.5 text-red-600 hover:text-red-700"
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                              Révoquer
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="border-dashed bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <LinkIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Comment ça marche ?</p>
                <p className="mt-1">
                  Votre comptable reçoit un lien sécurisé personnel. Il peut consulter vos dépenses,
                  factures, et télécharger le FEC au format légal pour le bilan annuel — sans jamais
                  pouvoir modifier vos données. Vous pouvez révoquer l&apos;accès à tout moment.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ExpenseFormDialog
        open={showExpenseForm}
        onOpenChange={setShowExpenseForm}
        initialValues={expenseInitial}
        categories={categories}
        projects={projects}
        onSubmit={handleExpenseSubmit}
      />

      <AccountantInviteDialog
        open={showInvite}
        onOpenChange={setShowInvite}
        onSubmit={handleInviteSubmit}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La dépense ne pourra pas être restaurée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer l&apos;accès ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien deviendra inutilisable immédiatement. Vous pourrez toujours en créer un
              nouveau si besoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-red-600 hover:bg-red-700">
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
