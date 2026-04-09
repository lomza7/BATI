'use client';

/**
 * ImportModal — multi-step modal that lets a user migrate data from
 * Constructeur (or any compatible CSV/Excel export) into Hellobat.
 *
 * Flow:
 *   1. Software picker — Constructeur (featured), other software, generic CSV.
 *   2. Instructions — explains how to export each file from Constructeur.
 *   3. Dropzones — one per entity (clients, devis, factures, bibliothèque).
 *   4. Preview — shows the parsed counts + per-row errors.
 *   5. Confirm — actual import call, then a success state with counts.
 *
 * Used from two places:
 *   - The onboarding step `step-import.tsx`
 *   - The settings page (`/parametres`) — re-import after onboarding
 *
 * `onComplete` is called with the final counts so the parent can persist
 * them or trigger a celebratory toast.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  FileSpreadsheet,
  Users,
  FileText,
  Receipt,
  Package,
  Loader2,
  Info,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

type Software = 'constructeur' | 'excel' | 'other';
type Step = 'pick' | 'instructions' | 'upload' | 'preview' | 'done';

interface ImportFiles {
  clients: File | null;
  quotes: File | null;
  invoices: File | null;
  /** Bibliothèque de prix → mapped to the `services` table. */
  services: File | null;
}

interface PreviewResponse {
  counts: {
    clients: number;
    quotes: number;
    invoices: number;
    services: number;
    errors: number;
  };
  clients: { rows: unknown[]; errors: { line: number; reason: string }[] } | null;
  quotes: { rows: unknown[]; errors: { line: number; reason: string }[] } | null;
  invoices: { rows: unknown[]; errors: { line: number; reason: string }[] } | null;
  services: { rows: unknown[]; errors: { line: number; reason: string }[] } | null;
}

interface CommitResponse {
  success: boolean;
  counts: {
    clients: { inserted: number; skipped: number };
    quotes: { inserted: number; skipped: number };
    invoices: { inserted: number; skipped: number };
    services: { inserted: number; skipped: number };
  };
}

// ── Software catalogue (Constructeur featured) ──────────────────────────────

const SOFTWARE_OPTIONS: {
  id: Software;
  name: string;
  badge?: string;
  description: string;
  icon: typeof FileSpreadsheet;
}[] = [
  {
    id: 'constructeur',
    name: 'Constructeur',
    badge: 'Le plus utilisé',
    description: 'Export CSV de vos clients, devis et factures',
    icon: Sparkles,
  },
  {
    id: 'excel',
    name: 'Excel / Google Sheets',
    description: 'Vos données dans des tableurs au format CSV',
    icon: FileSpreadsheet,
  },
  {
    id: 'other',
    name: 'Autre logiciel',
    description: 'Tout export CSV — Obat, EBP, Sage, Henrri…',
    icon: FileText,
  },
];

// ── Component ────────────────────────────────────────────────────────────────

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (counts: CommitResponse['counts']) => void;
  /**
   * When set, the modal skips the software-picker step and starts directly at
   * the relevant entry point. `'constructeur'` → instructions screen,
   * everything else → upload screen.
   */
  initialSoftware?: Software | null;
}

