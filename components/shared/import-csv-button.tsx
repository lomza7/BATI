'use client';

/**
 * ImportCsvButton — drop-in "Importer" button + modal flow for the four
 * entity pages (clients, prestations, devis, factures).
 *
 * Renders an outline button next to the page's primary action. When clicked
 * it opens a modal with three states:
 *
 *   1. picker — file dropzone + accepted columns hint + sample CSV download
 *   2. loading — spinner while the API processes the file
 *   3. result  — success counts AND, if any, the per-line errors with the
 *                exact reason and a hint on how to fix the file
 *
 * The four entities all use the same backend route
 * (`/api/import/entity/:type`) so this component is fully generic — only the
 * label, accepted-headers hint and sample CSV change per type.
 */

import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  Download,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

export type ImportEntityType = 'clients' | 'services' | 'quotes' | 'invoices';

interface ImportError {
  line: number;
  reason: string;
  hint?: string;
}

interface ImportResponse {
  success?: boolean;
  type?: ImportEntityType;
  inserted?: number;
  skipped?: number;
  total?: number;
  errors?: ImportError[];
  error?: string;
  hint?: string;
}

// ── Per-entity copy ──────────────────────────────────────────────────────────

const ENTITY_COPY: Record<
  ImportEntityType,
  {
    label: string;
    title: string;
    description: string;
    expectedHeaders: string[];
    sampleFilename: string;
    sampleHeader: string;
    sampleRows: string[];
  }
> = {
  clients: {
    label: 'Vos contacts',
    title: 'Importer des contacts',
    description: 'Ajoutez vos clients, prospects et fournisseurs depuis un fichier CSV.',
    expectedHeaders: ['Nom', 'Email', 'Téléphone', 'Adresse', 'Code postal', 'Ville', 'Notes'],
    sampleFilename: 'modele-contacts-hellobat.csv',
    sampleHeader: 'Nom,Email,Téléphone,Adresse,Code postal,Ville,Notes',
    sampleRows: [
      'Jean Dupont,jean.dupont@example.com,06 12 34 56 78,15 rue de la Paix,75001,Paris,Client fidèle',
      'SARL Martin BTP,contact@martin-btp.fr,04 78 90 12 34,12 avenue des Lilas,69001,Lyon,',
    ],
  },
  services: {
    label: 'Vos prestations',
    title: 'Importer des prestations',
    description:
      'Ajoutez votre bibliothèque de prestations (services, fournitures, main d\'œuvre) depuis un CSV.',
    expectedHeaders: ['Nom', 'Description', 'Unité', 'Prix unitaire', 'Catégorie', 'TVA'],
    sampleFilename: 'modele-prestations-hellobat.csv',
    sampleHeader: 'Nom,Description,Unité,Prix unitaire,Catégorie,TVA',
    sampleRows: [
      'Pose carrelage 60x60,Pose collée sur chape existante,m2,45,00,Carrelage,20',
      'Fourniture grès cérame,Carreau 60x60 anti-dérapant,m2,32,00,Carrelage,20',
      'Dépose ancien sol,Démontage et évacuation,forfait,350,00,Démolition,20',
    ],
  },
  quotes: {
    label: 'Vos devis',
    title: 'Importer des devis',
    description:
      'Importez vos devis existants depuis votre ancien logiciel. Les contacts doivent déjà exister dans Hellobat.',
    expectedHeaders: ['Numéro', 'Client', 'Titre', 'Statut', 'Total HT', 'TVA', 'Total TTC', 'Date'],
    sampleFilename: 'modele-devis-hellobat.csv',
    sampleHeader: 'Numéro,Client,Titre,Statut,Total HT,TVA,Total TTC,Date',
    sampleRows: [
      'D-2025-001,Jean Dupont,Renovation salle de bain,accepte,2339,00,20,2806,80,15/03/2025',
      'D-2025-002,SARL Martin BTP,Pose parquet salon,envoye,1450,00,20,1740,00,22/03/2025',
    ],
  },
  invoices: {
    label: 'Vos factures',
    title: 'Importer des factures',
    description:
      'Importez vos factures existantes. Les contacts doivent déjà exister dans Hellobat.',
    expectedHeaders: [
      'Numéro',
      'Client',
      'Titre',
      'Statut',
      'Total HT',
      'TVA',
      'Total TTC',
      'Date',
      'Date échéance',
    ],
    sampleFilename: 'modele-factures-hellobat.csv',
    sampleHeader: 'Numéro,Client,Titre,Statut,Total HT,TVA,Total TTC,Date,Date échéance',
    sampleRows: [
      'F-2025-001,Jean Dupont,Renovation salle de bain,payee,2339,00,20,2806,80,15/03/2025,14/04/2025',
      'F-2025-002,SARL Martin BTP,Pose parquet salon,envoyee,1450,00,20,1740,00,22/03/2025,21/04/2025',
    ],
  },
};

