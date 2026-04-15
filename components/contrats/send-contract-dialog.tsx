'use client';

import { useState } from 'react';
import { Copy, Check, Link2, Loader2, PenLine, Mail, TriangleAlert as AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { fireConfetti } from '@/lib/confetti';

type EmailStatus = 'sent' | 'skipped' | 'failed' | null;

interface Props {
  contract: {
    id: string;
    contract_number: string | null;
    title: string;
    clients?: { name: string; email?: string | null } | null;
  };
  onClose: () => void;
  onSent?: () => void;
}

export function SendContractDialog({ contract, onClose, onSent }: Props) {
  const [clientName, setClientName] = useState(contract.clients?.name || '');
  const [clientEmail, setClientEmail] = useState(contract.clients?.email || '');
  const [expiresIn, setExpiresIn] = useState('30');
  const [sending, setSending] = useState(false);
  const [magicLink, setMagicLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);

  async function handleSend() {
    if (!clientName.trim()) return;
    setSending(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expirée');
        setSending(false);
        return;
      }
      const res = await fetch('/api/docuseal/create-contract-submission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          contract_id: contract.id,
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || undefined,
          expires_in_days: parseInt(expiresIn),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création');
        setSending(false);
        return;
      }
      setMagicLink(data.magic_link);
      setEmailStatus((data.email_status as EmailStatus) || null);
      setEmailErrorMsg(data.email_error || null);
      fireConfetti();
      onSent?.();
    } catch {
      setError('Erreur réseau');
    }
    setSending(false);
  }

  function copy() {
    navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="sr-only">Envoyer le contrat pour signature</DialogTitle>

        <div className="flex items-center gap-3 pb-3 border-b">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PenLine className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Envoyer pour signature</h2>
            <p className="text-xs text-muted-foreground">{contract.contract_number || '—'} — {contract.title}</p>
          </div>
        </div>

        {magicLink ? (
          <div className="mt-4 space-y-3">
            {emailStatus === 'sent' && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <Mail className="h-4 w-4 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">Email envoyé</p>
                  <p className="text-xs text-emerald-700">Un lien de signature a été envoyé à {clientEmail}.</p>
                </div>
              </div>
            )}
            {emailStatus === 'failed' && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Envoi email échoué</p>
                  <p className="text-xs text-red-600">{emailErrorMsg || 'Utilisez le lien manuel.'}</p>
                </div>
              </div>
            )}
            {emailStatus === 'skipped' && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Pas d&apos;email envoyé</p>
                  <p className="text-xs text-amber-700">{emailErrorMsg || 'Transmettez le lien manuellement.'}</p>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Lien de signature</label>
              <div className="flex items-center gap-2 h-10 mt-1 px-3 rounded-lg border bg-muted/20">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs truncate flex-1">{magicLink}</span>
              </div>
              <button
                onClick={copy}
                className={`mt-2 w-full h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${copied ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copié !' : 'Copier le lien'}
              </button>
            </div>
            <button onClick={onClose} className="w-full h-10 rounded-lg text-sm font-medium border hover:bg-muted">Fermer</button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Nom du client *</label>
              <input
                className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Email du client</label>
              <input
                type="email"
                className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="(optionnel — le lien peut aussi être partagé manuellement)"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Validité du lien (jours)</label>
              <input
                type="number"
                className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                min={1}
                max={180}
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 h-10 rounded-lg text-sm font-medium border hover:bg-muted">Annuler</button>
              <button
                onClick={handleSend}
                disabled={sending || !clientName.trim()}
                className="flex-1 h-10 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                {sending ? 'Création…' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
