'use client';

import { useState } from 'react';
import { X, Send, Copy, Check, Link2, Loader as Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

interface Props {
  catalog: { id: string; name: string };
  onClose: () => void;
}

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function SendCatalogDialog({ catalog, onClose }: Props) {
  const { user } = useAuth();
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [expiresIn, setExpiresIn] = useState('7');
  const [sending, setSending] = useState(false);
  const [magicLink, setMagicLink] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleSend() {
    if (!user || !clientName.trim()) return;
    setSending(true);

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresIn));

    const { error } = await supabase.from('catalog_sends').insert({
      user_id: user.id,
      catalog_id: catalog.id,
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || null,
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (!error) {
      const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
      const link = `${base}/c/${token}`;
      setMagicLink(link);
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
        <DialogTitle className="sr-only">Envoyer le catalogue</DialogTitle>

        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Envoyer le catalogue</h2>
                <p className="text-xs text-muted-foreground">{catalog.name}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {magicLink ? (
            <div className="space-y-4 animate-fade-up">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-800">Lien cree avec succes</p>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    Valide pendant {expiresIn} jour{parseInt(expiresIn) > 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1.5 block">Lien magique</label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-muted/20">
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
                    {copied ? 'Copie !' : 'Copier'}
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Partagez ce lien avec <strong>{clientName}</strong>. Votre client pourra consulter le catalogue et selectionner les modeles qui l&apos;interessent.
              </p>
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
                  Email <span className="text-muted-foreground font-normal">(optionnel)</span>
                </label>
                <input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@email.fr"
                  type="email"
                  className="w-full h-11 rounded-xl border border-border bg-muted/30 px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Expiration du lien</label>
                <div className="flex gap-2">
                  {[
                    { value: '3', label: '3 jours' },
                    { value: '7', label: '7 jours' },
                    { value: '14', label: '14 jours' },
                    { value: '30', label: '30 jours' },
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
              disabled={!clientName.trim() || sending}
              className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-40 transition-all"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Generer le lien
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
