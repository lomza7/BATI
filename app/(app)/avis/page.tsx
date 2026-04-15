'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Mail,
  Pencil,
  Send,
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LocalReview {
  id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  response: string | null;
  status: string;
  review_date: string | null;
  created_at: string;
  is_published_on_site: boolean;
  external_source: string;
  client_email: string | null;
}

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  google: { label: 'Google', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  manual: { label: 'Manuel', color: 'bg-stone-50 text-stone-700 border-stone-200' },
  public: { label: 'Site web', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

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

export default function AvisPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<LocalReview[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [googleReviewLink, setGoogleReviewLink] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [publicToken, setPublicToken] = useState('');
  const [siteUrl, setSiteUrl] = useState<string | null>(null);

  // Onboarding state
  const [showGoogleDialog, setShowGoogleDialog] = useState(false);
  const [googleInput, setGoogleInput] = useState('');
  const [importing, setImporting] = useState(false);

  // Bulk request emails
  const [showRequest, setShowRequest] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; email: string | null; last_review_request_at: string | null }[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [reqSubject, setReqSubject] = useState('');
  const [reqBody, setReqBody] = useState('');
  const [sending, setSending] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  // Manual review CRUD
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<LocalReview | null>(null);
  const [form, setForm] = useState({ client_name: '', rating: 5, comment: '', response: '' });

  const loadAll = useCallback(async () => {
    if (!user) return;
    const [profileRes, reviewsRes, siteRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('company_name, google_review_link, google_place_id, public_review_token, google_reviews_last_synced_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('reviews')
        .select('id, client_name, rating, comment, response, status, review_date, created_at, is_published_on_site, external_source, client_email')
        .eq('user_id', user.id)
        .order('review_date', { ascending: false, nullsFirst: false }),
      supabase
        .from('artisan_sites')
        .select('slug, status')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    let lastSyncedAt: string | null = null;
    if (profileRes.data) {
      setCompanyName(profileRes.data.company_name || '');
      setGoogleReviewLink(profileRes.data.google_review_link || '');
      setGooglePlaceId(profileRes.data.google_place_id || '');
      setPublicToken(profileRes.data.public_review_token || '');
      lastSyncedAt = profileRes.data.google_reviews_last_synced_at || null;
    }
    setReviews((reviewsRes.data || []) as LocalReview[]);
    if (siteRes.data?.slug && siteRes.data?.status === 'published') {
      setSiteUrl(`https://${siteRes.data.slug}.hellobat.app`);
    }
    return { placeId: profileRes.data?.google_place_id, lastSyncedAt };
  }, [user]);

  // Lazy auto-refresh Google reviews if last sync > 24h
  const autoRefreshGoogle = useCallback(async (placeId: string | null | undefined, lastSyncedAt: string | null) => {
    if (!placeId) return;
    const stale = !lastSyncedAt || (Date.now() - new Date(lastSyncedAt).getTime() > 24 * 3600 * 1000);
    if (!stale) return;
    const { data: session } = await supabase.auth.getSession();
    const tokenStr = session.session?.access_token;
    if (!tokenStr) return;
    await fetch('/api/reviews/import-google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStr}` },
      body: JSON.stringify({ input: placeId }),
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    loadAll().then((info) => {
      if (info?.placeId) {
        autoRefreshGoogle(info.placeId, info.lastSyncedAt).then(() => loadAll());
      }
    }).finally(() => setLoading(false));
  }, [authLoading, user, loadAll, autoRefreshGoogle]);

  async function openRequestDialog() {
    if (!user) return;
    if (!publicToken) return;
    const { data } = await supabase
      .from('clients')
      .select('id, name, email, last_review_request_at')
      .eq('user_id', user.id)
      .not('email', 'is', null)
      .order('name');
    setClients((data || []) as typeof clients);
    setSelectedClientIds(new Set());
    setClientSearch('');
    setReqSubject(`${companyName || 'Notre entreprise'} — votre avis nous intéresse`);
    setReqBody(
      `Bonjour {{nom}},\n\nMerci pour votre confiance ! Si vous avez 30 secondes, votre avis nous aiderait beaucoup.\n\nIl vous suffit de cliquer sur le bouton ci-dessous pour laisser votre retour.\n\nMerci d'avance,\n${companyName || ''}`,
    );
    setShowRequest(true);
  }

  async function sendRequests() {
    if (!user || selectedClientIds.size === 0) return;
    setSending(true);
    const { data: session } = await supabase.auth.getSession();
    const tokenStr = session.session?.access_token;
    if (!tokenStr) { setSending(false); return; }
    const res = await fetch('/api/reviews/request-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStr}` },
      body: JSON.stringify({
        clientIds: Array.from(selectedClientIds),
        subject: reqSubject,
        body: reqBody,
      }),
    });
    setSending(false);
    const json = await res.json();
    if (!res.ok) {
      toast({ title: 'Envoi impossible', description: json.error, variant: 'destructive' });
      return;
    }
    toast({
      title: `${json.sent} email${json.sent > 1 ? 's' : ''} envoyé${json.sent > 1 ? 's' : ''}`,
      description: json.errors?.length ? `${json.errors.length} échec(s)` : undefined,
    });
    setShowRequest(false);
  }

  function toggleClient(id: string) {
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filteredClients = clients.filter((c) => {
    if (!clientSearch.trim()) return true;
    const q = clientSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  function toggleAllClients() {
    const allFilteredSelected = filteredClients.every((c) => selectedClientIds.has(c.id));
    setSelectedClientIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredClients.forEach((c) => next.delete(c.id));
      } else {
        filteredClients.forEach((c) => next.add(c.id));
      }
      return next;
    });
  }

  async function importGoogle() {
    if (!googleInput.trim() || !user) return;
    setImporting(true);
    const { data: session } = await supabase.auth.getSession();
    const tokenStr = session.session?.access_token;
    if (!tokenStr) {
      setImporting(false);
      return;
    }
    const res = await fetch('/api/reviews/import-google', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenStr}`,
      },
      body: JSON.stringify({ input: googleInput.trim() }),
    });
    setImporting(false);
    const json = await res.json();
    if (!res.ok) {
      toast({ title: 'Import impossible', description: json.error, variant: 'destructive' });
      return;
    }
    toast({
      title: `${json.imported} avis importés`,
      description: `Note Google : ${json.rating ?? '–'} (${json.total ?? 0} avis au total)`,
    });
    setShowGoogleDialog(false);
    setGoogleInput('');
    loadAll();
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
        is_published_on_site: true,
      });
    }
    setShowForm(false);
    setEditing(null);
    setForm({ client_name: '', rating: 5, comment: '', response: '' });
    loadAll();
  }

  async function deleteReview(id: string) {
    if (!confirm('Supprimer cet avis ?')) return;
    await supabase.from('reviews').delete().eq('id', id);
    loadAll();
  }

  async function togglePublishOnSite(id: string, current: boolean) {
    await supabase.from('reviews').update({ is_published_on_site: !current }).eq('id', id);
    loadAll();
  }

  function openEdit(r: LocalReview) {
    setEditing(r);
    setForm({
      client_name: r.client_name,
      rating: r.rating,
      comment: r.comment ?? '',
      response: r.response ?? '',
    });
    setShowForm(true);
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copié` });
  }

  const averageRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;
  const publishedCount = reviews.filter((r) => r.is_published_on_site).length;
  const pendingCount = reviews.filter((r) => r.external_source === 'public' && !r.is_published_on_site).length;

  const publicReviewUrl = publicToken
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://hellobat.app'}/avis-public/${publicToken}`
    : '';

  const isOnboarded = Boolean(googlePlaceId || googleReviewLink);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avis clients"
        description="Centralisez vos avis Google et collectez de nouveaux avis sur votre site."
      >
        <div className="flex flex-wrap gap-2">
          {publicToken && (
            <Button onClick={openRequestDialog} className="gap-2">
              <Mail className="h-4 w-4" />
              Demander des avis
            </Button>
          )}
        </div>
      </PageHeader>

      {/* ─── Onboarding : pas encore configuré ────────────────────── */}
      {!isOnboarded && !loading && (
        <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-white p-4 sm:p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Globe className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold">Avez-vous une fiche Google Business ?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Indispensable pour le référencement local. Importez vos avis Google en un clic
                pour les afficher sur votre site vitrine.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => setShowGoogleDialog(true)} className="gap-2">
                  <Download className="h-4 w-4" />
                  Oui, importer mes avis Google
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <a href="https://www.google.com/business/" target="_blank" rel="noreferrer">
                    Non, créer ma fiche Google
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Stats ─────────────────────────────────────────────── */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Note moyenne</div>
            <div className="mt-1 flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-bold">{averageRating.toFixed(1)}</span>
              <StarRating rating={Math.round(averageRating)} />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Total</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold">{reviews.length}</div>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">Publiés site</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold">{publishedCount}</div>
          </div>
          <div className="rounded-xl border bg-card p-3 sm:p-4">
            <div className="text-[11px] sm:text-xs text-muted-foreground">À modérer</div>
            <div className="mt-1 text-xl sm:text-2xl font-bold text-amber-700">{pendingCount}</div>
          </div>
        </div>
      )}

      {/* ─── Cartes Google + Lien public ──────────────────────────── */}
      {isOnboarded && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Google */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">Fiche Google Business</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {googlePlaceId ? 'Connectée — réimportez quand vous voulez' : 'Lien enregistré'}
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setShowGoogleDialog(true)}>
                <Download className="h-3.5 w-3.5" />
                {googlePlaceId ? 'Réimporter' : 'Importer'}
              </Button>
            </div>
            {googleReviewLink && (
              <div className="mt-3 rounded-lg border bg-muted/30 overflow-hidden">
                <div className="px-3 py-2 text-[11px] sm:text-xs font-mono break-all">
                  {googleReviewLink}
                </div>
                <div className="flex items-center justify-end gap-1 border-t bg-background/50 px-2 py-1">
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => copy(googleReviewLink, 'Lien Google')}>
                    <Copy className="h-3 w-3" />
                    Copier
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" asChild>
                    <a href={googleReviewLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" />
                      Ouvrir
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Lien public */}
          <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Lien avis site web</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vos clients laissent un avis directement sur votre Hellobat
              </p>
            </div>
            <div className="mt-3 rounded-lg border bg-muted/30 overflow-hidden">
              <div className="px-3 py-2 text-[11px] sm:text-xs font-mono break-all">
                {publicReviewUrl}
              </div>
              <div className="flex items-center justify-end gap-1 border-t bg-background/50 px-2 py-1">
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => copy(publicReviewUrl, 'Lien')}>
                  <Copy className="h-3 w-3" />
                  Copier
                </Button>
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" asChild>
                  <a href={publicReviewUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    Aperçu
                  </a>
                </Button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              À envoyer par email à la fin de chaque chantier. Les avis reçus passent en modération.
            </p>
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
          description="Importez vos avis Google ou demandez-en à vos clients par email."
        >
          {googlePlaceId || googleReviewLink ? (
            <Button onClick={openRequestDialog} variant="outline" className="gap-2">
              <Mail className="h-4 w-4" />
              Demander des avis
            </Button>
          ) : (
            <Button onClick={() => setShowGoogleDialog(true)} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Importer mes avis Google
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const src = SOURCE_LABEL[r.external_source] || SOURCE_LABEL.manual;
            const isPending = r.external_source === 'public' && !r.is_published_on_site;
            return (
              <div
                key={r.id}
                className={cn(
                  'rounded-xl border bg-card p-3 sm:p-4 shadow-sm',
                  isPending && 'border-amber-300 bg-amber-50/40',
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-sm sm:text-base">{r.client_name}</span>
                  <StarRating rating={r.rating} />
                  <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', src.color)}>
                    {src.label}
                  </span>
                  {isPending && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-300">
                      En attente
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(r.review_date || r.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {r.client_email && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground truncate">{r.client_email}</div>
                )}
                {r.comment && <p className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap break-words">{r.comment}</p>}
                {r.response && (
                  <div className="mt-3 rounded-lg border-l-2 border-primary bg-muted/30 px-3 py-2 text-sm">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">Votre réponse</div>
                    <p className="mt-1 text-foreground/80 break-words">{r.response}</p>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-end gap-1 border-t pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2"
                    onClick={() => togglePublishOnSite(r.id, r.is_published_on_site)}
                    title={r.is_published_on_site ? 'Masquer du site' : 'Publier sur le site'}
                  >
                    {r.is_published_on_site ? (
                      <Eye className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive hover:text-destructive"
                    onClick={() => deleteReview(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Dialog : Import Google ───────────────────────────── */}
      <Dialog open={showGoogleDialog} onOpenChange={setShowGoogleDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importer mes avis Google</DialogTitle>
            <DialogDescription>
              Hellobat récupère les 5 avis les plus récents de votre fiche Google
              (limite officielle de Google) et la note moyenne globale.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-3">
            {/* Guide pas-à-pas */}
            <div className="rounded-xl border bg-amber-50/50 border-amber-200 p-4 text-sm">
              <div className="font-semibold text-amber-900 mb-2">
                Comment trouver le lien de votre fiche Google&nbsp;?
              </div>
              <ol className="space-y-2 text-amber-900/90 list-decimal list-inside text-[13px] leading-relaxed">
                <li>
                  Ouvrez{' '}
                  <a
                    href="https://www.google.com/maps"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-medium"
                  >
                    Google Maps
                  </a>
                </li>
                <li>Cherchez le nom de votre entreprise (ex&nbsp;: « BATIMAAZA Paris »)</li>
                <li>Cliquez sur votre fiche dans les résultats</li>
                <li>
                  Cliquez sur le bouton <strong>Partager</strong> (icône flèche ↗)
                </li>
                <li>
                  Onglet <strong>« Envoyer un lien »</strong> → bouton <strong>« Copier le lien »</strong>
                </li>
                <li>Collez ci-dessous et cliquez sur Importer</li>
              </ol>
              <p className="mt-3 text-[11px] text-amber-800">
                Pas de fiche Google&nbsp;?{' '}
                <a
                  href="https://www.google.com/business/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-medium"
                >
                  Créez-en une ici
                </a>{' '}
                — c&apos;est gratuit et indispensable pour le référencement local.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Lien Google Maps de votre fiche
              </label>
              <Input
                value={googleInput}
                onChange={(e) => setGoogleInput(e.target.value)}
                placeholder="https://maps.app.goo.gl/… ou https://www.google.com/maps/…"
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowGoogleDialog(false)}>Annuler</Button>
              <Button onClick={importGoogle} disabled={importing || !googleInput.trim()} className="gap-2">
                <Download className="h-4 w-4" />
                {importing ? 'Import…' : 'Importer mes avis'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog : Manual review ────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Modifier l\u2019avis' : 'Nouvel avis'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nom du client</label>
              <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="mt-1" />
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
                    <Star className={cn('h-6 w-6', n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Commentaire</label>
              <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Votre réponse (optionnelle)</label>
              <Textarea value={form.response} onChange={(e) => setForm({ ...form, response: e.target.value })} rows={3} className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button onClick={saveReview} disabled={!form.client_name.trim()}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {siteUrl && (
        <p className="text-xs text-muted-foreground text-center">
          Les avis publiés s&apos;affichent sur votre site vitrine&nbsp;:{' '}
          <a href={siteUrl} target="_blank" rel="noreferrer" className="underline">{siteUrl}</a>
        </p>
      )}

      {/* ─── Dialog : Demander des avis par email ───────────────── */}
      <Dialog open={showRequest} onOpenChange={setShowRequest}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demander des avis par email</DialogTitle>
            <DialogDescription>
              Sélectionnez vos clients, personnalisez le message — utilisez{' '}
              <code className="text-xs bg-muted px-1 rounded">{'{{nom}}'}</code> et{' '}
              <code className="text-xs bg-muted px-1 rounded">{'{{lien}}'}</code> dans le texte.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Client picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Destinataires ({selectedClientIds.size} sélectionné{selectedClientIds.size > 1 ? 's' : ''} / {clients.length})
                </label>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleAllClients}>
                  {filteredClients.every((c) => selectedClientIds.has(c.id)) && filteredClients.length > 0
                    ? 'Tout désélectionner'
                    : 'Tout sélectionner'}
                </Button>
              </div>
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Rechercher un client par nom ou email…"
                className="mb-2"
              />
              <div className="max-h-64 overflow-y-auto rounded-lg border">
                {clients.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground text-center">
                    Aucun client avec un email enregistré.
                  </p>
                ) : filteredClients.length === 0 ? (
                  <p className="p-4 text-xs text-muted-foreground text-center">
                    Aucun résultat pour « {clientSearch} ».
                  </p>
                ) : (
                  filteredClients.map((c) => {
                    const checked = selectedClientIds.has(c.id);
                    const requested = c.last_review_request_at
                      ? new Date(c.last_review_request_at).toLocaleDateString('fr-FR')
                      : null;
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 border-b last:border-0',
                          checked && 'bg-primary/5',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleClient(c.id)}
                          className="h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{c.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                        </div>
                        {requested && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            Demandé le {requested}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Sujet</label>
              <Input value={reqSubject} onChange={(e) => setReqSubject(e.target.value)} className="mt-1" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Message</label>
              <Textarea
                value={reqBody}
                onChange={(e) => setReqBody(e.target.value)}
                rows={8}
                className="mt-1 font-mono text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Le bouton « Laisser un avis » est ajouté automatiquement à la fin de l&apos;email.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowRequest(false)}>Annuler</Button>
              <Button onClick={sendRequests} disabled={sending || selectedClientIds.size === 0} className="gap-2">
                <Send className="h-4 w-4" />
                {sending ? 'Envoi…' : `Envoyer (${selectedClientIds.size})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