export function ImportModal({
  open,
  onOpenChange,
  onComplete,
  initialSoftware = null,
}: ImportModalProps) {
  const [step, setStep] = useState<Step>('pick');
  const [software, setSoftware] = useState<Software | null>(null);
  const [files, setFiles] = useState<ImportFiles>({
    clients: null,
    quotes: null,
    invoices: null,
    services: null,
  });
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(initialSoftware ? (initialSoftware === 'constructeur' ? 'instructions' : 'upload') : 'pick');
    setSoftware(initialSoftware);
    setFiles({ clients: null, quotes: null, invoices: null, services: null });
    setPreview(null);
    setCommitResult(null);
    setError(null);
    setLoading(false);
  }, [initialSoftware]);

  // When the modal opens with a pre-selected software, jump straight to the
  // right step instead of forcing the user through the picker.
  useEffect(() => {
    if (open && initialSoftware) {
      setSoftware(initialSoftware);
      setStep(initialSoftware === 'constructeur' ? 'instructions' : 'upload');
    } else if (open && !initialSoftware) {
      setStep('pick');
    }
  }, [open, initialSoftware]);

  function close() {
    onOpenChange(false);
    // Delay reset so the closing animation looks clean
    setTimeout(reset, 300);
  }

  function handleSoftwarePick(id: Software) {
    setSoftware(id);
    // Constructeur has tailored instructions; the others go straight to upload.
    setStep(id === 'constructeur' ? 'instructions' : 'upload');
  }

  function setFile(key: keyof ImportFiles, file: File | null) {
    setFiles((prev) => ({ ...prev, [key]: file }));
    // If user changes a file after a preview, invalidate it.
    setPreview(null);
  }

  async function runPreview() {
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      if (files.clients) formData.append('clients', files.clients);
      if (files.quotes) formData.append('quotes', files.quotes);
      if (files.invoices) formData.append('invoices', files.invoices);
      if (files.services) formData.append('services', files.services);
      if (!files.clients && !files.quotes && !files.invoices && !files.services) {
        throw new Error('Veuillez joindre au moins un fichier.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Session expirée. Reconnectez-vous.');

      const res = await fetch('/api/import/constructeur/preview', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur lors de la prévisualisation');
      setPreview(json as PreviewResponse);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }

  async function runCommit() {
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      if (files.clients) formData.append('clients', files.clients);
      if (files.quotes) formData.append('quotes', files.quotes);
      if (files.invoices) formData.append('invoices', files.invoices);
      if (files.services) formData.append('services', files.services);

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error('Session expirée. Reconnectez-vous.');

      const res = await fetch('/api/import/constructeur/commit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de l'import");
      setCommitResult(json as CommitResponse);
      setStep('done');
      onComplete?.((json as CommitResponse).counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        className="w-[calc(100vw-2rem)] sm:max-w-[640px] max-h-[92vh] p-0 gap-0 border-0 shadow-2xl overflow-hidden bg-white rounded-2xl flex flex-col"
      >
        <DialogTitle className="sr-only">Importer mes données</DialogTitle>
        <DialogDescription className="sr-only">
          Migrez vos clients, devis et factures depuis votre ancien logiciel.
        </DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Upload className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {step === 'pick' && 'Importer mes données'}
                {step === 'instructions' && 'Exporter depuis Constructeur'}
                {step === 'upload' && 'Joindre vos fichiers'}
                {step === 'preview' && 'Vérification'}
                {step === 'done' && 'Import terminé'}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {step === 'done'
                  ? 'Vos données sont prêtes dans Hellobat'
                  : 'Migrez vos clients, devis et factures'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5">
          {step === 'pick' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-3">
                D&apos;où viennent vos données ?
              </p>
              {SOFTWARE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSoftwarePick(opt.id)}
                    className="w-full text-left rounded-2xl border border-border bg-white hover:border-primary/30 hover:bg-primary/5 transition-all p-4 flex items-center gap-3 group"
                  >
                    <div className="h-11 w-11 rounded-xl bg-muted/50 group-hover:bg-primary/10 flex items-center justify-center flex-shrink-0 transition-all">
                      <Icon className="h-5 w-5 text-foreground group-hover:text-primary transition-all" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">
                          {opt.name}
                        </p>
                        {opt.badge && (
                          <span className="inline-flex items-center h-5 px-2 rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-all flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {step === 'instructions' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-white border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Info className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Comment exporter depuis Constructeur
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Suivez ces étapes pour récupérer vos fichiers CSV.
                    </p>
                  </div>
                </div>
              </div>

              <ol className="space-y-2.5">
                {[
                  {
                    title: 'Connectez-vous à Constructeur',
                    detail: 'Ouvrez votre compte sur app.constructeur.fr',
                  },
                  {
                    title: 'Allez dans Paramètres → Exports',
                    detail: 'Le bouton se trouve dans le menu utilisateur en haut à droite.',
                  },
                  {
                    title: 'Téléchargez 3 exports CSV',
                    detail: 'Contacts, Devis, Factures — un fichier par catégorie.',
                  },
                  {
                    title: 'Revenez ici et joignez les fichiers',
                    detail: 'Hellobat reconnaîtra automatiquement les colonnes.',
                  },
                ].map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3"
                  >
                    <div className="h-6 w-6 rounded-full bg-primary text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{s.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {s.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground mb-1">
                Joignez les fichiers que vous souhaitez importer. Les autres
                seront simplement ignorés.
              </p>
              <DropzoneCard
                icon={Users}
                title="Clients"
                description="Tous vos clients et prospects"
                file={files.clients}
                onChange={(f) => setFile('clients', f)}
              />
              <DropzoneCard
                icon={FileText}
                title="Devis"
                description="Vos devis avec leurs statuts"
                file={files.quotes}
                onChange={(f) => setFile('quotes', f)}
              />
              <DropzoneCard
                icon={Receipt}
                title="Factures"
                description="Toutes vos factures émises"
                file={files.invoices}
                onChange={(f) => setFile('invoices', f)}
              />
              <DropzoneCard
                icon={Package}
                title="Bibliothèque de prix"
                description="Vos prestations, fournitures et tarifs réutilisables"
                file={files.services}
                onChange={(f) => setFile('services', f)}
              />
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <PreviewStat
                  icon={Users}
                  label="Clients"
                  value={preview.counts.clients}
                />
                <PreviewStat
                  icon={FileText}
                  label="Devis"
                  value={preview.counts.quotes}
                />
                <PreviewStat
                  icon={Receipt}
                  label="Factures"
                  value={preview.counts.invoices}
                />
                <PreviewStat
                  icon={Package}
                  label="Prestations"
                  value={preview.counts.services}
                />
              </div>

              {preview.counts.errors > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-amber-900">
                        {preview.counts.errors} ligne(s) ignorée(s)
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Ces lignes seront sautées car des champs essentiels manquent.
                      </p>
                      <PreviewErrors preview={preview} />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-emerald-900">
                    Tout est prêt à être importé
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Vos numéros de devis et factures seront re-séquencés selon
                    votre numérotation Hellobat.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'done' && commitResult && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <p className="text-base font-semibold text-foreground">
                  Import terminé !
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vos données sont disponibles dans Hellobat.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <PreviewStat
                  icon={Users}
                  label="Clients"
                  value={commitResult.counts.clients.inserted}
                />
                <PreviewStat
                  icon={FileText}
                  label="Devis"
                  value={commitResult.counts.quotes.inserted}
                />
                <PreviewStat
                  icon={Receipt}
                  label="Factures"
                  value={commitResult.counts.invoices.inserted}
                />
                <PreviewStat
                  icon={Package}
                  label="Prestations"
                  value={commitResult.counts.services.inserted}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-700 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-900">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={() => {
              if (step === 'pick' || step === 'done') return close();
              // If the user landed straight on instructions/upload via the
              // showcase pre-selection, "Retour" should close the modal — there
              // is no picker step to go back to.
              if (step === 'instructions') {
                return initialSoftware ? close() : setStep('pick');
              }
              if (step === 'upload') {
                if (software === 'constructeur') return setStep('instructions');
                return initialSoftware ? close() : setStep('pick');
              }
              if (step === 'preview') return setStep('upload');
            }}
            disabled={loading}
            className="h-10 px-4 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all flex items-center gap-1.5 disabled:opacity-40"
          >
            {step === 'pick' || step === 'done' ? (
              'Fermer'
            ) : (
              <>
                <ArrowLeft className="h-3.5 w-3.5" />
                Retour
              </>
            )}
          </button>

          {step === 'instructions' && (
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all"
            >
              J&apos;ai mes fichiers
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {step === 'upload' && (
            <button
              type="button"
              onClick={runPreview}
              disabled={
                loading || (!files.clients && !files.quotes && !files.invoices && !files.services)
              }
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyse…
                </>
              ) : (
                <>
                  Vérifier
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}

          {step === 'preview' && (
            <button
              type="button"
              onClick={runCommit}
              disabled={loading}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 hover:bg-primary/90 transition-all disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Import en cours…
                </>
              ) : (
                <>
                  Confirmer l&apos;import
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          )}

          {step === 'done' && (
            <button
              type="button"
              onClick={close}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 transition-all"
            >
              Terminé
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function DropzoneCard({
  icon: Icon,
  title,
  description,
  file,
  onChange,
  disabled,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled?: boolean;
}) {
  const inputId = `import-${title.toLowerCase().replace(/[^a-z]/g, '-')}`;

  return (
    <label
      htmlFor={inputId}
      className={`block rounded-2xl border p-3 transition-all ${
        disabled
          ? 'border-border bg-muted/10 opacity-60 cursor-not-allowed'
          : file
            ? 'border-primary/30 bg-primary/5 cursor-pointer'
            : 'border-border bg-white hover:border-primary/30 hover:bg-primary/5 cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            file ? 'bg-primary/10' : 'bg-muted/50'
          }`}
        >
          <Icon
            className={`h-4.5 w-4.5 ${file ? 'text-primary' : 'text-foreground'}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {file ? file.name : description}
          </p>
        </div>
        {file && !disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onChange(null);
            }}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          !disabled && (
            <div className="h-8 px-3 rounded-lg bg-muted/50 text-[11px] font-medium text-foreground flex items-center gap-1 flex-shrink-0">
              <Upload className="h-3 w-3" />
              Choisir
            </div>
          )
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept=".csv,text/csv,application/vnd.ms-excel,.xlsx"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
    </label>
  );
}

function PreviewStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-3 text-center">
      <Icon className="h-4 w-4 text-primary mx-auto" />
      <p className="text-xl font-semibold text-foreground mt-1">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
        {label}
      </p>
    </div>
  );
}

function PreviewErrors({ preview }: { preview: PreviewResponse }) {
  const allErrors = [
    ...(preview.clients?.errors.map((e) => ({ ...e, source: 'Clients' })) || []),
    ...(preview.quotes?.errors.map((e) => ({ ...e, source: 'Devis' })) || []),
    ...(preview.invoices?.errors.map((e) => ({ ...e, source: 'Factures' })) || []),
    ...(preview.services?.errors.map((e) => ({ ...e, source: 'Prestations' })) || []),
  ];
  if (allErrors.length === 0) return null;
  return (
    <ul className="mt-2 space-y-0.5 max-h-24 overflow-y-auto">
      {allErrors.slice(0, 6).map((err, i) => (
        <li key={i} className="text-[10px] text-amber-800">
          {err.source} L{err.line} : {err.reason}
        </li>
      ))}
      {allErrors.length > 6 && (
        <li className="text-[10px] text-amber-800 italic">
          … et {allErrors.length - 6} autre(s)
        </li>
      )}
    </ul>
  );
}
