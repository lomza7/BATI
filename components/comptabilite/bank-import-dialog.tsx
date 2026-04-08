'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface ImportStats {
  total: number;
  inserted: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  duplicates_skipped: number;
}

interface ImportResult {
  statement: {
    id: string;
    filename: string;
    bank_name: string | null;
    period_start: string | null;
    period_end: string | null;
    transaction_count: number;
  };
  stats: ImportStats;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: ImportResult) => void;
}

const ACCEPTED_TYPES = ['.csv', '.ofx', '.qfx', 'text/csv', 'application/x-ofx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function BankImportDialog({ open, onOpenChange, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setFile(null);
    setBusy(false);
    setError(null);
    setResult(null);
  }

  function handleClose() {
    if (busy) return;
    reset();
    onOpenChange(false);
  }

  function validateFile(f: File): string | null {
    const ext = f.name.toLowerCase().split('.').pop();
    if (!ext || !['csv', 'ofx', 'qfx'].includes(ext)) {
      return 'Format non supporté. Utilisez un fichier CSV ou OFX.';
    }
    if (f.size > MAX_FILE_SIZE) {
      return 'Fichier trop volumineux (10 Mo max).';
    }
    return null;
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const f = files[0];
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError(null);
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (busy) return;
    handleFiles(e.dataTransfer.files);
  }

  async function handleImport() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/comptabilite/bank/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'import");
      }

      setResult(data);
      onImported?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer un relevé bancaire</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 className="h-6 w-6 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">Import réussi</p>
                <p className="text-xs text-emerald-800">
                  {result.statement.bank_name || 'Relevé'} — {result.stats.inserted} transaction
                  {result.stats.inserted > 1 ? 's' : ''} importée{result.stats.inserted > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Total" value={result.stats.total} />
              <StatCard label="Rapprochées" value={result.stats.matched} highlight="emerald" />
              <StatCard label="Orphelines" value={result.stats.unmatched} highlight="amber" />
              <StatCard label="Doublons" value={result.stats.duplicates_skipped} />
            </div>

            {result.stats.unmatched > 0 && (
              <p className="text-xs text-muted-foreground">
                {result.stats.unmatched} transaction{result.stats.unmatched > 1 ? 's' : ''} sans
                rapprochement automatique. Lancez la suggestion IA ou faites le rapprochement
                manuellement depuis l&apos;onglet Banque.
              </p>
            )}

            <DialogFooter>
              <Button onClick={handleClose} className="bg-[#D35400] text-white hover:bg-[#b8470a]">
                Voir les transactions
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!busy) setDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActive(false);
              }}
              onDrop={handleDrop}
              className={cn(
                'relative rounded-2xl border-2 border-dashed transition-colors',
                dragActive
                  ? 'border-[#D35400] bg-orange-50/50'
                  : 'border-border bg-card hover:border-[#D35400]/40 hover:bg-orange-50/20',
              )}
            >
              <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                {file ? (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#D35400]">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{file.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} Ko
                      </p>
                    </div>
                    {!busy && (
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Choisir un autre fichier
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-[#D35400]">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Glissez votre relevé ou cliquez pour parcourir
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Fichier CSV ou OFX exporté depuis votre banque
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      Choisir un fichier
                    </Button>
                    <p className="text-[10px] text-muted-foreground">CSV ou OFX — 10 Mo max</p>
                  </>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">Comment exporter mon relevé&nbsp;?</p>
              <p className="mt-1">
                Depuis votre espace bancaire en ligne (BNP, Société Générale, Crédit Agricole,
                LCL, Qonto, Boursorama, Revolut…), choisissez «&nbsp;Exporter&nbsp;» et sélectionnez
                le format CSV ou OFX.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-900">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={handleClose} disabled={busy}>
                Annuler
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || busy}
                className="gap-2 bg-[#D35400] text-white hover:bg-[#b8470a]"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Import en cours…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Importer
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: 'emerald' | 'amber';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 text-center',
        highlight === 'emerald' && 'border-emerald-200 bg-emerald-50',
        highlight === 'amber' && 'border-amber-200 bg-amber-50',
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-xl font-bold',
          highlight === 'emerald' && 'text-emerald-700',
          highlight === 'amber' && 'text-amber-700',
        )}
      >
        {value}
      </p>
    </div>
  );
}
