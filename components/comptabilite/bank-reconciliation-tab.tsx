'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Loader2,
  Sparkles,
  Trash2,
  Link2,
  Link2Off,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Search,
  Building2,
  CheckCircle2,
  AlertCircle,
  CircleSlash,
  MoreVertical,
  ReceiptText,
  FileText,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import { cn } from '@/lib/utils';
import { BankImportDialog } from './bank-import-dialog';

interface BankStatement {
  id: string;
  filename: string;
  format: string;
  bank_name: string | null;
  account_iban: string | null;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  transaction_count: number;
  imported_at: string;
}

interface BankTransaction {
  id: string;
  statement_id: string;
  transaction_date: string;
  value_date: string | null;
  label: string;
  amount: number;
  direction: 'credit' | 'debit';
  fitid: string | null;
  matched_at: string | null;
  matched_kind: 'expense' | 'invoice' | null;
  matched_expense_id: string | null;
  matched_invoice_id: string | null;
  match_confidence: number | null;
  match_method: 'auto' | 'ai' | 'manual' | null;
  ignored: boolean;
}

interface ExpenseCandidate {
  id: string;
  description: string | null;
  supplier: string | null;
  date: string;
  amount: number | null;
}

interface InvoiceCandidate {
  id: string;
  invoice_number: string;
  title: string | null;
  status: string | null;
  total_ttc: number | null;
  paid_at: string | null;
  issued_at: string | null;
  clients: { name: string } | { name: string }[] | null;
}

interface AiMatch {
  transaction_id: string;
  kind: 'expense' | 'invoice' | null;
  target_id: string | null;
  confidence: number;
  reasoning?: string;
}

type FilterKind = 'all' | 'matched' | 'unmatched' | 'ai' | 'ignored';

const FILTER_LABELS: Record<FilterKind, string> = {
  all: 'Toutes',
  matched: 'Rapprochées',
  unmatched: 'Orphelines',
  ai: 'Suggérées IA',
  ignored: 'Ignorées',
};

function fmtEur(n: number | null | undefined) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getClientName(c: InvoiceCandidate['clients']): string {
  if (!c) return '';
  if (Array.isArray(c)) return c[0]?.name || '';
  return c.name || '';
}

