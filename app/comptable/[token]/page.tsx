'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Download,
  FileText,
  Receipt,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  Building2,
  CalendarClock,
  Mail,
  ExternalLink,
  Sparkles,
  Eye,
  FileX2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { parseTvaBreakdown, formatTvaRate } from '@/lib/tva';

interface SummaryPayload {
  artisan: {
    company_name: string;
    full_name: string;
    email: string;
    siret: string;
  };
  access: {
    id: string;
    accountant_email: string;
    accountant_name: string | null;
    scope: string;
    scope_label: string;
    scope_start: string | null;
    scope_end: string | null;
    expires_at: string;
    view_count: number;
  };
  summary: {
    expenses_count: number;
    invoices_count: number;
    paid_invoices_count: number;
    total_expenses_ht: number;
    total_expenses_ttc: number;
    total_revenue_ht: number;
    total_revenue_ttc: number;
    total_tva_collectee: number;
    total_tva_deductible: number;
    tva_balance: number;
    result_estimated: number;
  };
}

interface ExpenseRow {
  id: string;
  date: string;
  description: string | null;
  supplier: string | null;
  amount_ht: number | null;
  tva_rate: number | null;
  tva_amount: number | null;
  amount: number | null;
  is_autoliquidation: boolean | null;
  payment_method: string | null;
  source: string | null;
  receipt_storage_path: string | null;
  expense_categories: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  issued_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  total_ht: number | null;
  total_ttc: number | null;
  tva_rate: number | null;
  total_tva: number | null;
  tva_breakdown: unknown;
  clients: { name: string } | { name: string }[] | null;
}

function fmtEur(n: number | null | undefined) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getCategoryName(c: ExpenseRow['expense_categories']): string {
  if (!c) return '—';
  if (Array.isArray(c)) return c[0]?.name || '—';
  return c.name || '—';
}

function getClientName(c: InvoiceRow['clients']): string {
  if (!c) return '—';
  if (Array.isArray(c)) return c[0]?.name || '—';
  return c.name || '—';
}

