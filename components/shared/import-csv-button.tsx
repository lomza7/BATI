'use client';

/**
 * ImportCsvButton — bouton "Importer" unifié (CSV + PDF) pour les pages
 * clients, prestations, devis et factures.
 *
 * Pour `quotes` et `invoices`, un sélecteur permet de basculer entre
 * import CSV (création des entités) et attachement PDF (joindre les PDF
 * d'origine aux entités déjà importées, matching par numéro dans le nom
 * du fichier).
 */

import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
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
type Mode = 'csv' | 'pdf';
type Stage = 'picker' | 'loading' | 'result';

interface ImportError {
  line: number;
  reason: string;
  hint?: string;
}

interface CsvResponse {
  success?: boolean;
  type?: ImportEntityType;
  inserted?: number;
  skipped?: number;
  total?: number;
  errors?: ImportError[];
  error?: string;
  hint?: string;
}

interface MatchedPdf {
  filename: string;
  document_id: string;
  document_number: string;
}

interface UnmatchedPdf {
  filename: string;
  reason: string;
}

interface PdfResponse {
  total?: number;
  matched?: MatchedPdf[];
  unmatched?: UnmatchedPdf[];
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
    entityLabel?: string;
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
    entityLabel: 'devis',
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
    entityLabel: 'facture',
  },
};

// ── Component ────────────────────────────────────────────────────────────────

interface ImportCsvButtonProps {
  type: ImportEntityType;
  onImported?: () => void;
  onAttached?: () => void;
  /** Compact variant: icon-only on small screens. */
  compact?: boolean;
}

