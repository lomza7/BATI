'use client';

import { useEffect, useState } from 'react';
import { Send, Copy, Check, Link2, Loader as Loader2, Mail, CreditCard, Paperclip, FileText, Bell } from 'lucide-react';
import { fireConfetti } from '@/lib/confetti';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Props {
  invoice: {
    id: string;
    invoice_number: string;
    title: string;
    total_ttc: number;
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

export function SendInvoiceDialog({ invoice, onClose, onSent }: Props) {
  const { user } = useAuth();
  const [clientName, setClientName] = useState(invoice.clients?.name || '');
  const [clientEmail, setClientEmail] = useState(invoice.clients?.email || '');
  const [expiresIn, setExpiresIn] = useState('30');
  const [sending, setSending] = useState(false);
  const [magicLink, setMagicLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendError, setSendError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [attachments, setAttachments] = useState<CompanyAttachmentRow[]>([]);
  const [excludedAttachmentIds, setExcludedAttachmentIds] = useState<Set<string>>(new Set());
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [enableStripePayment, setEnableStripePayment] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [connectFeePercent, setConnectFeePercent] = useState(0.5);
  const [showStripePrompt, setShowStripePrompt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [attRes, remRes, stripeRes, configRes] = await Promise.all([
        supabase
          .from('company_attachments')
          .select('id, name, size_bytes')
          .eq('attach_to_invoices', true)
          .order('position', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase
          .from('payment_reminder_settings')
          .select('reminders_enabled')
          .maybeSingle(),
        supabase
          .from('stripe_connections')
          .select('charges_enabled')
          .maybeSingle(),
        supabase
          .from('platform_config')
          .select('value')
          .eq('key', 'stripe_connect_fee_percent')
          .maybeSingle(),
      ]);
      if (!cancelled) {
        setAttachments((attRes.data as CompanyAttachmentRow[]) || []);
        setRemindersEnabled(remRes.data?.reminders_enabled ?? false);
        const connected = Boolean(stripeRes.data?.charges_enabled);
        setStripeConnected(connected);
        setEnableStripePayment(connected);
        setConnectFeePercent(parseFloat(configRes.data?.value || '0.5'));
      }
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setSendError('Session expirée, veuillez vous reconnecter');
        setSending(false);
        return;
      }

      const res = await fetch('/api/factures/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          invoice_id: invoice.id,
          client_name: clientName.trim(),
          client_email: clientEmail.trim() || undefined,
          expires_in_days: parseInt(expiresIn),
          excluded_attachment_ids: Array.from(excludedAttachmentIds),
          reminders_enabled: remindersEnabled,
          enable_stripe_payment: enableStripePayment,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSendError(data.error || 'Erreur lors de l\'envoi de la facture');
        setSending(false);
        return;
      }

      setMagicLink(data.magic_link);
      setEmailSent(data.email_status === 'sent');
      fireConfetti();
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
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          Envoyer la facture
        </DialogTitle>

        {magicLink ? (
          /* Success state */
          <div className="space-y-4 mt-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 text-center">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="font-semibold text-emerald-800 text-sm">Facture envoyée !</p>
              {emailSent && (
                <p className="text-xs text-emerald-600 mt-1">
                  <Mail className="inline h-3 w-3 mr-1" />
                  Email envoyé à {clientEmail}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Lien de la facture</label>
              <div className="flex gap-2 mt-1">
                <Input value={magicLink} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={onClose}>Fermer</Button>
            </div>
          </div>
        ) : (
          /* Form state */
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{invoice.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">{invoice.title}</p>
                </div>
                <p className="text-sm font-semibold text-primary">
                  {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.total_ttc)}
                </p>
              </div>
            </div>

            {sendError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{sendError}</p>
            )}

            <div>
              <label className="text-sm font-medium">Nom du client *</label>
              <Input
                className="mt-1"
                placeholder="Jean Dupont"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Email du client</label>
              <Input
                className="mt-1"
                type="email"
                placeholder="client@email.com"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Si renseigné, un email avec le lien sera envoyé automatiquement
              </p>
            </div>

            {attachments.length > 0 && (
              <div>
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                  Pièces jointes ({attachments.length - excludedAttachmentIds.size}/{attachments.length})
                </label>
                <ul className="mt-1.5 rounded-lg border divide-y">
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
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Vos attestations sont jointes par défaut. Cliquez sur un fichier pour l&apos;exclure de cet envoi.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div className="flex items-center gap-2.5">
                <Bell className="h-4 w-4 text-[#d35400]" />
                <div>
                  <p className="text-sm font-medium">Relances automatiques</p>
                  <p className="text-xs text-muted-foreground">Envoyer des rappels si la facture n&apos;est pas payée</p>
                </div>
              </div>
              <Switch checked={remindersEnabled} onCheckedChange={setRemindersEnabled} />
            </div>

            <div>
              <label className="text-sm font-medium">Validité du lien</label>
              <select
                value={expiresIn}
                onChange={e => setExpiresIn(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="30">30 jours</option>
                <option value="60">60 jours</option>
                <option value="90">90 jours</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div className="flex items-center gap-2.5">
                  <CreditCard className="h-4 w-4 text-[#d35400]" />
                  <div>
                    <p className="text-sm font-medium">Paiement en ligne</p>
                    <p className="text-xs text-muted-foreground">Le client pourra payer par carte, Apple Pay ou Google Pay</p>
                  </div>
                </div>
                <Switch
                  checked={enableStripePayment}
                  onCheckedChange={(checked) => {
                    if (checked && !stripeConnected) {
                      setShowStripePrompt(true);
                    } else {
                      setEnableStripePayment(checked);
                    }
                  }}
                />
              </div>
              {enableStripePayment && stripeConnected && (
                <div className="rounded-lg bg-amber-50/70 border border-amber-200/60 p-3">
                  <p className="text-xs text-amber-800 font-medium mb-1">Frais de paiement en ligne</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Commission Hellobat : {connectFeePercent}% · Frais Stripe : ~1,5% + 0,25 €
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">
                    Estimation sur 500 € :{' '}
                    <span className="font-semibold">
                      {(500 * connectFeePercent / 100 + 500 * 0.015 + 0.25).toFixed(2)} € de frais
                    </span>
                    {' '}→ vous recevez{' '}
                    <span className="font-semibold">
                      {(500 - 500 * connectFeePercent / 100 - 500 * 0.015 - 0.25).toFixed(2)} €
                    </span>
                  </p>
                </div>
              )}
              {showStripePrompt && !stripeConnected && (
                <div className="rounded-xl border border-[#d35400]/30 bg-orange-50/70 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#d35400]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CreditCard className="h-4 w-4 text-[#d35400]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#d35400]">Activez le paiement en ligne</p>
                      <p className="text-xs text-[#a04000] mt-1 leading-relaxed">
                        Recevez vos paiements en quelques secondes. Vos clients pourront payer par carte bancaire, Apple Pay ou Google Pay directement depuis leur facture.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-[#d35400] hover:bg-[#b84800] text-white"
                      onClick={async () => {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session?.access_token) return;
                        const res = await fetch('/api/stripe/connect', {
                          method: 'POST',
                          headers: {
                            Authorization: `Bearer ${session.access_token}`,
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ return_to: '/factures' }),
                        });
                        const json = await res.json();
                        if (json.redirect_url) window.location.href = json.redirect_url;
                      }}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Connecter Stripe
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => setShowStripePrompt(false)}
                    >
                      Plus tard
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSend} disabled={sending || !clientName.trim()} className="gap-2">
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {sending ? 'Envoi...' : 'Générer le lien'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