export function BankReconciliationTab() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [search, setSearch] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [statementToDelete, setStatementToDelete] = useState<BankStatement | null>(null);

  // Picker pour matching manuel
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<'expense' | 'invoice'>('expense');
  const [pickerTx, setPickerTx] = useState<BankTransaction | null>(null);

  // IA suggestions
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Map<string, AiMatch>>(new Map());

  // Maps pour afficher l'élément matché (lookup rapide)
  const [expenseMap, setExpenseMap] = useState<Map<string, ExpenseCandidate>>(new Map());
  const [invoiceMap, setInvoiceMap] = useState<Map<string, InvoiceCandidate>>(new Map());

  useEffect(() => {
    if (!user) return;
    void loadStatements();
  }, [user]);

  useEffect(() => {
    if (selectedStatementId) {
      void loadTransactions(selectedStatementId);
    } else {
      setTransactions([]);
    }
  }, [selectedStatementId]);

  async function loadStatements() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/comptabilite/bank/statements', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatements(data.statements || []);
      // Auto-sélectionne le plus récent
      if (data.statements?.length > 0 && !selectedStatementId) {
        setSelectedStatementId(data.statements[0].id);
      }
    } catch (e) {
      toast({
        title: 'Erreur de chargement',
        description: e instanceof Error ? e.message : 'Erreur',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(statementId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/comptabilite/bank/statements/${statementId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const txs = (data.transactions || []) as BankTransaction[];
      setTransactions(txs);
      // Charge les détails des dépenses/factures matchées
      await loadMatchedDetails(txs);
    } catch (e) {
      toast({
        title: 'Erreur de chargement',
        description: e instanceof Error ? e.message : 'Erreur',
        variant: 'destructive',
      });
    }
  }

  async function loadMatchedDetails(txs: BankTransaction[]) {
    const expenseIds = txs
      .map((t) => t.matched_expense_id)
      .filter((id): id is string => !!id);
    const invoiceIds = txs
      .map((t) => t.matched_invoice_id)
      .filter((id): id is string => !!id);

    const expMap = new Map<string, ExpenseCandidate>();
    const invMap = new Map<string, InvoiceCandidate>();

    if (expenseIds.length > 0) {
      const { data } = await supabase
        .from('expenses')
        .select('id, description, supplier, date, amount')
        .in('id', expenseIds);
      (data || []).forEach((e) => expMap.set(e.id, e as ExpenseCandidate));
    }
    if (invoiceIds.length > 0) {
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, title, status, total_ttc, paid_at, issued_at, clients(name)')
        .in('id', invoiceIds);
      (data || []).forEach((i) => invMap.set(i.id, i as unknown as InvoiceCandidate));
    }

    setExpenseMap(expMap);
    setInvoiceMap(invMap);
  }

  const selectedStatement = useMemo(
    () => statements.find((s) => s.id === selectedStatementId) || null,
    [statements, selectedStatementId],
  );

  const filteredTx = useMemo(() => {
    let list = transactions;
    if (filter === 'matched') list = list.filter((t) => t.matched_at && !t.ignored);
    else if (filter === 'unmatched')
      list = list.filter((t) => !t.matched_at && !t.ignored && !aiSuggestions.has(t.id));
    else if (filter === 'ai')
      list = list.filter((t) => !t.matched_at && !t.ignored && aiSuggestions.has(t.id));
    else if (filter === 'ignored') list = list.filter((t) => t.ignored);
    else list = list.filter((t) => !t.ignored);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.label.toLowerCase().includes(q));
    }
    return list;
  }, [transactions, filter, search, aiSuggestions]);

  const stats = useMemo(() => {
    const active = transactions.filter((t) => !t.ignored);
    const matched = active.filter((t) => t.matched_at).length;
    const unmatched = active.length - matched;
    return { total: active.length, matched, unmatched };
  }, [transactions]);

  // ───────────────── Actions ─────────────────

  async function authedFetch(url: string, options: RequestInit = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Session expirée');
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${session.access_token}`,
        ...(options.body && !(options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
    });
  }

  async function handleDeleteStatement() {
    if (!statementToDelete) return;
    try {
      const res = await authedFetch(`/api/comptabilite/bank/statements/${statementToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Relevé supprimé' });
      setStatementToDelete(null);
      if (selectedStatementId === statementToDelete.id) {
        setSelectedStatementId(null);
      }
      await loadStatements();
    } catch (e) {
      toast({
        title: 'Suppression impossible',
        description: e instanceof Error ? e.message : 'Erreur',
        variant: 'destructive',
      });
    }
  }

  async function handleIgnore(tx: BankTransaction, ignored: boolean) {
    try {
      const res = await authedFetch(`/api/comptabilite/bank/transactions/${tx.id}/ignore`, {
        method: 'POST',
        body: JSON.stringify({ ignored }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast({ title: ignored ? 'Transaction ignorée' : 'Transaction réactivée' });
      if (selectedStatementId) await loadTransactions(selectedStatementId);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      });
    }
  }

  async function handleUnmatch(tx: BankTransaction) {
    try {
      const res = await authedFetch(`/api/comptabilite/bank/transactions/${tx.id}/unmatch`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      toast({ title: 'Rapprochement annulé' });
      if (selectedStatementId) await loadTransactions(selectedStatementId);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      });
    }
  }

  async function handleCreateExpense(tx: BankTransaction) {
    try {
      const res = await authedFetch(
        `/api/comptabilite/bank/transactions/${tx.id}/create-expense`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({
        title: 'Dépense créée',
        description: 'Pensez à ajouter le justificatif depuis l\'onglet Dépenses.',
      });
      if (selectedStatementId) await loadTransactions(selectedStatementId);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      });
    }
  }

  async function handleApplyMatch(
    tx: BankTransaction,
    kind: 'expense' | 'invoice',
    targetId: string,
    method: 'manual' | 'ai' = 'manual',
    confidence = 1.0,
  ) {
    try {
      const res = await authedFetch(`/api/comptabilite/bank/transactions/${tx.id}/match`, {
        method: 'POST',
        body: JSON.stringify({ kind, target_id: targetId, method, confidence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Rapprochement effectué' });
      // Retire la suggestion IA appliquée
      setAiSuggestions((prev) => {
        const next = new Map(prev);
        next.delete(tx.id);
        return next;
      });
      if (selectedStatementId) await loadTransactions(selectedStatementId);
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      });
    }
  }

  async function handleAiSuggest() {
    if (!selectedStatementId) return;
    setAiBusy(true);
    try {
      const res = await authedFetch('/api/ai/bank-reconcile', {
        method: 'POST',
        body: JSON.stringify({ statement_id: selectedStatementId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const map = new Map<string, AiMatch>();
      (data.matches || []).forEach((m: AiMatch) => {
        if (m.target_id && m.kind && m.confidence >= 0.5) {
          map.set(m.transaction_id, m);
        }
      });
      setAiSuggestions(map);
      if (map.size === 0) {
        toast({ title: 'Aucune suggestion exploitable trouvée' });
      } else {
        toast({
          title: `${map.size} suggestion${map.size > 1 ? 's' : ''} IA`,
          description: 'Validez-les une par une depuis le filtre "Suggérées IA"',
        });
        setFilter('ai');
      }
    } catch (e) {
      toast({
        title: 'Erreur IA',
        description: e instanceof Error ? e.message : '',
        variant: 'destructive',
      });
    } finally {
      setAiBusy(false);
    }
  }

  // ───────────────── Render ─────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#D35400]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BankImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={() => {
          void loadStatements();
        }}
      />

      {/* En-tête + import */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold sm:text-lg">Rapprochement bancaire</h2>
          <p className="text-xs text-muted-foreground">
            Importez un relevé CSV/OFX pour pointer dépenses et factures
          </p>
        </div>
        <Button
          onClick={() => setShowImport(true)}
          className="gap-2 bg-[#D35400] text-white hover:bg-[#b8470a]"
        >
          <Plus className="h-4 w-4" />
          Importer un relevé
        </Button>
      </div>

      {statements.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucun relevé importé"
          description="Importez un fichier CSV ou OFX exporté depuis votre banque pour commencer le rapprochement."
        >
          <Button
            onClick={() => setShowImport(true)}
            className="gap-2 bg-[#D35400] text-white hover:bg-[#b8470a]"
          >
            <Plus className="h-4 w-4" />
            Importer un relevé
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* Liste des relevés */}
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Relevés importés
            </div>
            <div className="divide-y">
              {statements.map((s) => {
                const isActive = s.id === selectedStatementId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStatementId(s.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-orange-50/50',
                      isActive && 'bg-orange-50',
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isActive ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0 text-[#D35400]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {s.bank_name || s.filename}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {fmtDate(s.period_start)} → {fmtDate(s.period_end)} ·{' '}
                          {s.transaction_count} transaction
                          {s.transaction_count > 1 ? 's' : ''} · {s.format.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatementToDelete(s);
                      }}
                      className="flex-shrink-0 rounded p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </button>
                );
              })}
            </div>
          </Card>

          {selectedStatement && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Total</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{stats.total}</p>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="text-[11px] uppercase text-emerald-700">Rapprochées</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
                    {stats.matched}
                  </p>
                </Card>
                <Card className="border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-[11px] uppercase text-amber-700">Orphelines</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-amber-700">
                    {stats.unmatched}
                  </p>
                </Card>
              </div>

              {/* Filtres + recherche + IA */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(FILTER_LABELS) as FilterKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setFilter(k)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        filter === k
                          ? 'border-[#D35400] bg-[#D35400] text-white'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {FILTER_LABELS[k]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1 sm:w-56 sm:flex-none">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un libellé…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 pl-8 text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleAiSuggest}
                    disabled={aiBusy || stats.unmatched === 0}
                    variant="outline"
                    className="gap-2 border-[#D35400]/40 text-[#D35400] hover:bg-orange-50"
                  >
                    {aiBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Suggérer avec IA</span>
                    <span className="sm:hidden">IA</span>
                  </Button>
                </div>
              </div>

              {/* Tableau / cartes mobile */}
              {filteredTx.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground">
                  Aucune transaction ne correspond à ce filtre.
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  {/* Vue desktop */}
                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Libellé</th>
                          <th className="px-3 py-2 text-right font-medium">Débit</th>
                          <th className="px-3 py-2 text-right font-medium">Crédit</th>
                          <th className="px-3 py-2 font-medium">Statut</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredTx.map((tx) => (
                          <TransactionRow
                            key={tx.id}
                            tx={tx}
                            expense={
                              tx.matched_expense_id
                                ? expenseMap.get(tx.matched_expense_id) || null
                                : null
                            }
                            invoice={
                              tx.matched_invoice_id
                                ? invoiceMap.get(tx.matched_invoice_id) || null
                                : null
                            }
                            aiSuggestion={aiSuggestions.get(tx.id) || null}
                            onMatchManual={(kind) => {
                              setPickerTx(tx);
                              setPickerKind(kind);
                              setPickerOpen(true);
                            }}
                            onApplyAi={(s) => {
                              if (s.kind && s.target_id) {
                                void handleApplyMatch(
                                  tx,
                                  s.kind,
                                  s.target_id,
                                  'ai',
                                  s.confidence,
                                );
                              }
                            }}
                            onCreateExpense={() => handleCreateExpense(tx)}
                            onUnmatch={() => handleUnmatch(tx)}
                            onIgnore={(v) => handleIgnore(tx, v)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vue mobile */}
                  <div className="divide-y md:hidden">
                    {filteredTx.map((tx) => (
                      <TransactionMobileCard
                        key={tx.id}
                        tx={tx}
                        expense={
                          tx.matched_expense_id
                            ? expenseMap.get(tx.matched_expense_id) || null
                            : null
                        }
                        invoice={
                          tx.matched_invoice_id
                            ? invoiceMap.get(tx.matched_invoice_id) || null
                            : null
                        }
                        aiSuggestion={aiSuggestions.get(tx.id) || null}
                        onMatchManual={(kind) => {
                          setPickerTx(tx);
                          setPickerKind(kind);
                          setPickerOpen(true);
                        }}
                        onApplyAi={(s) => {
                          if (s.kind && s.target_id) {
                            void handleApplyMatch(tx, s.kind, s.target_id, 'ai', s.confidence);
                          }
                        }}
                        onCreateExpense={() => handleCreateExpense(tx)}
                        onUnmatch={() => handleUnmatch(tx)}
                        onIgnore={(v) => handleIgnore(tx, v)}
                      />
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}

      {/* Picker pour matching manuel */}
      {pickerTx && (
        <MatchPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          tx={pickerTx}
          kind={pickerKind}
          onPick={(targetId) => {
            void handleApplyMatch(pickerTx, pickerKind, targetId, 'manual', 1.0);
            setPickerOpen(false);
          }}
        />
      )}

      {/* Confirm suppression relevé */}
      <AlertDialog
        open={!!statementToDelete}
        onOpenChange={(o) => !o && setStatementToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce relevé&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              Toutes les transactions de ce relevé seront supprimées. Les rapprochements existants
              seront annulés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStatement}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ───────────────── Sub-components ─────────────────

interface RowProps {
  tx: BankTransaction;
  expense: ExpenseCandidate | null;
  invoice: InvoiceCandidate | null;
  aiSuggestion: AiMatch | null;
  onMatchManual: (kind: 'expense' | 'invoice') => void;
  onApplyAi: (s: AiMatch) => void;
  onCreateExpense: () => void;
  onUnmatch: () => void;
  onIgnore: (ignored: boolean) => void;
}

function StatusBadge({
  tx,
  ai,
}: {
  tx: BankTransaction;
  ai: AiMatch | null;
}) {
  if (tx.ignored) {
    return (
      <Badge className="border-gray-200 bg-gray-100 text-gray-700">
        <CircleSlash className="mr-1 h-3 w-3" />
        Ignorée
      </Badge>
    );
  }
  if (tx.matched_at) {
    if (tx.match_method === 'auto') {
      return (
        <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Auto
        </Badge>
      );
    }
    if (tx.match_method === 'ai') {
      return (
        <Badge className="border-purple-200 bg-purple-100 text-purple-800">
          <Sparkles className="mr-1 h-3 w-3" />
          IA validée
        </Badge>
      );
    }
    return (
      <Badge className="border-blue-200 bg-blue-100 text-blue-800">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Manuelle
      </Badge>
    );
  }
  if (ai) {
    return (
      <Badge className="border-purple-200 bg-purple-100 text-purple-800">
        <Sparkles className="mr-1 h-3 w-3" />
        IA {Math.round(ai.confidence * 100)}%
      </Badge>
    );
  }
  return (
    <Badge className="border-amber-200 bg-amber-100 text-amber-800">
      <AlertCircle className="mr-1 h-3 w-3" />
      Orpheline
    </Badge>
  );
}

function MatchedLabel({
  tx,
  expense,
  invoice,
}: {
  tx: BankTransaction;
  expense: ExpenseCandidate | null;
  invoice: InvoiceCandidate | null;
}) {
  if (tx.matched_kind === 'expense' && expense) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
        <ReceiptText className="h-3 w-3" />
        {expense.supplier || expense.description || 'Dépense'}
      </span>
    );
  }
  if (tx.matched_kind === 'invoice' && invoice) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
        <FileText className="h-3 w-3" />
        {invoice.invoice_number} · {getClientName(invoice.clients)}
      </span>
    );
  }
  return null;
}

function TransactionRow({
  tx,
  expense,
  invoice,
  aiSuggestion,
  onMatchManual,
  onApplyAi,
  onCreateExpense,
  onUnmatch,
  onIgnore,
}: RowProps) {
  const isDebit = tx.direction === 'debit';
  const amount = Math.abs(Number(tx.amount));

  return (
    <tr className={cn('hover:bg-muted/30', tx.ignored && 'opacity-60')}>
      <td className="whitespace-nowrap px-3 py-2 text-xs">{fmtDate(tx.transaction_date)}</td>
      <td className="px-3 py-2">
        <p className="line-clamp-2 text-sm">{tx.label}</p>
        <MatchedLabel tx={tx} expense={expense} invoice={invoice} />
        {aiSuggestion?.reasoning && !tx.matched_at && (
          <p className="mt-1 text-[11px] text-purple-700">
            <Sparkles className="mr-1 inline h-3 w-3" />
            {aiSuggestion.reasoning}
          </p>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-red-600">
        {isDebit ? fmtEur(amount) : ''}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-sm tabular-nums text-emerald-600">
        {!isDebit ? fmtEur(amount) : ''}
      </td>
      <td className="px-3 py-2">
        <StatusBadge tx={tx} ai={aiSuggestion} />
      </td>
      <td className="px-3 py-2 text-right">
        <RowActions
          tx={tx}
          aiSuggestion={aiSuggestion}
          onMatchManual={onMatchManual}
          onApplyAi={onApplyAi}
          onCreateExpense={onCreateExpense}
          onUnmatch={onUnmatch}
          onIgnore={onIgnore}
        />
      </td>
    </tr>
  );
}

function TransactionMobileCard({
  tx,
  expense,
  invoice,
  aiSuggestion,
  onMatchManual,
  onApplyAi,
  onCreateExpense,
  onUnmatch,
  onIgnore,
}: RowProps) {
  const isDebit = tx.direction === 'debit';
  const amount = Math.abs(Number(tx.amount));

  return (
    <div className={cn('p-3', tx.ignored && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">{fmtDate(tx.transaction_date)}</p>
          <p className="mt-0.5 line-clamp-2 text-sm font-medium">{tx.label}</p>
          <MatchedLabel tx={tx} expense={expense} invoice={invoice} />
          {aiSuggestion?.reasoning && !tx.matched_at && (
            <p className="mt-1 text-[11px] text-purple-700">
              <Sparkles className="mr-1 inline h-3 w-3" />
              {aiSuggestion.reasoning}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              isDebit ? 'text-red-600' : 'text-emerald-600',
            )}
          >
            {isDebit ? '−' : '+'}
            {fmtEur(amount)}
          </span>
          <RowActions
            tx={tx}
            aiSuggestion={aiSuggestion}
            onMatchManual={onMatchManual}
            onApplyAi={onApplyAi}
            onCreateExpense={onCreateExpense}
            onUnmatch={onUnmatch}
            onIgnore={onIgnore}
          />
        </div>
      </div>
      <div className="mt-2">
        <StatusBadge tx={tx} ai={aiSuggestion} />
      </div>
    </div>
  );
}

function RowActions({
  tx,
  aiSuggestion,
  onMatchManual,
  onApplyAi,
  onCreateExpense,
  onUnmatch,
  onIgnore,
}: {
  tx: BankTransaction;
  aiSuggestion: AiMatch | null;
  onMatchManual: (kind: 'expense' | 'invoice') => void;
  onApplyAi: (s: AiMatch) => void;
  onCreateExpense: () => void;
  onUnmatch: () => void;
  onIgnore: (ignored: boolean) => void;
}) {
  const isDebit = tx.direction === 'debit';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {tx.matched_at ? (
          <DropdownMenuItem onClick={onUnmatch} className="text-red-600">
            <Link2Off className="mr-2 h-4 w-4" />
            Annuler le rapprochement
          </DropdownMenuItem>
        ) : (
          <>
            {aiSuggestion && (
              <>
                <DropdownMenuItem onClick={() => onApplyAi(aiSuggestion)}>
                  <Sparkles className="mr-2 h-4 w-4 text-purple-600" />
                  Valider la suggestion IA
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {isDebit ? (
              <>
                <DropdownMenuItem onClick={() => onMatchManual('expense')}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Lier à une dépense
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCreateExpense}>
                  <Plus className="mr-2 h-4 w-4" />
                  Créer une dépense
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => onMatchManual('invoice')}>
                <Link2 className="mr-2 h-4 w-4" />
                Lier à une facture
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onIgnore(true)}>
              <EyeOff className="mr-2 h-4 w-4" />
              Ignorer
            </DropdownMenuItem>
          </>
        )}
        {tx.ignored && (
          <DropdownMenuItem onClick={() => onIgnore(false)}>
            Réactiver
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ───────────────── MatchPickerDialog ─────────────────

interface PickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tx: BankTransaction;
  kind: 'expense' | 'invoice';
  onPick: (targetId: string) => void;
}

function MatchPickerDialog({ open, onOpenChange, tx, kind, onPick }: PickerProps) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseCandidate[]>([]);
  const [invoices, setInvoices] = useState<InvoiceCandidate[]>([]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, kind]);

  async function load() {
    setLoading(true);
    try {
      if (kind === 'expense') {
        const { data } = await supabase
          .from('expenses')
          .select('id, description, supplier, date, amount')
          .is('bank_transaction_id', null)
          .order('date', { ascending: false })
          .limit(200);
        setExpenses((data || []) as ExpenseCandidate[]);
      } else {
        const { data } = await supabase
          .from('invoices')
          .select(
            'id, invoice_number, title, status, total_ttc, paid_at, issued_at, clients(name)',
          )
          .is('bank_transaction_id', null)
          .order('issued_at', { ascending: false, nullsFirst: false })
          .limit(200);
        setInvoices((data || []) as unknown as InvoiceCandidate[]);
      }
    } finally {
      setLoading(false);
    }
  }

  const txAmount = Math.abs(Number(tx.amount));

  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.supplier || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q),
      );
    }
    // Tri : montants exacts en premier
    return [...list].sort((a, b) => {
      const aMatch = Math.abs(Number(a.amount || 0) - txAmount) < 0.01 ? 1 : 0;
      const bMatch = Math.abs(Number(b.amount || 0) - txAmount) < 0.01 ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [expenses, search, txAmount]);

  const filteredInvoices = useMemo(() => {
    let list = invoices;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(q) ||
          (i.title || '').toLowerCase().includes(q) ||
          getClientName(i.clients).toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const aMatch = Math.abs(Number(a.total_ttc || 0) - txAmount) < 0.01 ? 1 : 0;
      const bMatch = Math.abs(Number(b.total_ttc || 0) - txAmount) < 0.01 ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [invoices, search, txAmount]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Lier à une {kind === 'expense' ? 'dépense' : 'facture'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-xl bg-muted/40 p-3 text-xs">
            <p className="font-semibold text-foreground">Transaction</p>
            <p className="mt-1 text-muted-foreground">
              {fmtDate(tx.transaction_date)} — {tx.label}
            </p>
            <p
              className={cn(
                'mt-1 text-sm font-bold tabular-nums',
                tx.direction === 'debit' ? 'text-red-600' : 'text-emerald-600',
              )}
            >
              {tx.direction === 'debit' ? '−' : '+'}
              {fmtEur(txAmount)}
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                kind === 'expense'
                  ? 'Rechercher fournisseur ou description…'
                  : 'Rechercher numéro, titre ou client…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-xl border">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#D35400]" />
              </div>
            ) : kind === 'expense' ? (
              filteredExpenses.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Aucune dépense disponible.
                </p>
              ) : (
                <div className="divide-y">
                  {filteredExpenses.map((e) => {
                    const isMatch = Math.abs(Number(e.amount || 0) - txAmount) < 0.01;
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onPick(e.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-orange-50/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {e.supplier || 'Sans fournisseur'}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {fmtDate(e.date)}
                            {e.description ? ` · ${e.description}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              'text-sm font-semibold tabular-nums',
                              isMatch && 'text-emerald-600',
                            )}
                          >
                            {fmtEur(Number(e.amount || 0))}
                          </span>
                          {isMatch && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : filteredInvoices.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Aucune facture disponible.
              </p>
            ) : (
              <div className="divide-y">
                {filteredInvoices.map((i) => {
                  const isMatch = Math.abs(Number(i.total_ttc || 0) - txAmount) < 0.01;
                  return (
                    <button
                      key={i.id}
                      type="button"
                      onClick={() => onPick(i.id)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-orange-50/50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {i.invoice_number} · {getClientName(i.clients) || '—'}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {fmtDate(i.issued_at)}
                          {i.title ? ` · ${i.title}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <span
                          className={cn(
                            'text-sm font-semibold tabular-nums',
                            isMatch && 'text-emerald-600',
                          )}
                        >
                          {fmtEur(Number(i.total_ttc || 0))}
                        </span>
                        {isMatch && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
