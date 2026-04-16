'use client';

import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bug, CircleHelp, Lightbulb, CheckCircle2, Loader2, ArrowLeft, Phone, Mail, Paperclip, X, FileText, Image as ImageIcon, FileVideo } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type TicketType = 'bug' | 'question' | 'amelioration';

interface TypeOption {
  value: TicketType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const TYPES: TypeOption[] = [
  {
    value: 'bug',
    label: 'Signaler un bug',
    description: "Quelque chose ne fonctionne pas comme prévu",
    icon: Bug,
    color: 'text-rose-600 bg-rose-50 border-rose-100',
  },
  {
    value: 'question',
    label: 'Poser une question',
    description: 'J\'ai besoin d\'aide ou d\'un conseil',
    icon: CircleHelp,
    color: 'text-sky-600 bg-sky-50 border-sky-100',
  },
  {
    value: 'amelioration',
    label: 'Proposer une amélioration',
    description: 'Une idée pour rendre Hellobat meilleur',
    icon: Lightbulb,
    color: 'text-amber-600 bg-amber-50 border-amber-100',
  },
];

const PLACEHOLDER: Record<TicketType, string> = {
  bug: "Décrivez le problème : qu'est-ce que vous faisiez, ce qui s'est passé vs ce qui aurait dû se passer.",
  question: 'Posez votre question, on vous répond rapidement par téléphone ou par email.',
  amelioration: 'Dites-nous ce qui vous manque ou ce qui pourrait être mieux.',
};

interface UploadedAttachment {
  path: string;
  name: string;
  mime: string;
  size: number;
}

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_FILES = 3;
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function iconForMime(mime: string): React.ElementType {
  if (mime.startsWith('image/')) return ImageIcon;
  if (mime.startsWith('video/')) return FileVideo;
  return FileText;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<TicketType | null>(null);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function reset() {
    setType(null);
    setMessage('');
    setAttachments([]);
    setError(null);
    setSubmitted(false);
    setSubmitting(false);
    setUploading(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Laisse la modale se fermer avant de réinitialiser (sinon flash visuel)
      setTimeout(reset, 150);
    }
    onOpenChange(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const remaining = MAX_FILES - attachments.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) {
      setError(`Limite de ${MAX_FILES} pièces jointes atteinte.`);
      return;
    }

    const oversized = toUpload.find((f) => f.size > MAX_SIZE_BYTES);
    if (oversized) {
      setError(`« ${oversized.name} » dépasse 10 Mo.`);
      return;
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expirée, reconnectez-vous pour envoyer votre message.');
        return;
      }

      for (const file of toUpload) {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/support/ticket/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error || `Upload de « ${file.name} » échoué.`);
          return;
        }
        setAttachments((prev) => [...prev, data as UploadedAttachment]);
      }
    } catch (e) {
      console.warn('[help-dialog] upload failed', e);
      setError('Erreur réseau pendant l\'upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeAttachment(path: string) {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  }

  async function handleSubmit() {
    if (!type || message.trim().length < 5 || submitting || uploading) return;
    setError(null);
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expirée, reconnectez-vous pour envoyer votre message.');
        return;
      }

      const pageUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${pathname}${window.location.search}`
        : pathname;

      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type,
          message: message.trim(),
          page_url: pageUrl,
          attachments,
        }),
      });

      if (res.status === 429) {
        setError('Trop de tickets envoyés, merci de patienter un instant.');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Envoi impossible pour le moment. Réessayez dans un instant.");
        return;
      }

      setSubmitted(true);
    } catch (e) {
      console.warn('[help-dialog] submit failed', e);
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        {submitted ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <DialogTitle className="text-lg">Message envoyé !</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-muted-foreground max-w-sm">
              On vous répond <span className="text-foreground font-medium">très rapidement</span> par téléphone ou par email — généralement sous quelques heures ouvrées.
            </DialogDescription>
            <div className="mt-5 flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => handleOpenChange(false)} variant="outline" className="flex-1 sm:flex-none">
                Fermer
              </Button>
              <Button
                onClick={() => {
                  reset();
                }}
                className="flex-1 sm:flex-none"
              >
                Envoyer un autre message
              </Button>
            </div>
          </div>
        ) : !type ? (
          <>
            <DialogHeader>
              <DialogTitle>Comment pouvons-nous vous aider ?</DialogTitle>
              <DialogDescription>
                Choisissez le type de votre demande. On vous répond rapidement par téléphone ou par email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 pt-2">
              {TYPES.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50',
                    )}
                  >
                    <div className={cn('h-10 w-10 rounded-lg border flex items-center justify-center flex-shrink-0', opt.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <a href="tel:+33000000000" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Phone className="h-3.5 w-3.5" /> Appelez-nous
              </a>
              <a href="mailto:louis@hellobat.app" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Mail className="h-3.5 w-3.5" /> louis@hellobat.app
              </a>
            </div>
            <div className="text-center text-xs text-muted-foreground">
              Envie de parcourir les guides ?{' '}
              <Link href="/aide" onClick={() => onOpenChange(false)} className="text-primary hover:underline">
                Voir le centre d&apos;aide
              </Link>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setType(null); setError(null); }}
                  className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                  aria-label="Retour"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <DialogTitle className="text-base">
                  {TYPES.find((t) => t.value === type)?.label}
                </DialogTitle>
              </div>
              <DialogDescription>
                Plus votre message est précis, plus on pourra vous répondre vite et bien.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={PLACEHOLDER[type]}
                rows={6}
                className="resize-none"
                disabled={submitting}
                autoFocus
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{message.trim().length < 5 ? 'Message trop court' : `${message.length} caractères`}</span>
                <span>Max 5 000</span>
              </div>

              {/* Pièces jointes */}
              <div className="space-y-2">
                {attachments.length > 0 && (
                  <ul className="space-y-1.5">
                    {attachments.map((att) => {
                      const Icon = iconForMime(att.mime);
                      return (
                        <li
                          key={att.path}
                          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate flex-1">{att.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{formatSize(att.size)}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(att.path)}
                            disabled={submitting}
                            className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
                            aria-label="Retirer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {attachments.length < MAX_FILES && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,application/pdf,video/mp4,video/quicktime,video/webm,text/plain"
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                      disabled={uploading || submitting}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || submitting}
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Upload en cours…
                        </>
                      ) : (
                        <>
                          <Paperclip className="h-3.5 w-3.5" />
                          Ajouter une pièce jointe{attachments.length > 0 ? ` (${MAX_FILES - attachments.length} restante${MAX_FILES - attachments.length > 1 ? 's' : ''})` : ''}
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Images, PDF, vidéos courtes. Max 10 Mo par fichier, jusqu&apos;à {MAX_FILES} fichiers.
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting || uploading}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || uploading || message.trim().length < 5}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Envoi…
                  </>
                ) : (
                  'Envoyer'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