// ── Component ────────────────────────────────────────────────────────────────

interface ImportCsvButtonProps {
  type: ImportEntityType;
  onImported?: () => void;
  /** Compact variant: icon-only on small screens. */
  compact?: boolean;
}

type Stage = 'picker' | 'loading' | 'result';

export function ImportCsvButton({ type, onImported, compact }: ImportCsvButtonProps) {
  const copy = ENTITY_COPY[type];
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('picker');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStage('picker');
    setFile(null);
    setResult(null);
    setDragOver(false);
  }, []);

  function close() {
    setOpen(false);
    setTimeout(reset, 250);
  }

  function pickFile(f: File | null) {
    if (!f) return;
    // Soft-validate the extension. The backend handles the real parsing.
    const ext = f.name.toLowerCase().split('.').pop() || '';
    if (!['csv', 'txt'].includes(ext)) {
      setResult({
        error: 'Format non pris en charge',
        hint: 'Exportez votre fichier au format CSV (.csv) depuis Excel ou votre logiciel.',
      });
      setStage('result');
      return;
    }
    setFile(f);
  }

  async function runImport() {
    if (!file) return;
    setStage('loading');
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setResult({ error: 'Session expirée. Reconnectez-vous et réessayez.' });
        setStage('result');
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/import/entity/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const json = (await res.json()) as ImportResponse;
      if (!res.ok) {
        setResult({
          error: json.error || 'Erreur lors de l\'import',
          hint: json.hint,
        });
        setStage('result');
        return;
      }
      setResult(json);
      setStage('result');
      if ((json.inserted || 0) > 0) onImported?.();
    } catch (e) {
      setResult({
        error: e instanceof Error ? e.message : 'Erreur réseau',
        hint: 'Vérifiez votre connexion internet et réessayez.',
      });
      setStage('result');
    }
  }

  function downloadSample() {
    const content = [copy.sampleHeader, ...copy.sampleRows].join('\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = copy.sampleFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        <span className={compact ? 'hidden sm:inline' : ''}>Importer</span>
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[92vh] p-0 gap-0 border-0 shadow-2xl overflow-hidden bg-white rounded-2xl flex flex-col">
          <DialogTitle className="sr-only">{copy.title}</DialogTitle>
          <DialogDescription className="sr-only">{copy.description}</DialogDescription>

          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Upload className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{copy.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{copy.label} en quelques secondes</p>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">
            {stage === 'picker' && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{copy.description}</p>

                {/* Dropzone */}
                <label
                  htmlFor={`import-file-${type}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) pickFile(f);
                  }}
                  className={`block rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : file
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-muted/20 hover:border-primary/30 hover:bg-primary/5'
                  }`}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="h-6 w-6 text-primary" />
                      <div className="text-left min-w-0">
                        <p className="text-sm font-medium text-foreground truncate max-w-[280px]">
                          {file.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} Ko · Cliquez pour changer
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        Déposez votre fichier CSV ici
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        ou cliquez pour parcourir vos fichiers
                      </p>
                    </>
                  )}
                  <input
                    ref={inputRef}
                    id={`import-file-${type}`}
                    type="file"
                    accept=".csv,text/csv,application/vnd.ms-excel"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0] || null)}
                  />
                </label>

                {/* Expected columns hint */}
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-[11px] font-semibold text-foreground mb-1.5">
                    Colonnes reconnues automatiquement
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {copy.expectedHeaders.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center h-5 px-2 rounded-full bg-white border border-border text-[10px] font-medium text-foreground"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
                    Les noms exacts importent peu : « E-mail », « Mail », « Courriel » sont tous reconnus.
                  </p>
                </div>

                {/* Sample download */}
                <button
                  type="button"
                  onClick={downloadSample}
                  className="w-full flex items-center justify-center gap-2 text-[11px] font-medium text-primary hover:text-primary/80 transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  Télécharger un modèle CSV vide
                </button>
              </div>
            )}

            {stage === 'loading' && (
              <div className="py-12 flex flex-col items-center text-center">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground mt-4">
                  Import en cours…
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[320px]">
                  Nous lisons votre fichier, repérons les colonnes et insérons chaque ligne. Cela peut prendre quelques secondes.
                </p>
              </div>
            )}

            {stage === 'result' && result && (
              <div className="space-y-3">
                {/* Top-level error (the API rejected the file) */}
                {result.error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-700 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-red-900">{result.error}</p>
                      {result.hint && (
                        <p className="text-[11px] text-red-800 mt-1 leading-relaxed">
                          {result.hint}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Success summary */}
                {result.success && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-900">
                        {result.inserted} ligne{(result.inserted || 0) > 1 ? 's' : ''} importée
                        {(result.inserted || 0) > 1 ? 's' : ''} avec succès
                      </p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        sur {result.total} ligne{(result.total || 0) > 1 ? 's' : ''} lue
                        {(result.total || 0) > 1 ? 's' : ''} dans votre fichier.
                      </p>
                    </div>
                  </div>
                )}

                {/* Per-line errors */}
                {result.errors && result.errors.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-amber-900">
                          {result.errors.length} ligne{result.errors.length > 1 ? 's' : ''} ignorée
                          {result.errors.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Voici exactement ce qui n&apos;a pas fonctionné et comment le corriger :
                        </p>
                      </div>
                    </div>
                    <ul className="mt-2.5 space-y-2 max-h-64 overflow-y-auto pr-1">
                      {result.errors.slice(0, 50).map((err, i) => (
                        <li
                          key={i}
                          className="rounded-lg bg-white border border-amber-200 p-2"
                        >
                          <p className="text-[11px] font-semibold text-amber-900">
                            {err.line > 0 ? `Ligne ${err.line}` : 'Fichier'} — {err.reason}
                          </p>
                          {err.hint && (
                            <p className="text-[10px] text-amber-800 mt-0.5 leading-snug">
                              💡 {err.hint}
                            </p>
                          )}
                        </li>
                      ))}
                      {result.errors.length > 50 && (
                        <li className="text-[10px] text-amber-800 italic text-center">
                          … et {result.errors.length - 50} autre{result.errors.length - 50 > 1 ? 's' : ''}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-border bg-muted/20">
            <button
              type="button"
              onClick={close}
              disabled={stage === 'loading'}
              className="h-10 px-4 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-40"
            >
              {stage === 'result' && result?.success ? 'Terminé' : 'Annuler'}
            </button>

            {stage === 'picker' && (
              <button
                type="button"
                onClick={runImport}
                disabled={!file}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="h-3.5 w-3.5" />
                Lancer l&apos;import
              </button>
            )}

            {stage === 'loading' && (
              <button
                type="button"
                disabled
                className="h-10 px-5 rounded-xl bg-primary/60 text-primary-foreground font-medium text-xs flex items-center gap-1.5"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Import en cours
              </button>
            )}

            {stage === 'result' && (
              <button
                type="button"
                onClick={() => {
                  reset();
                }}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all"
              >
                <Upload className="h-3.5 w-3.5" />
                Importer un autre fichier
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
