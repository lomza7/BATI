'use client';

import { useEffect, useState } from 'react';
import { Send, Copy, Check, Link2, Loader as Loader2, PenLine, Mail, TriangleAlert as AlertTriangle, Paperclip, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

type EmailStatus = 'sent' | 'skipped' | 'failed' | null;

interface Props {
  quote: {
    id: string;
    quote_number: string;
    title: string;
    status: string;
    clients?: { name: string; email?: string | null } | null;
  };
  onClose: () => void;
  onSent?: () => void;
}

interface CompanyAttachmentRow {
  id: string;
  name: string;
  size_bytes: number;
}

export function SendQuoteDialog({ quote, onClose, onSent }: Props) {
  const { user } = useAuth();
  const [clientName, setClientName] = useState(quote.clients?.name || '');
  const [clientEmail, setClientEmail] = useState(quote.clients?.email || '');
  const [expiresIn, setExpiresIn] = useState('14');
  const [sending, setSending] = useState(false);
  const [magicLink, setMagicLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendError, setSendError] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<CompanyAttachmentRow[]>([]);
  const [excludedAttachmentIds, setExcludedAttachmentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('company_attachments')
        .select('id, name, size_bytes')
        .eq('attach_to_quotes', true)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
      if (!cancelled) setAttachments((data as CompanyAttachmentRow[]) || []);
    })();
    return () => { cancelled = true; };
  }, []);

  function toggleAttachment(id: string) {
    setExcludedAttachmentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    if (!user || !clientName.trim()) return;
    setSending(true);
    setSendError('');

    try {
      // Recuperer le token d'auth pour l'API route
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSendError('Session expirée, veuillez vous reconnecter');
        setSending(false);
        return;
      }

      const res = await fetch('/api/docuseal/create-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          quote_id: quote.id,
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || undefined,
          expires_in_days: parseInt(expiresIn),
          excluded_attachment_ids: Array.from(excludedAttachmentIds),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSendError(data.error || 'Erreur lors de la création du lien');
        setSending(false);
        return;
      }

      setMagicLink(data.magic_link);
      setEmailStatus((data.email_status as EmailStatus) || null);
      setEmailErrorMsg(data.email_error || null);
      onSent?.();
    } catch {
      setSendError('Erreur réseau, veuillez réessayer');
    }

    setSending(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 border-0 shadow-2xl overflow-hidden bg-white rounded-2xl">
        <DialogTitle className="sr-only">Envoyer pour signature</DialogTitle>

        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <PenLine className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Envoyer pour signature</h2>
              <p className="text-xs text-muted-foreground">{quote.quote_number} — {quote.title}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {magicLink ? (
            <div className="space-y-4 animate-fade-up">
              {emailStatus === 'sent' && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-800">Devis envoyé par email</p>
                    <p className="text-xs text-emerald-600 mt-0.5 break-words">
                      Un email de signature a été envoyé à <strong className="break-all">{clientEmail}</strong>.
                      S&apos;il ne le reçoit pas, demandez-lui de vérifier ses spams ou envoyez-lui le lien de secours ci-dessous.
                    </p>
                  </div>
                </div>
              )}

              {emailStatus === 'failed' && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                  <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-800">L&apos;email n&apos;a pas pu être envoyé</p>
                    <p className="text-xs text-red-600 mt-0.5 break-words">
                      {emailErrorMsg || 'Erreur inconnue.'} Le devis est enregistré — utilisez le lien de secours ci-dessous pour le transmettre par SMS, WhatsApp ou copier-coller.
                    </p>
                  </div>
                </div>
              )}

              {emailStatus === 'skipped' && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800">Email non envoyé</p>
                    <p className="text-xs text-amber-700 mt-0.5 break-words">
                      {emailErrorMsg || 'Aucune adresse email fournie.'} Utilisez le lien de secours ci-dessous.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {emailStatus === 'sent' ? 'Lien de secours (si le client ne reçoit pas l\u2019email)' : 'Lien de signature du devis'}
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0 flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-muted/20">
                    <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-foreground truncate">{magicLink}</span>
                  </div>
                  <button
                    onClick={copyLink}
                    className={`h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                      copied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Vous pouvez aussi envoyer ce lien par SMS ou WhatsApp à <strong>{clientName}</strong>.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nom du client</label>
                <input
                  autoFocus
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Jean Dupont"
                  className="w-full h-11 rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Email du client
                </label>
                <input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@email.fr"
                  type="email"
                  required
                  className="w-full h-11 rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                />
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      Pièces jointes ({attachments.length - excludedAttachmentIds.size}/{attachments.length})
                    </label>
                  </div>
                  <ul className="rounded-xl border border-border divide-y">
                    {attachments.map(att => {
                      const included = !excludedAttachmentIds.has(att.id);
                      return (
                        <li key={att.id} className="flex items-center justify-between gap-3 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className={`text-xs truncate ${included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                              {att.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleAttachment(att.id)}
                            className={`h-6 px-2 rounded-md text-[11px] font-medium transition-colors ${
                              included
                                ? 'bg-primary/10 text-primary hover:bg-primary/15'
                                : 'bg-muted text-muted-foreground hover:bg-muted/70'
                            }`}
                          >
                            {included ? 'Joint' : 'Exclu'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-[11px] text-muted-foreground">
                    Vos attestations sont jointes par défaut à tous les devis. Cliquez sur un fichier pour l&apos;exclure de cet envoi.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Expiration du lien</label>
                <div className="flex gap-2">
                  {[
                    { value: '7', label: '7 jours' },
                    { value: '14', label: '14 jours' },
                    { value: '30', label: '30 jours' },
                    { value: '60', label: '60 jours' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setExpiresIn(opt.value)}
                      className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-all ${
                        expiresIn === opt.value
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-white text-foreground hover:border-primary/30'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {sendError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{sendError}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-border bg-white text-sm font-medium text-foreground hover:bg-muted/50 transition-all"
          >
            {magicLink ? 'Fermer' : 'Annuler'}
          </button>
          {!magicLink && (
            <button
              onClick={handleSend}
              disabled={!clientName.trim() || !clientEmail.trim() || sending}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Envoyer le devis
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
