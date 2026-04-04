'use client';

import { useState } from 'react';
import { Send, Copy, Check, Link2, Loader as Loader2, Mail, CreditCard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  async function handleSend() {
    if (!user || !clientName.trim()) return;
    setSending(true);
    setSendError('');

    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));

      // Insert invoice_send
      const { error: insertError } = await supabase.from('invoice_sends').insert({
        user_id: user.id,
        invoice_id: invoice.id,
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || null,
        token,
        expires_at: expiresAt.toISOString(),
      });

      if (insertError) {
        setSendError('Erreur lors de la creation du lien');
        setSending(false);
        return;
      }

      // Update invoice status to 'envoyee' + set issued_at
      const updates: Record<string, string> = {
        status: 'envoyee',
        updated_at: new Date().toISOString(),
      };
      // Set issued_at if not already set
      if (invoice.status === 'brouillon' || invoice.status === 'creee') {
        updates.issued_at = new Date().toISOString();
      }
      await supabase.from('invoices').update(updates).eq('id', invoice.id);

      const siteUrl = window.location.origin;
      const link = `${siteUrl}/f/${token}`;
      setMagicLink(link);

      // Try sending email via Gmail if connected and email provided
      if (clientEmail.trim()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            const gmailStatusRes = await fetch('/api/gmail/status', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const gmailStatus = await gmailStatusRes.json();

            if (gmailStatus.connected) {
              // Fetch artisan profile for email
              const { data: profile } = await supabase
                .from('profiles')
                .select('company_name, full_name, document_config')
                .eq('id', user.id)
                .single();

              const artisanName = profile?.company_name || profile?.full_name || 'Votre artisan';
              const accent = profile?.document_config?.primary_color || '#d35400';
              const totalFormatted = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(invoice.total_ttc);

              // Check if artisan has Stripe connected
              const stripeRes = await fetch('/api/stripe/connect/status', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              const stripeStatus = await stripeRes.json();
              const hasOnlinePayment = stripeStatus.connected && stripeStatus.charges_enabled;

              // Import email template dynamically
              const { buildInvoicePaymentEmail } = await import('@/lib/email-templates');
              const html = buildInvoicePaymentEmail({
                clientName: clientName.trim(),
                artisanName,
                invoiceNumber: invoice.invoice_number,
                invoiceTitle: invoice.title,
                totalTtc: totalFormatted,
                dueDate: null,
                magicLink: link,
                hasOnlinePayment,
                accentColor: accent,
              });

              await fetch('/api/gmail/send', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                  to: clientEmail.trim(),
                  subject: `Facture ${invoice.invoice_number} — ${artisanName}`,
                  html,
                }),
              });

              setEmailSent(true);
            }
          }
        } catch {
          // Email sending failed — link still works
        }
      }

      onSent?.();
    } catch {
      setSendError('Erreur reseau, veuillez reessayer');
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
              <p className="font-semibold text-emerald-800 text-sm">Facture envoyee !</p>
              {emailSent && (
                <p className="text-xs text-emerald-600 mt-1">
                  <Mail className="inline h-3 w-3 mr-1" />
                  Email envoye a {clientEmail}
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
                Si renseigne, un email avec le lien sera envoye automatiquement via Gmail
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Validite du lien</label>
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

            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <div className="flex items-start gap-2">
                <CreditCard className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Si votre compte Stripe est connecte, le client pourra payer directement en ligne depuis le lien de la facture.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSend} disabled={sending || !clientName.trim()} className="gap-2">
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {sending ? 'Envoi...' : 'Generer le lien'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