export function ImportCsvButton({ type, onImported, onAttached, compact }: ImportCsvButtonProps) {
  const copy = ENTITY_COPY[type];
  const supportsPdf = type === 'quotes' || type === 'invoices';

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('csv');
  const [stage, setStage] = useState<Stage>('picker');
  const [file, setFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [csvResult, setCsvResult] = useState<CsvResponse | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStage('picker');
    setFile(null);
    setPdfFiles([]);
    setCsvResult(null);
    setPdfResult(null);
    setDragOver(false);
  }, []);

  function close() {
    setOpen(false);
    setTimeout(() => {
      reset();
      setMode('csv');
    }, 250);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    reset();
  }

  // ── CSV ────────────────────────────────────────────────────────────────────

  function pickFile(f: File | null) {
    if (!f) return;
    const ext = f.name.toLowerCase().split('.').pop() || '';
    if (!['csv', 'txt'].includes(ext)) {
      setCsvResult({
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
    setCsvResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setCsvResult({ error: 'Session expirée. Reconnectez-vous et réessayez.' });
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
      const json = (await res.json()) as CsvResponse;
      if (!res.ok) {
        setCsvResult({
          error: json.error || 'Erreur lors de l\'import',
          hint: json.hint,
        });
        setStage('result');
        return;
      }
      setCsvResult(json);
      setStage('result');
      if ((json.inserted || 0) > 0) onImported?.();
    } catch (e) {
      setCsvResult({
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

  // ── PDF ────────────────────────────────────────────────────────────────────

  function addPdfFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    setPdfFiles((prev) => {
      const seen = new Set(prev.map((f) => f.name + ':' + f.size));
      const merged = [...prev];
      for (const f of arr) {
        const key = f.name + ':' + f.size;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(f);
        }
      }
      return merged;
    });
  }

  function removePdfFile(index: number) {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function runAttach() {
    if (pdfFiles.length === 0) return;
    setStage('loading');
    setPdfResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setPdfResult({ error: 'Session expirée. Reconnectez-vous et réessayez.' });
        setStage('result');
        return;
      }
      const formData = new FormData();
      for (const f of pdfFiles) formData.append('files', f);
      const res = await fetch(`/api/import/attach-pdfs/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const json = (await res.json()) as PdfResponse;
      if (!res.ok) {
        setPdfResult({ error: json.error || 'Erreur lors de l\'envoi', hint: json.hint });
        setStage('result');
        return;
      }
      setPdfResult(json);
      setStage('result');
      if ((json.matched?.length || 0) > 0) onAttached?.();
    } catch (e) {
      setPdfResult({
        error: e instanceof Error ? e.message : 'Erreur réseau',
        hint: 'Vérifiez votre connexion et réessayez.',
      });
      setStage('result');
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  const totalPdfSize = pdfFiles.reduce((s, f) => s + f.size, 0);
  const matchedCount = pdfResult?.matched?.length || 0;
  const unmatchedCount = pdfResult?.unmatched?.length || 0;

  const headerIcon = mode === 'pdf' ? Paperclip : Upload;
  const HeaderIcon = headerIcon;
  const headerTitle = mode === 'pdf'
    ? `Attacher les PDF des ${copy.entityLabel === 'devis' ? 'devis' : 'factures'}`
    : copy.title;
  const headerSubtitle = mode === 'pdf'
    ? `PDF visibles depuis la fiche ${copy.entityLabel}`
    : `${copy.label} en quelques secondes`;

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
          <DialogTitle className="sr-only">{headerTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            {mode === 'pdf'
              ? `Joignez les PDF d'origine aux ${copy.entityLabel === 'devis' ? 'devis' : 'factures'} déjà importés.`
              : copy.description}
          </DialogDescription>

          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-3 pr-12 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <HeaderIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{headerTitle}</p>
                <p className="text-[11px] text-muted-foreground truncate">{headerSubtitle}</p>
              </div>
            </div>
          </div>

          {/* Mode toggle (CSV / PDF) — quotes & invoices uniquement, stage picker */}
          {supportsPdf && stage === 'picker' && (
            <div className="px-5 sm:px-6 pt-4">
              <div className="inline-flex w-full rounded-xl border border-border bg-muted/40 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => switchMode('csv')}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'csv'
                      ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Importer un CSV
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('pdf')}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-all ${
                    mode === 'pdf'
                      ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                      : 'text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Attacher des PDF
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">
            {stage === 'picker' && mode === 'csv' && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">{copy.description}</p>

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

            {stage === 'picker' && mode === 'pdf' && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Déposez les PDF de vos anciens {copy.entityLabel === 'devis' ? 'devis' : 'factures'}.
                  Chaque fichier est associé automatiquement par le numéro présent dans son nom.
                </p>

                <label
                  htmlFor={`attach-pdf-${type}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files) addPdfFiles(e.dataTransfer.files);
                  }}
                  className={`block rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/20 hover:border-primary/30 hover:bg-primary/5'
                  }`}
                >
                  <FileText className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Glissez vos PDF ici ou cliquez pour sélectionner
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Plusieurs fichiers acceptés · 10 Mo par PDF max
                  </p>
                  <input
                    id={`attach-pdf-${type}`}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addPdfFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>

                {pdfFiles.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {pdfFiles.length} PDF sélectionné{pdfFiles.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {(totalPdfSize / 1024 / 1024).toFixed(1)} Mo
                      </span>
                    </div>
                    <div className="rounded-xl border border-border divide-y divide-border max-h-[200px] overflow-y-auto">
                      {pdfFiles.map((f, i) => (
                        <div key={f.name + i} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-foreground truncate">{f.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePdfFile(i)}
                            className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground flex-shrink-0"
                            aria-label="Retirer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-muted/40 p-3 text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Comment ça marche :</strong> nommez vos PDF
                  avec le numéro du {copy.entityLabel} (par ex.{' '}
                  <code className="px-1 rounded bg-background">D-2024-012.pdf</code> ou{' '}
                  <code className="px-1 rounded bg-background">facture_F2024-008.pdf</code>).
                  Chaque PDF est reconnu automatiquement par son numéro.
                </div>
              </div>
            )}

            {stage === 'loading' && (
              <div className="py-12 flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-primary animate-spin" />
                </div>
                <p className="text-sm font-semibold text-foreground mt-4">
                  {mode === 'pdf' ? 'Envoi des PDF en cours…' : 'Import en cours…'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[320px]">
                  {mode === 'pdf'
                    ? 'Ne fermez pas cette fenêtre.'
                    : 'Nous lisons votre fichier, repérons les colonnes et insérons chaque ligne. Cela peut prendre quelques secondes.'}
                </p>
              </div>
            )}

            {stage === 'result' && mode === 'csv' && csvResult && (
              <div className="space-y-3">
                {csvResult.error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-700 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-red-900">{csvResult.error}</p>
                      {csvResult.hint && (
                        <p className="text-[11px] text-red-800 mt-1 leading-relaxed">{csvResult.hint}</p>
                      )}
                    </div>
                  </div>
                )}

                {csvResult.success && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-emerald-900">
                        {csvResult.inserted} ligne{(csvResult.inserted || 0) > 1 ? 's' : ''} importée
                        {(csvResult.inserted || 0) > 1 ? 's' : ''} avec succès
                      </p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        sur {csvResult.total} ligne{(csvResult.total || 0) > 1 ? 's' : ''} lue
                        {(csvResult.total || 0) > 1 ? 's' : ''} dans votre fichier.
                      </p>
                    </div>
                  </div>
                )}

                {csvResult.errors && csvResult.errors.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-amber-900">
                          {csvResult.errors.length} ligne{csvResult.errors.length > 1 ? 's' : ''} ignorée
                          {csvResult.errors.length > 1 ? 's' : ''}
                        </p>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Voici exactement ce qui n&apos;a pas fonctionné et comment le corriger :
                        </p>
                      </div>
                    </div>
                    <ul className="mt-2.5 space-y-2 max-h-64 overflow-y-auto pr-1">
                      {csvResult.errors.slice(0, 50).map((err, i) => (
                        <li key={i} className="rounded-lg bg-white border border-amber-200 p-2">
                          <p className="text-[11px] font-semibold text-amber-900">
                            {err.line > 0 ? `Ligne ${err.line}` : 'Fichier'} — {err.reason}
                          </p>
                          {err.hint && (
                            <p className="text-[10px] text-amber-800 mt-0.5 leading-snug">💡 {err.hint}</p>
                          )}
                        </li>
                      ))}
                      {csvResult.errors.length > 50 && (
                        <li className="text-[10px] text-amber-800 italic text-center">
                          … et {csvResult.errors.length - 50} autre{csvResult.errors.length - 50 > 1 ? 's' : ''}
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {stage === 'result' && mode === 'pdf' && pdfResult && (
              <div className="space-y-4">
                {pdfResult.error ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-destructive">{pdfResult.error}</p>
                        {pdfResult.hint && (
                          <p className="text-xs text-destructive/80 mt-1">{pdfResult.hint}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {matchedCount > 0 && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <p className="text-sm font-semibold text-emerald-900">
                            {matchedCount} PDF associé{matchedCount > 1 ? 's' : ''} avec succès
                          </p>
                        </div>
                        <div className="mt-3 max-h-[160px] overflow-y-auto space-y-1">
                          {pdfResult.matched?.map((m) => (
                            <div key={m.document_id} className="flex items-center justify-between text-xs">
                              <span className="text-emerald-900 truncate">{m.filename}</span>
                              <span className="text-emerald-700 font-medium flex-shrink-0 ml-2">
                                → {m.document_number}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {unmatchedCount > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-amber-600" />
                          <p className="text-sm font-semibold text-amber-900">
                            {unmatchedCount} PDF non associé{unmatchedCount > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="mt-3 max-h-[200px] overflow-y-auto space-y-2">
                          {pdfResult.unmatched?.map((u, i) => (
                            <div key={u.filename + i} className="text-xs">
                              <p className="text-amber-900 font-medium truncate">{u.filename}</p>
                              <p className="text-amber-700">{u.reason}</p>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-[11px] text-amber-800">
                          Astuce : renommez ces fichiers avec le numéro du {copy.entityLabel} et réessayez.
                        </p>
                      </div>
                    )}
                  </>
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
              {stage === 'result' && (csvResult?.success || matchedCount > 0) ? 'Terminé' : 'Annuler'}
            </button>

            {stage === 'picker' && mode === 'csv' && (
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

            {stage === 'picker' && mode === 'pdf' && (
              <button
                type="button"
                onClick={runAttach}
                disabled={pdfFiles.length === 0}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Associer {pdfFiles.length > 0 ? `(${pdfFiles.length})` : ''}
              </button>
            )}

            {stage === 'loading' && (
              <button
                type="button"
                disabled
                className="h-10 px-5 rounded-xl bg-primary/60 text-primary-foreground font-medium text-xs flex items-center gap-1.5"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {mode === 'pdf' ? 'Envoi en cours' : 'Import en cours'}
              </button>
            )}

            {stage === 'result' && (
              <button
                type="button"
                onClick={reset}
                className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all"
              >
                {mode === 'pdf' ? (
                  <>
                    <Paperclip className="h-3.5 w-3.5" />
                    Attacher d&apos;autres PDF
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    Importer un autre fichier
                  </>
                )}
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
