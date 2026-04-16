'use client';

/**
 * AttachPdfsButton — bouton "Attacher des PDF" pour joindre les PDF d'origine
 * aux devis / factures importes depuis CSV.
 *
 * Multi-fichier (drag & drop ou selection), matching par numero present dans
 * le nom du fichier. Le resultat affiche clairement quels PDF ont ete associes
 * et lesquels n'ont pas ete reconnus.
 */

import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
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

export type AttachPdfsType = 'quotes' | 'invoices';

interface MatchedPdf {
  filename: string;
  document_id: string;
  document_number: string;
}

interface UnmatchedPdf {
  filename: string;
  reason: string;
}

interface AttachResponse {
  type?: AttachPdfsType;
  total?: number;
  matched?: MatchedPdf[];
  unmatched?: UnmatchedPdf[];
  error?: string;
  hint?: string;
}

const COPY: Record<AttachPdfsType, { title: string; description: string; entityLabel: string }> = {
  quotes: {
    title: 'Attacher les PDF des devis',
    description:
      'Déposez les PDF de vos anciens devis. Chaque fichier est associé automatiquement au devis dont le numéro apparaît dans le nom du fichier.',
    entityLabel: 'devis',
  },
  invoices: {
    title: 'Attacher les PDF des factures',
    description:
      'Déposez les PDF de vos anciennes factures. Chaque fichier est associé automatiquement à la facture dont le numéro apparaît dans le nom du fichier.',
    entityLabel: 'facture',
  },
};

type Stage = 'picker' | 'loading' | 'result';

interface AttachPdfsButtonProps {
  type: AttachPdfsType;
  onAttached?: () => void;
  compact?: boolean;
}

export function AttachPdfsButton({ type, onAttached, compact }: AttachPdfsButtonProps) {
  const copy = COPY[type];
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('picker');
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<AttachResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reset = useCallback(() => {
    setStage('picker');
    setFiles([]);
    setResult(null);
    setDragOver(false);
  }, []);

  function close() {
    setOpen(false);
    setTimeout(reset, 250);
  }

  function addFiles(newFiles: FileList | File[]) {
    const arr = Array.from(newFiles).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    setFiles((prev) => {
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

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function runAttach() {
    if (files.length === 0) return;
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
      for (const f of files) formData.append('files', f);
      const res = await fetch(`/api/import/attach-pdfs/${type}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const json = (await res.json()) as AttachResponse;
      if (!res.ok) {
        setResult({ error: json.error || 'Erreur lors de l\'envoi', hint: json.hint });
        setStage('result');
        return;
      }
      setResult(json);
      setStage('result');
      if ((json.matched?.length || 0) > 0) onAttached?.();
    } catch (e) {
      setResult({
        error: e instanceof Error ? e.message : 'Erreur réseau',
        hint: 'Vérifiez votre connexion et réessayez.',
      });
      setStage('result');
    }
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const matchedCount = result?.matched?.length || 0;
  const unmatchedCount = result?.unmatched?.length || 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Paperclip className="h-4 w-4" />
        <span className={compact ? 'hidden sm:inline' : ''}>Attacher des PDF</span>
      </Button>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[600px] max-h-[92vh] p-0 gap-0 border-0 shadow-2xl overflow-hidden bg-white rounded-2xl flex flex-col">
          <DialogTitle className="sr-only">{copy.title}</DialogTitle>
          <DialogDescription className="sr-only">{copy.description}</DialogDescription>

          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-3 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Paperclip className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{copy.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  PDF visibles depuis la fiche {copy.entityLabel}
                </p>
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
                    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
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
                    ref={inputRef}
                    id={`attach-pdf-${type}`}
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>

                {files.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">
                        {files.length} PDF sélectionné{files.length > 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {(totalSize / 1024 / 1024).toFixed(1)} Mo
                      </span>
                    </div>
                    <div className="rounded-xl border border-border divide-y divide-border max-h-[200px] overflow-y-auto">
                      {files.map((f, i) => (
                        <div key={f.name + i} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-xs text-foreground truncate">{f.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
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
                  avec le numéro du {copy.entityLabel} (par ex. <code className="px-1 rounded bg-background">D-2024-012.pdf</code> ou
                  <code className="px-1 rounded bg-background ml-1">facture_F2024-008.pdf</code>). Chaque PDF est reconnu
                  automatiquement par son numéro.
                </div>
              </div>
            )}

            {stage === 'loading' && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
                <p className="text-sm font-medium text-foreground">Envoi des PDF en cours…</p>
                <p className="text-xs text-muted-foreground mt-1">Ne fermez pas cette fenêtre.</p>
              </div>
            )}

            {stage === 'result' && result && (
              <div className="space-y-4">
                {result.error ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-destructive">{result.error}</p>
                        {result.hint && (
                          <p className="text-xs text-destructive/80 mt-1">{result.hint}</p>
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
                          {result.matched?.map((m) => (
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
                          {result.unmatched?.map((u, i) => (
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
          <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-border bg-muted/10">
            {stage === 'picker' && (
              <>
                <Button type="button" variant="ghost" onClick={close}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={runAttach}
                  disabled={files.length === 0}
                  className="gap-2"
                >
                  <Paperclip className="h-4 w-4" />
                  Associer {files.length > 0 ? `(${files.length})` : ''}
                </Button>
              </>
            )}
            {stage === 'loading' && (
              <Button type="button" variant="outline" disabled>
                Envoi en cours…
              </Button>
            )}
            {stage === 'result' && (
              <>
                {matchedCount > 0 && unmatchedCount === 0 ? (
                  <Button type="button" onClick={close}>Fermer</Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={reset}>
                      Réessayer
                    </Button>
                    <Button type="button" onClick={close}>Fermer</Button>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
