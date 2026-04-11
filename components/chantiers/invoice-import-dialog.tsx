'use client';

import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileText,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { InvoiceImportItem } from '@/lib/ai/invoice-import-schema';

/* ── Types ─────────────────────────────────────────────────────────── */

interface ReviewRow extends InvoiceImportItem {
  checked: boolean;
  sourceFile: string;
  error?: string;
  duplicate?: string;
}

interface InvoiceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type Step = 'upload' | 'scanning' | 'review' | 'creating';

/* ── Helpers ───────────────────────────────────────────────────────── */

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
}

function formatAmount(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function confidenceBadge(c: number) {
  if (c >= 0.8) return <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 text-[10px]">{Math.round(c * 100)}%</Badge>;
  if (c >= 0.5) return <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">{Math.round(c * 100)}%</Badge>;
  return <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 text-[10px]">{Math.round(c * 100)}%</Badge>;
}

/* ── Component ─────────────────────────────────────────────────────── */

export function InvoiceImportDialog({ open, onOpenChange, onComplete }: InvoiceImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanCurrent, setScanCurrent] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [createInvoices, setCreateInvoices] = useState(true);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ clients: number; projects: number; invoices: number } | null>(null);

  function handleClose() {
    if (step === 'scanning' || creating) return;
    setStep('upload');
    setFiles([]);
    setRows([]);
    setResult(null);
    setScanProgress(0);
    onOpenChange(false);
  }

  function handleFilesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selected: File[] = [];
    for (let i = 0; i < e.target.files.length; i++) {
      selected.push(e.target.files[i]);
    }
    setFiles(selected);
  }

  function removeFile(index: number) {
    setFiles(function (prev) {
      const next = prev.slice();
      next.splice(index, 1);
      return next;
    });
  }

  async function handleStartScan() {
    if (files.length === 0) return;
    setStep('scanning');
    setScanProgress(0);
    setRows([]);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Session expirée, veuillez vous reconnecter.');
      setStep('upload');
      return;
    }

    const allRows: ReviewRow[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setScanCurrent(file.name);
      setScanProgress(Math.round((i / files.length) * 100));

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/ai/invoice-import', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + session.access_token },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(function () { return { error: 'Erreur inconnue' }; });
          allRows.push({
            client_name: '',
            client_address: '',
            client_city: '',
            client_postal_code: '',
            invoice_date: '',
            invoice_number: '',
            description: '',
            amount_ht: 0,
            amount_ttc: 0,
            tva_rate: 20,
            confidence: 0,
            checked: false,
            sourceFile: file.name,
            error: err.error || 'Erreur ' + res.status,
          });
          continue;
        }

        const data = await res.json();
        const items: InvoiceImportItem[] = data.extracted;

        for (let j = 0; j < items.length; j++) {
          allRows.push({
            ...items[j],
            checked: items[j].confidence >= 0.5,
            sourceFile: file.name,
          });
        }
      } catch (e) {
        allRows.push({
          client_name: '',
          client_address: '',
          client_city: '',
          client_postal_code: '',
          invoice_date: '',
          invoice_number: '',
          description: '',
          amount_ht: 0,
          amount_ttc: 0,
          tva_rate: 20,
          confidence: 0,
          checked: false,
          sourceFile: file.name,
          error: e instanceof Error ? e.message : 'Erreur réseau',
        });
      }
    }

    setScanProgress(100);
    setScanCurrent('Vérification des doublons…');

    // ── Intra-batch duplicate detection ──
    const seen = new Map<string, number>();
    for (let k = 0; k < allRows.length; k++) {
      const r = allRows[k];
      if (r.error) continue;

      // Check by invoice number
      const invoiceNum = (r.invoice_number || '').trim().toLowerCase();
      if (invoiceNum) {
        const key = 'inv:' + invoiceNum;
        if (seen.has(key)) {
          allRows[k] = { ...allRows[k], duplicate: 'Doublon dans l\'import (même n° de facture)', checked: false };
          continue;
        }
        seen.set(key, k);
      }

      // Check by fingerprint: client + address + date + amount
      const clientName = (r.client_name || '').trim().toLowerCase();
      if (clientName) {
        const fp = clientName + '|' + (r.client_address || '').trim().toLowerCase() + '|' + (r.invoice_date || '') + '|' + (r.amount_ttc || 0);
        if (seen.has(fp)) {
          allRows[k] = { ...allRows[k], duplicate: 'Doublon dans l\'import (même client, adresse, date et montant)', checked: false };
          continue;
        }
        seen.set(fp, k);
      }
    }

    // ── DB duplicate detection ──
    try {
      const validItems = allRows
        .map(function (r, idx) { return { r, idx }; })
        .filter(function (x) { return !x.r.error && !x.r.duplicate; });

      if (validItems.length > 0) {
        const res = await fetch('/api/ai/invoice-import/check-duplicates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + session.access_token,
          },
          body: JSON.stringify({
            items: validItems.map(function (x) {
              return {
                client_name: x.r.client_name,
                client_address: x.r.client_address,
                invoice_date: x.r.invoice_date,
                invoice_number: x.r.invoice_number,
                amount_ttc: x.r.amount_ttc,
              };
            }),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const dups: { index: number; reason: string }[] = data.duplicates || [];
          for (let d = 0; d < dups.length; d++) {
            const originalIdx = validItems[dups[d].index].idx;
            allRows[originalIdx] = { ...allRows[originalIdx], duplicate: dups[d].reason, checked: false };
          }
        }
      }
    } catch {
      // Duplicate check failed — continue without blocking
    }

    setRows(allRows);
    setStep('review');
  }

  function updateRow(index: number, field: string, value: string | boolean) {
    setRows(function (prev) {
      const next = prev.slice();
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleCommit() {
    const selected = rows.filter(function (r) { return r.checked && !r.error && !r.duplicate; });
    if (selected.length === 0) return;

    setStep('creating');
    setCreating(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Session expirée');
      setCreating(false);
      setStep('review');
      return;
    }

    try {
      const res = await fetch('/api/ai/invoice-import/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + session.access_token,
        },
        body: JSON.stringify({
          items: selected.map(function (r) {
            return {
              client_name: r.client_name,
              client_address: r.client_address,
              client_city: r.client_city,
              client_postal_code: r.client_postal_code,
              invoice_date: r.invoice_date,
              invoice_number: r.invoice_number,
              description: r.description,
              amount_ht: r.amount_ht,
              amount_ttc: r.amount_ttc,
              tva_rate: r.tva_rate,
              create_invoice: createInvoices,
            };
          }),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(function () { return { error: 'Erreur serveur' }; });
        toast.error(err.error || 'Erreur lors de la création');
        setCreating(false);
        setStep('review');
        return;
      }

      const data = await res.json();
      setResult(data.created);
      toast.success(data.created.projects + ' chantier' + (data.created.projects > 1 ? 's' : '') + ' créé' + (data.created.projects > 1 ? 's' : ''));
      onComplete();
    } catch {
      toast.error('Erreur réseau');
      setStep('review');
    } finally {
      setCreating(false);
    }
  }

  const checkedCount = rows.filter(function (r) { return r.checked && !r.error && !r.duplicate; }).length;
  const errorRows = rows.filter(function (r) { return !!r.error; });
  const duplicateRows = rows.filter(function (r) { return !!r.duplicate && !r.error; });
  const validRows = rows.filter(function (r) { return !r.error && !r.duplicate; });
  const allReviewable = rows.filter(function (r) { return !r.error; });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importer des factures</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Importez vos anciennes factures pour créer automatiquement les chantiers correspondants.'}
            {step === 'scanning' && 'Analyse en cours...'}
            {step === 'review' && 'Vérifiez les données extraites avant de créer les chantiers.'}
            {step === 'creating' && (result ? 'Import terminé !' : 'Création en cours...')}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-6 text-center">
              <UploadCloud className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                L'IA analysera chaque facture pour extraire le client, l'adresse et les montants.
              </p>
              <label className="cursor-pointer">
                <Button variant="outline" asChild>
                  <span>
                    <FileText className="h-4 w-4 mr-2" />
                    Sélectionner des fichiers
                  </span>
                </Button>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.csv,application/pdf,text/csv"
                  onChange={handleFilesSelect}
                  className="sr-only"
                />
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                PDF ou CSV — 10 Mo max par fichier
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-sm font-medium">{files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}</div>
                {files.map(function (f, i) {
                  const isCsv = f.name.toLowerCase().endsWith('.csv');
                  return (
                    <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{isCsv ? 'CSV' : 'PDF'}</Badge>
                      <span className="text-xs text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
                      <button type="button" onClick={function () { removeFile(i); }} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <Button
              onClick={handleStartScan}
              disabled={files.length === 0}
              className="w-full gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Lancer l'analyse IA
            </Button>
          </div>
        )}

        {/* ── Step 2: Scanning ── */}
        {step === 'scanning' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{scanCurrent}</div>
                <div className="text-xs text-muted-foreground">
                  {Math.round(scanProgress)}% — {rows.length} facture{rows.length > 1 ? 's' : ''} extraite{rows.length > 1 ? 's' : ''}
                </div>
              </div>
            </div>
            <Progress value={scanProgress} />
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 'review' && (
          <div className="space-y-4">
            {errorRows.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-red-800 mb-1">
                  <AlertCircle className="h-4 w-4" />
                  {errorRows.length} fichier{errorRows.length > 1 ? 's' : ''} en erreur
                </div>
                {errorRows.map(function (r, i) {
                  return (
                    <div key={i} className="text-xs text-red-600">
                      {r.sourceFile} : {r.error}
                    </div>
                  );
                })}
              </div>
            )}

            {duplicateRows.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-1">
                  <Copy className="h-4 w-4" />
                  {duplicateRows.length} doublon{duplicateRows.length > 1 ? 's' : ''} détecté{duplicateRows.length > 1 ? 's' : ''}
                </div>
                <p className="text-xs text-amber-600">
                  Ces lignes correspondent à des factures ou chantiers déjà existants et ont été décochées automatiquement.
                </p>
              </div>
            )}

            {allReviewable.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Aucune facture n'a pu être extraite.</p>
              </div>
            ) : (
              <>
                {/* Cards layout (responsive) */}
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {allReviewable.map(function (row, idx) {
                    const rowIndex = rows.indexOf(row);
                    const isDuplicate = !!row.duplicate;
                    return (
                      <div
                        key={idx}
                        className={
                          'rounded-lg border p-3 transition-colors ' +
                          (isDuplicate
                            ? 'bg-amber-50/50 border-amber-200 opacity-60'
                            : row.checked
                              ? 'bg-card'
                              : 'bg-muted/30 opacity-60')
                        }
                      >
                        {isDuplicate && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span className="text-[11px] font-medium text-amber-700">{row.duplicate}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={row.checked}
                            disabled={isDuplicate}
                            onCheckedChange={function (v) { updateRow(rowIndex, 'checked', !!v); }}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Input
                                value={row.client_name}
                                onChange={function (e) { updateRow(rowIndex, 'client_name', e.target.value); }}
                                className="h-7 text-sm font-medium flex-1 min-w-[120px]"
                                placeholder="Client"
                                disabled={isDuplicate && !row.checked}
                              />
                              {isDuplicate ? (
                                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px]">Doublon</Badge>
                              ) : (
                                confidenceBadge(row.confidence)
                              )}
                            </div>
                            <Input
                              value={row.client_address + (row.client_city ? ', ' + row.client_city : '') + (row.client_postal_code ? ' ' + row.client_postal_code : '')}
                              onChange={function (e) {
                                updateRow(rowIndex, 'client_address', e.target.value);
                                updateRow(rowIndex, 'client_city', '');
                                updateRow(rowIndex, 'client_postal_code', '');
                              }}
                              className="h-7 text-xs"
                              placeholder="Adresse"
                              disabled={isDuplicate && !row.checked}
                            />
                            <Input
                              value={row.description}
                              onChange={function (e) { updateRow(rowIndex, 'description', e.target.value); }}
                              className="h-7 text-xs"
                              placeholder="Description des travaux"
                              disabled={isDuplicate && !row.checked}
                            />
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{row.invoice_date || '—'}</span>
                              <span className="font-semibold text-foreground">{formatAmount(row.amount_ttc)}</span>
                              <span className="text-[10px]">{row.sourceFile}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-3 pt-2 border-t">
                  <Checkbox
                    id="create-invoices"
                    checked={createInvoices}
                    onCheckedChange={function (v) { setCreateInvoices(!!v); }}
                  />
                  <label htmlFor="create-invoices" className="text-sm cursor-pointer">
                    Créer aussi les factures dans Hellobat
                  </label>
                </div>

                <Button
                  onClick={handleCommit}
                  disabled={checkedCount === 0}
                  className="w-full gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Créer {checkedCount} chantier{checkedCount > 1 ? 's' : ''}
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Creating / Done ── */}
        {step === 'creating' && (
          <div className="py-6 text-center space-y-4">
            {!result ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Création des chantiers et clients en cours…</p>
              </>
            ) : (
              <>
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-semibold">Import terminé !</div>
                  <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                    <div>{result.projects} chantier{result.projects > 1 ? 's' : ''} créé{result.projects > 1 ? 's' : ''}</div>
                    {result.clients > 0 && <div>{result.clients} nouveau{result.clients > 1 ? 'x' : ''} client{result.clients > 1 ? 's' : ''}</div>}
                    {result.invoices > 0 && <div>{result.invoices} facture{result.invoices > 1 ? 's' : ''} créée{result.invoices > 1 ? 's' : ''}</div>}
                  </div>
                </div>
                <Button variant="outline" onClick={handleClose}>
                  Fermer
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
