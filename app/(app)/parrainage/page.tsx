'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Gift,
  Copy,
  Check,
  Mail,
  Send,
  Loader2,
  Sparkles,
  Eye,
  UserCheck,
  CreditCard,
  Link as LinkIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReferralStats {
  invites_sent: number;
  invites_opened: number;
  signups: number;
  subscribed: number;
  months_earned: number;
}

interface ReferralInvite {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  sent_at: string;
  opened_at: string | null;
  open_count: number;
  signed_up_at: string | null;
  signed_up_user_id: string | null;
}

export default function ParrainagePage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [stats, setStats] = useState<ReferralStats>({
    invites_sent: 0,
    invites_opened: 0,
    signups: 0,
    subscribed: 0,
    months_earned: 0,
  });
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [emailValue, setEmailValue] = useState('');
  const [nameValue, setNameValue] = useState('');
  const [messageValue, setMessageValue] = useState('');
  const [sending, setSending] = useState(false);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const [codeRes, invitesRes] = await Promise.all([
        fetch('/api/referral/code', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch('/api/referral/invites', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (codeRes.ok) {
        const data = await codeRes.json();
        setCode(data.code || '');
        setLink(data.link || '');
        if (data.stats) setStats(data.stats);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        setInvites(data.invites || []);
      }
    } catch (e) {
      console.error('referral load error', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Lien copie', description: 'Vous pouvez le partager partout.' });
    } catch {
      toast({ title: 'Impossible de copier', description: 'Selectionnez le lien manuellement.', variant: 'destructive' });
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValue.trim() || !emailValue.includes('@')) {
      toast({ title: 'Email invalide', description: 'Merci de saisir une adresse email valide.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch('/api/referral/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: emailValue.trim(),
          name: nameValue.trim(),
          message: messageValue.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Envoi impossible');
      }

      toast({
        title: data.email_sent ? 'Invitation envoyee' : 'Invitation enregistree',
        description: data.email_sent
          ? `Un email a ete envoye a ${emailValue}.`
          : `L'envoi par email n'est pas configure mais le lien a ete enregistre.`,
      });
      setEmailValue('');
      setNameValue('');
      setMessageValue('');
      loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur lors de l envoi';
      toast({ title: 'Erreur', description: msg, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Lien de parrainage" description="Invitez des artisans et gagnez 2 mois gratuits chacun" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lien de parrainage"
        description="Invitez d'autres artisans : 2 mois offerts pour vous, 2 mois offerts pour eux"
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5" /> {stats.months_earned} mois gagnes
        </div>
      </PageHeader>

      {/* Comment ca marche */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-amber-50/50 to-white p-5 sm:p-6">
        <div className="flex items-start gap-4 flex-col sm:flex-row">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-foreground mb-1.5">Parrainez et gagnez 2 mois gratuits</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Pour chaque artisan qui s&apos;inscrit avec votre lien et souscrit a un plan payant, vous recevez <strong className="text-foreground">2 mois offerts</strong> sur votre abonnement Hellobat. Et il en recoit <strong className="text-foreground">2 mois offerts</strong> aussi.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Mail} label="Emails envoyes" value={stats.invites_sent} />
        <KpiCard icon={Eye} label="Emails ouverts" value={stats.invites_opened} accent={stats.invites_opened > 0} />
        <KpiCard icon={UserCheck} label="Inscriptions" value={stats.signups} accent={stats.signups > 0} />
        <KpiCard icon={CreditCard} label="Abonnes" value={stats.subscribed} accent={stats.subscribed > 0} />
      </div>

      {/* Lien personnel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Votre lien personnel</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Partagez ce lien par email, SMS, WhatsApp ou sur vos reseaux. Il est unique a votre compte.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0 px-4 py-3 rounded-lg border border-border bg-muted/50 text-sm font-mono text-foreground truncate">
            {link || '—'}
          </div>
          <Button onClick={copyLink} variant="outline" className="gap-1.5 sm:w-auto">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copie' : 'Copier'}
          </Button>
        </div>
        {code && (
          <p className="mt-3 text-xs text-muted-foreground">
            Code : <span className="font-mono font-semibold text-foreground">{code}</span>
          </p>
        )}
      </div>

      {/* Envoyer par email */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Mail className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Envoyer par email</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Envoyez votre invitation directement par email et suivez si elle a ete ouverte ou non.
        </p>
        <form onSubmit={handleSendEmail} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email du destinataire *</label>
              <Input
                type="email"
                placeholder="artisan@exemple.fr"
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Prenom (optionnel)</label>
              <Input
                placeholder="Jean"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Message personnel (optionnel)</label>
            <Textarea
              placeholder="J'utilise Hellobat tous les jours sur mes chantiers, c'est un super outil. Profite des 2 mois offerts !"
              className="min-h-[80px]"
              value={messageValue}
              onChange={e => setMessageValue(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={sending} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Envoi...' : "Envoyer l'invitation"}
            </Button>
          </div>
        </form>
      </div>

      {/* Historique */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Vos invitations envoyees</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suivez en temps reel quelles invitations ont ete ouvertes et qui s&apos;est inscrit.
          </p>
        </div>
        {invites.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Vous n&apos;avez encore envoye aucune invitation. Commencez en utilisant le formulaire ci-dessus.
            </p>
          </div>
        ) : (
          <>
            {/* Table desktop */}
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Destinataire</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Envoye</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Statut email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs">Inscription</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map(inv => (
                    <tr key={inv.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs text-foreground">{inv.recipient_email}</p>
                        {inv.recipient_name && (
                          <p className="text-[11px] text-muted-foreground">{inv.recipient_name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{formatShortDate(inv.sent_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.opened_at ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                            <Eye className="h-3 w-3" /> Ouvert {inv.open_count > 1 && `(${inv.open_count}x)`}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                            Non ouvert
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {inv.signed_up_at ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-primary/15 text-primary">
                            <UserCheck className="h-3 w-3" /> Inscrit le {formatShortDate(inv.signed_up_at)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes mobile */}
            <div className="sm:hidden divide-y divide-border">
              {invites.map(inv => (
                <div key={inv.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{inv.recipient_email}</p>
                      {inv.recipient_name && (
                        <p className="text-xs text-muted-foreground">{inv.recipient_name}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{formatShortDate(inv.sent_at)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {inv.opened_at ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                        <Eye className="h-3 w-3" /> Ouvert
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                        Non ouvert
                      </span>
                    )}
                    {inv.signed_up_at && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-primary/15 text-primary">
                        <UserCheck className="h-3 w-3" /> Inscrit
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={cn('h-4 w-4', accent ? 'text-primary' : 'text-muted-foreground')} />
      </div>
      <p className={cn('text-2xl font-bold', accent ? 'text-primary' : 'text-foreground')}>{value}</p>
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
