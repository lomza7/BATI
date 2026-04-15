'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface LocalReview {
  id: string;
  client_name: string;
  rating: number;
  comment: string;
  response: string;
  status: string;
  review_date: string | null;
  created_at: string;
  is_published_on_site: boolean;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const s = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(s, i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')}
        />
      ))}
    </div>
  );
}

function buildSmsMessage(clientName: string, companyName: string, reviewLink: string) {
  const recipient = clientName.trim() || 'bonjour';
  return `Bonjour ${recipient}, merci pour votre confiance. Si vous avez 30 secondes, pourriez-vous laisser un avis pour ${companyName} ? Voici le lien : ${reviewLink}`;
}

export default function AvisPage() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<LocalReview[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [googleReviewLink, setGoogleReviewLink] = useState('');
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);

  // Edit Google URL dialog
  const [showEditUrl, setShowEditUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [savingUrl, setSavingUrl] = useState(false);

  // Review CRUD
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LocalReview | null>(null);
  const [form, setForm] = useState({ client_name: '', rating: 5, comment: '', response: '' });

  // Ask for review
  const [showAsk, setShowAsk] = useState(false);
  const [askClientName, setAskClientName] = useState('');

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('company_name, google_review_link')
      .eq('id', user.id)
      .maybeSingle();
    if (data) {
      setCompanyName(data.company_name || '');
      setGoogleReviewLink(data.google_review_link || '');
    }
  }, [user]);

  const loadReviews = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('reviews')
      .select('id, client_name, rating, comment, response, status, review_date, created_at, is_published_on_site')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setReviews((data || []) as LocalReview[]);
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    Promise.all([loadProfile(), loadReviews()]).finally(() => setLoading(false));
  }, [authLoading, user, loadProfile, loadReviews]);

  async function saveGoogleUrl() {
    if (!user) return;
    setSavingUrl(true);
    const { error } = await supabase
      .from('profiles')
      .update({ google_review_link: urlDraft.trim() })
      .eq('id', user.id);
    setSavingUrl(false);
    if (!error) {
      setGoogleReviewLink(urlDraft.trim());
      setShowEditUrl(false);
    }
  }

  async function saveReview() {
    if (!user || !form.client_name.trim()) return;
    if (editing) {
      await supabase
        .from('reviews')
        .update({
          client_name: form.client_name,
          rating: form.rating,
          comment: form.comment,
          response: form.response,
        })
        .eq('id', editing.id);
    } else {
      await supabase.from('reviews').insert({
        user_id: user.id,
        client_name: form.client_name,
        rating: form.rating,
        comment: form.comment,
        response: form.response,
        status: 'publie',
        review_date: new Date().toISOString(),
        external_source: 'manual',
      });
    }
    setShowForm(false);
    setEditing(null);
    setForm({ client_name: '', rating: 5, comment: '', response: '' });
    loadReviews();
  }

  async function deleteReview(id: string) {
    if (!confirm('Supprimer cet avis ?')) return;
    await supabase.from('reviews').delete().eq('id', id);
    loadReviews();
  }

  async function togglePublishOnSite(id: string, current: boolean) {
    await supabase.from('reviews').update({ is_published_on_site: !current }).eq('id', id);
    loadReviews();
  }

  function openEdit(r: LocalReview) {
    setEditing(r);
    setForm({
      client_name: r.client_name,
      rating: r.rating,
      comment: r.comment,
      response: r.response,
    });
    setShowForm(true);
  }

  function openCreate() {
    setEditing(null);
    setForm({ client_name: '', rating: 5, comment: '', response: '' });
    setShowForm(true);
  }

  async function copyText(text: string, kind: 'link' | 'message') {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  function openSms(clientPhone?: string) {
    if (!googleReviewLink) return;
    const msg = buildSmsMessage(askClientName, companyName || 'notre entreprise', googleReviewLink);
    const phone = clientPhone ? `&phone=${encodeURIComponent(clientPhone)}` : '';
    window.location.href = `sms:${clientPhone || ''}?&body=${encodeURIComponent(msg)}`;
  }

  const averageRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avis clients"
        description="Collectez, publiez et répondez aux avis de vos clients."
      >
        <div className="flex flex-wrap gap-2">
          {googleReviewLink && (
            <Button
              variant="outline"
              onClick={() => setShowAsk(true)}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Demander un avis
            </Button>
          )}
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un avis
          </Button>
        </div>
      </PageHeader>

      {/* ─── Google Review URL card ───────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Lien Google Avis</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Collez ici le lien public de votre fiche Google Business. Vos clients pourront
              cliquer dessus pour laisser un avis directement sur Google.
            </p>
            {googleReviewLink ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate font-mono">{googleReviewLink}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2"
                  onClick={() => copyText(googleReviewLink, 'link')}
                >
                  <Copy className="h-3 w-3" />
                  {copied === 'link' ? 'Copié' : 'Copier'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2"
                  asChild
                >
                  <a href={googleReviewLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-amber-700">
                Aucun lien configuré. Ajoutez-le pour pouvoir demander des avis Google à vos clients.
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setUrlDraft(googleReviewLink);
              setShowEditUrl(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            {googleReviewLink ? 'Modifier' : 'Ajouter'}
          </Button>
        </div>
      </div>

      {/* ─── Stats ─────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Note moyenne</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-bold">{averageRating.toFixed(1)}</span>
              <StarRating rating={Math.round(averageRating)} />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total avis</div>
            <div className="mt-1 text-2xl font-bold">{reviews.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Publiés sur le site</div>
            <div className="mt-1 text-2xl font-bold">
              {reviews.filter((r) => r.is_published_on_site).length}
            </div>
          </div>
        </div>
      )}

      {/* ─── Reviews list ──────────────────────────────────────── */}
      {loading ? (
        <div className="h-60 animate-pulse rounded-xl bg-muted" />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Aucun avis pour l'instant"
          description="Ajoutez un avis manuellement ou demandez à vos clients de laisser leur avis."
        >
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter un avis
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{r.client_name}</span>
                    <StarRating rating={r.rating} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.review_date || r.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-foreground/80">{r.comment}</p>}
                  {r.response && (
                    <div className="mt-3 rounded-lg border-l-2 border-primary bg-muted/30 px-3 py-2 text-sm">
                      <div className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Votre réponse
                      </div>
                      <p className="mt-1 text-foreground/80">{r.response}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2"
                    onClick={() => togglePublishOnSite(r.id, r.is_published_on_site)}
                    title={
                      r.is_published_on_site ? 'Masquer du site vitrine' : 'Publier sur le site vitrine'
                    }
                  >
                    {r.is_published_on_site ? (
                      <Eye className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2"
                    onClick={() => openEdit(r)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                    onClick={() => deleteReview(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Dialog: Edit Google URL ───────────────────────────── */}
      <Dialog open={showEditUrl} onOpenChange={setShowEditUrl}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lien Google Avis</DialogTitle>
            <DialogDescription>
              Dans Google Maps ou votre fiche Google Business, copiez le lien « Laisser un avis »
              et collez-le ci-dessous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://g.page/r/..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowEditUrl(false)}>
                Annuler
              </Button>
              <Button onClick={saveGoogleUrl} disabled={savingUrl}>
                {savingUrl ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Ask for review ────────────────────────────── */}
      <Dialog open={showAsk} onOpenChange={setShowAsk}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Demander un avis Google</DialogTitle>
            <DialogDescription>
              Personnalisez le message puis copiez-le ou envoyez-le par SMS à votre client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Nom du client (optionnel)
              </label>
              <Input
                value={askClientName}
                onChange={(e) => setAskClientName(e.target.value)}
                placeholder="ex : Jean"
                className="mt-1"
              />
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <div className="font-medium text-muted-foreground">Message :</div>
              <p className="mt-1 text-foreground/80">
                {buildSmsMessage(askClientName, companyName || 'notre entreprise', googleReviewLink)}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  copyText(
                    buildSmsMessage(askClientName, companyName || 'notre entreprise', googleReviewLink),
                    'message',
                  )
                }
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                {copied === 'message' ? 'Copié' : 'Copier'}
              </Button>
              <Button onClick={() => openSms()}>
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Ouvrir SMS
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Review form ───────────────────────────────── */}
      <Dialog
        open={showForm}
        onOpenChange={(o) => {
          if (!o) {
            setShowForm(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier l’avis' : 'Nouvel avis'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nom du client</label>
              <Input
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Note</label>
              <div className="mt-1 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm({ ...form, rating: n })}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        'h-6 w-6',
                        n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Commentaire</label>
              <Textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                rows={3}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Votre réponse (optionnelle)
              </label>
              <Textarea
                value={form.response}
                onChange={(e) => setForm({ ...form, response: e.target.value })}
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                Annuler
              </Button>
              <Button onClick={saveReview} disabled={!form.client_name.trim()}>
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