export default function ComptablePortalPage() {
  const params = useParams();
  const token = String(params?.token || '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [tab, setTab] = useState('synthese');
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const synthRes = await fetch(`/api/comptabilite/portal/${token}`);
      if (!synthRes.ok) {
        const j = await synthRes.json().catch(() => ({}));
        throw new Error(j.error || 'Lien invalide');
      }
      const synth = (await synthRes.json()) as SummaryPayload;
      setData(synth);

      const [expRes, invRes] = await Promise.all([
        fetch(`/api/comptabilite/portal/${token}/expenses`),
        fetch(`/api/comptabilite/portal/${token}/invoices`),
      ]);
      const expJson = expRes.ok ? await expRes.json() : { expenses: [] };
      const invJson = invRes.ok ? await invRes.json() : { invoices: [] };
      setExpenses(expJson.expenses || []);
      setInvoices(invJson.invoices || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossible de charger l'accès");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void loadAll();
  }, [token, loadAll]);

  function downloadFec() {
    window.open(`/api/comptabilite/portal/${token}/export/fec`, '_blank');
  }
  function downloadCsv(type: 'expenses' | 'invoices') {
    window.open(`/api/comptabilite/portal/${token}/export/csv?type=${type}`, '_blank');
  }
  function openReceiptsManifest() {
    window.open(`/api/comptabilite/portal/${token}/export/receipts-manifest`, '_blank');
  }

  async function fetchReceiptUrl(expenseId: string): Promise<string | null> {
    setLoadingReceiptId(expenseId);
    try {
      const res = await fetch(
        `/api/comptabilite/portal/${token}/expenses/${expenseId}/receipt-url`,
      );
      if (!res.ok) return null;
      const json = await res.json();
      return json.url as string;
    } catch {
      return null;
    } finally {
      setLoadingReceiptId(null);
    }
  }

  async function viewReceipt(expenseId: string) {
    const url = await fetchReceiptUrl(expenseId);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function downloadReceipt(expenseId: string, suggestedName: string) {
    const url = await fetchReceiptUrl(expenseId);
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = suggestedName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      // no-op
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#D35400]" />
          <p className="text-sm text-muted-foreground">Vérification de l&apos;accès…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8f5] p-6">
        <Card className="max-w-md p-8 text-center">
          <TriangleAlert className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="mt-4 text-xl font-semibold">Accès indisponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || 'Lien invalide'}</p>
          <p className="mt-4 text-xs text-muted-foreground">
            Demandez à votre client de vous renvoyer une nouvelle invitation depuis Hellobat.
          </p>
        </Card>
      </div>
    );
  }

  const artisanName = data.artisan.company_name || data.artisan.full_name || 'Artisan';

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <header className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D35400]">
                <ShieldCheck className="h-4 w-4" />
                Accès comptable sécurisé
              </div>
              <h1 className="mt-1 flex items-center gap-2 text-xl font-bold sm:text-2xl">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                {artisanName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {data.artisan.siret && <span>SIRET&nbsp;: {data.artisan.siret}</span>}
                {data.artisan.email && <span>{data.artisan.email}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:text-right">
              <div className="flex items-center gap-2 sm:justify-end">
                <Mail className="h-3.5 w-3.5" />
                <span>{data.access.accountant_email}</span>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <CalendarClock className="h-3.5 w-3.5" />
                <span>Expire le {fmtDate(data.access.expires_at)}</span>
              </div>
              <div className="sm:text-right">
                <Badge variant="secondary" className="mt-1">
                  {data.access.scope_label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="synthese">Synthèse</TabsTrigger>
            <TabsTrigger value="depenses">Dépenses</TabsTrigger>
            <TabsTrigger value="factures">Factures</TabsTrigger>
            <TabsTrigger value="exports">Exports</TabsTrigger>
          </TabsList>

          {/* SYNTHÈSE */}
          <TabsContent value="synthese" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recettes HT
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">
                  {fmtEur(data.summary.total_revenue_ht)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {data.summary.invoices_count} facture{data.summary.invoices_count > 1 ? 's' : ''}
                  {data.summary.paid_invoices_count > 0 && ` · ${data.summary.paid_invoices_count} payée${data.summary.paid_invoices_count > 1 ? 's' : ''}`}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Dépenses HT
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">
                  {fmtEur(data.summary.total_expenses_ht)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {data.summary.expenses_count} dépense{data.summary.expenses_count > 1 ? 's' : ''}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  TVA nette
                </p>
                <p
                  className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${
                    data.summary.tva_balance >= 0 ? 'text-[#D35400]' : 'text-emerald-700'
                  }`}
                >
                  {fmtEur(Math.abs(data.summary.tva_balance))}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {data.summary.tva_balance >= 0 ? 'à reverser' : 'crédit de TVA'}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Résultat estimé
                </p>
                <p
                  className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${
                    data.summary.result_estimated >= 0 ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {fmtEur(data.summary.result_estimated)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Recettes − Dépenses HT</p>
              </Card>
            </div>

            <Card className="p-4">
              <h2 className="text-sm font-semibold">Détail TVA</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span className="text-muted-foreground">TVA collectée (recettes)</span>
                  <span className="font-semibold tabular-nums">
                    {fmtEur(data.summary.total_tva_collectee)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <span className="text-muted-foreground">TVA déductible (dépenses)</span>
                  <span className="font-semibold tabular-nums">
                    {fmtEur(data.summary.total_tva_deductible)}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Estimation indicative à confirmer par vos soins. Les dépenses en autoliquidation
                ne sont pas comptées en TVA déductible côté artisan.
              </p>
            </Card>
          </TabsContent>

          {/* DÉPENSES */}
          <TabsContent value="depenses" className="mt-4">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">
                  Dépenses ({expenses.length})
                </h2>
                <Button variant="outline" size="sm" onClick={() => downloadCsv('expenses')} className="gap-2">
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
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
                      <th className="px-3 py-2 text-center font-medium">Justificatif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => {
                      const filename =
                        e.receipt_storage_path?.split('/').pop() ||
                        `justificatif-${e.id}.pdf`;
                      return (
                        <tr key={e.id} className="border-t border-border/60">
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(e.date)}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{e.supplier || '—'}</div>
                            {e.description && (
                              <div className="text-[11px] text-muted-foreground line-clamp-1">
                                {e.description}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {getCategoryName(e.expense_categories)}
                            </Badge>
                            {e.is_autoliquidation && (
                              <Badge variant="outline" className="ml-1 text-[10px]">
                                Autoliq.
                              </Badge>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtEur(e.amount_ht)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {fmtEur(e.tva_amount)}
                            {e.tva_rate != null && (
                              <span className="ml-1 text-[10px]">({Number(e.tva_rate)}%)</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {fmtEur(e.amount)}
                          </td>
                          <td className="px-3 py-2">
                            {e.receipt_storage_path ? (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => viewReceipt(e.id)}
                                  disabled={loadingReceiptId === e.id}
                                  title="Visualiser"
                                  className="h-7 w-7"
                                >
                                  {loadingReceiptId === e.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => downloadReceipt(e.id, filename)}
                                  disabled={loadingReceiptId === e.id}
                                  title="Télécharger"
                                  className="h-7 w-7"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1 text-[10px] text-red-600">
                                <FileX2 className="h-3 w-3" /> Manquant
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          Aucune dépense sur le périmètre partagé
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Cliquez sur l&apos;œil pour visualiser un justificatif ou sur la flèche pour le télécharger.
              Les liens sont valides 1 heure.
            </p>
          </TabsContent>

          {/* FACTURES */}
          <TabsContent value="factures" className="mt-4">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Factures ({invoices.length})</h2>
                <Button variant="outline" size="sm" onClick={() => downloadCsv('invoices')} className="gap-2">
                  <Download className="h-4 w-4" />
                  CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Numéro</th>
                      <th className="px-3 py-2 text-left font-medium">Client</th>
                      <th className="px-3 py-2 text-left font-medium">Émise</th>
                      <th className="px-3 py-2 text-left font-medium">Statut</th>
                      <th className="px-3 py-2 text-right font-medium">HT</th>
                      <th className="px-3 py-2 text-right font-medium">TVA</th>
                      <th className="px-3 py-2 text-right font-medium">TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const breakdown = parseTvaBreakdown(inv.tva_breakdown);
                      const totalTva =
                        inv.total_tva != null
                          ? Number(inv.total_tva)
                          : Math.max(0, Number(inv.total_ttc || 0) - Number(inv.total_ht || 0));
                      const tvaLabel =
                        breakdown.length > 1
                          ? `Multi (${breakdown.map((b) => `${b.rate}%`).join(' + ')})`
                          : inv.tva_rate != null
                            ? formatTvaRate(Number(inv.tva_rate))
                            : '—';
                      const tvaTitle =
                        breakdown.length > 1
                          ? breakdown
                              .map(
                                (b) =>
                                  `${formatTvaRate(b.rate)} sur ${fmtEur(b.base_ht)} = ${fmtEur(b.tva_amount)}`,
                              )
                              .join(' · ')
                          : undefined;
                      return (
                        <tr key={inv.id} className="border-t border-border/60">
                          <td className="px-3 py-2 font-medium">{inv.invoice_number}</td>
                          <td className="px-3 py-2">
                            <div>{getClientName(inv.clients)}</div>
                            {inv.title && (
                              <div className="text-[11px] text-muted-foreground line-clamp-1">
                                {inv.title}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtDate(inv.issued_at)}</td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={inv.paid_at || inv.status === 'paid' ? 'default' : 'secondary'}
                              className="text-[10px]"
                            >
                              {inv.paid_at || inv.status === 'paid' ? 'Payée' : inv.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtEur(inv.total_ht)}</td>
                          <td
                            className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                            title={tvaTitle}
                          >
                            {fmtEur(totalTva)}
                            <span className="ml-1 text-[10px]">({tvaLabel})</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {fmtEur(inv.total_ttc)}
                          </td>
                        </tr>
                      );
                    })}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          Aucune facture sur le périmètre partagé
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* EXPORTS */}
          <TabsContent value="exports" className="mt-4 space-y-3">
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-[#D35400]" />
                <div className="flex-1">
                  <h3 className="font-semibold">FEC — Fichier des Écritures Comptables</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Format légal (arrêté du 29/07/2013), 18 colonnes, séparateur tabulation, encodage
                    UTF-8. Couvre tous les achats, ventes et encaissements du périmètre partagé.
                  </p>
                </div>
                <Button onClick={downloadFec} className="gap-2 bg-[#D35400] hover:bg-[#b8470a]">
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <Receipt className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Dépenses CSV</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Toutes les dépenses détaillées (HT, TVA, catégorie, mode de paiement).
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => downloadCsv('expenses')}
                  className="mt-3 w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              </Card>

              <Card className="p-5">
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <h3 className="font-semibold">Factures CSV</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Toutes les factures avec statut, émission, échéance, paiement et montants.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => downloadCsv('invoices')}
                  className="mt-3 w-full gap-2"
                >
                  <Download className="h-4 w-4" />
                  Télécharger
                </Button>
              </Card>
            </div>

            <Card className="p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-[#D35400]" />
                <div className="flex-1">
                  <h3 className="font-semibold">Manifest des reçus (JSON)</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Liste JSON contenant les liens signés (valables 7 jours) vers chaque pièce
                    justificative téléchargeable. Pratique pour récupérer les reçus en lot.
                  </p>
                </div>
                <Button variant="outline" onClick={openReceiptsManifest} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Ouvrir
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <footer className="mt-10 border-t border-border pt-5 text-center text-[11px] text-muted-foreground">
          Accès en lecture seule fourni via{' '}
          <span className="font-semibold text-[#D35400]">Hellobat</span> — le logiciel des artisans
          du bâtiment.
        </footer>
      </main>
    </div>
  );
}
