'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowUpRight,
  BadgeCheck,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Globe2,
  Link2,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  Star,
  Store,
  Unplug,
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

const GOOGLE_CREATE_PROFILE_URL = 'https://business.google.com/add';

interface GoogleLocation {
  accountName: string;
  accountDisplayName: string;
  locationName: string;
  reviewParent: string;
  title: string;
  websiteUri: string;
  mapsUri: string;
  newReviewUri: string;
  placeId: string;
}

interface GoogleReview {
  name: string;
  reviewerName: string;
  comment: string;
  starRating: number;
  updateTime: string;
  createTime: string;
  reviewReplyComment: string;
  reviewReplyUpdateTime: string;
}

interface ReviewRequestForm {
  clientName: string;
  email: string;
  phone: string;
}

interface GoogleStatusPayload {
  connected: boolean;
  locations: GoogleLocation[];
  selectedLocation: GoogleLocation | null;
  reviews: GoogleReview[];
  averageRating: number;
  totalReviewCount: number;
  error?: string;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const s = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn(s, i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

function buildReviewMessage(clientName: string, businessName: string, reviewLink: string) {
  const recipient = clientName.trim() || 'bonjour';
  return `Bonjour ${recipient}, merci encore pour votre confiance. Si vous avez 30 secondes, pourriez-vous laisser un avis sur Google pour ${businessName} ? Voici le lien direct : ${reviewLink}`;
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '');
}

interface LocalReviewRow {
  id: string;
  external_id: string | null;
  is_published_on_site: boolean;
}

export default function AvisPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<GoogleStatusPayload>({
    connected: false,
    locations: [],
    selectedLocation: null,
    reviews: [],
    averageRating: 0,
    totalReviewCount: 0,
  });
  const [showRequest, setShowRequest] = useState(false);
  const [showRespond, setShowRespond] = useState<GoogleReview | null>(null);
  const [requestForm, setRequestForm] = useState<ReviewRequestForm>({ clientName: '', email: '', phone: '' });
  const [responseText, setResponseText] = useState('');
  const [copiedState, setCopiedState] = useState<'link' | 'message' | null>(null);
  const [replyLoading, setReplyLoading] = useState(false);
  // Map external_id -> { id local, is_published_on_site } pour toggle publication sur le site
  const [localReviewsMap, setLocalReviewsMap] = useState<Map<string, LocalReviewRow>>(new Map());
  const [togglingReview, setTogglingReview] = useState<string | null>(null);
  const [siteSlug, setSiteSlug] = useState<string | null>(null);

  const loadLocalReviews = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('reviews')
      .select('id, external_id, is_published_on_site')
      .eq('user_id', user.id)
      .eq('external_source', 'google');
    const map = new Map<string, LocalReviewRow>();
    for (const row of (data || []) as LocalReviewRow[]) {
      if (row.external_id) map.set(row.external_id, row);
    }
    setLocalReviewsMap(map);
  }, [user]);

  const loadSiteSlug = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('artisan_sites')
      .select('slug, status')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data && data.status === 'published') {
      setSiteSlug(data.slug);
    } else {
      setSiteSlug(null);
    }
  }, [user]);

  const syncGoogleReviews = useCallback(async () => {
    // Sync les avis Google vers la table reviews locale pour que l'artisan
    // puisse les publier/masquer sur son site vitrine.
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/reviews/sync-google', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // best-effort, ne bloque pas la page
    }
    await loadLocalReviews();
  }, [loadLocalReviews]);

  const loadGoogleData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/google-business/status', { cache: 'no-store' });
      const data = (await response.json()) as GoogleStatusPayload;

      if (!response.ok) {
        throw new Error(data.error || 'Impossible de recuperer Google Business Profile');
      }

      setStatus(data);

      // Si Google est connecte, on sync vers la table locale pour les toggles publish/hide.
      if (data.connected && data.reviews.length > 0) {
        await syncGoogleReviews();
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Impossible de charger Google Business Profile');
    } finally {
      setLoading(false);
    }
  }, [syncGoogleReviews]);

  useEffect(() => {
    if (authLoading) return;
    loadSiteSlug();
    loadLocalReviews();
    loadGoogleData();
  }, [authLoading, loadGoogleData, loadLocalReviews, loadSiteSlug]);

  async function toggleReviewPublished(review: GoogleReview) {
    if (togglingReview) return;
    setTogglingReview(review.name);
    try {
      const existing = localReviewsMap.get(review.name);
      if (!existing) {
        // Pas encore synchronise : on force un sync puis on reouvre
        await syncGoogleReviews();
        setTogglingReview(null);
        return;
      }
      const nextValue = !existing.is_published_on_site;
      const { error: updateError } = await supabase
        .from('reviews')
        .update({ is_published_on_site: nextValue })
        .eq('id', existing.id);
      if (updateError) throw updateError;

      // Mise a jour locale optimiste
      const nextMap = new Map(localReviewsMap);
      nextMap.set(review.name, { ...existing, is_published_on_site: nextValue });
      setLocalReviewsMap(nextMap);

      // Revalidate le site publie (ISR) pour que le changement apparaisse en ligne
      if (siteSlug) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session) {
            await fetch('/api/site/revalidate', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ slug: siteSlug }),
            });
          }
        } catch {
          // silencieux : le toggle en DB est deja fait, ISR regenerera dans l'heure
        }
      }
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : 'Impossible de modifier la publication de cet avis'
      );
    } finally {
      setTogglingReview(null);
    }
  }

  useEffect(() => {
    const googleError = searchParams.get('google_error');
    if (googleError) {
      setError(googleError);
    }
  }, [searchParams]);

  async function copyText(value: string, kind: 'link' | 'message') {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedState(kind);
    window.setTimeout(() => setCopiedState(null), 1800);
  }

  async function changeLocation(locationName: string) {
    setSyncing(true);
    try {
      const response = await fetch('/api/google-business/select-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationName }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Impossible de changer de fiche');
      }
      await loadGoogleData();
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Impossible de changer de fiche');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnectGoogle() {
    setSyncing(true);
    try {
      await fetch('/api/google-business/disconnect', { method: 'POST' });
      await loadGoogleData();
    } finally {
      setSyncing(false);
    }
  }

  async function publishReply() {
    if (!showRespond || !responseText.trim()) return;
    setReplyLoading(true);
    try {
      const response = await fetch('/api/google-business/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewName: showRespond.name, comment: responseText.trim() }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Impossible de publier la reponse');
      }
      setShowRespond(null);
      setResponseText('');
      await loadGoogleData();
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : 'Impossible de publier la reponse');
    } finally {
      setReplyLoading(false);
    }
  }

  const selectedLocation = status.selectedLocation;
  const isConnected = status.connected && !!selectedLocation;
  const googleAccessPending =
    /quota exceeded|requests per minute|quota of 0|mybusinessaccountmanagement/i.test(error);
  const pendingReplies = status.reviews.filter((review) => !review.reviewReplyComment).length;
  const requestMessage = isConnected
    ? buildReviewMessage(requestForm.clientName, selectedLocation.title, selectedLocation.newReviewUri)
    : '';
  const googleApprovalProgress = googleAccessPending ? 78 : 0;

  const ratingDistribution = useMemo(
    () =>
      [5, 4, 3, 2, 1].map((rating) => {
        const count = status.reviews.filter((review) => review.starRating === rating).length;
        return {
          stars: rating,
          count,
          pct: status.reviews.length > 0 ? (count / status.reviews.length) * 100 : 0,
        };
      }),
    [status.reviews]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avis Google"
        description="Connectez votre fiche Google, gerez les avis reels et partagez le lien officiel en un clic."
      >
        {isConnected ? (
          <>
            <Button variant="outline" className="gap-2" onClick={() => window.open(selectedLocation.mapsUri || GOOGLE_CREATE_PROFILE_URL, '_blank')}>
              <Globe2 className="h-4 w-4" /> Ouvrir ma fiche
            </Button>
            <Button onClick={() => setShowRequest(true)} className="gap-2">
              <Send className="h-4 w-4" /> Demander un avis
            </Button>
          </>
        ) : googleAccessPending ? (
          <Button className="gap-2" variant="secondary" disabled>
            <Store className="h-4 w-4" /> Connexion Google en cours
          </Button>
        ) : (
          <Button className="gap-2" onClick={() => (window.location.href = '/api/google-business/connect')}>
            <Store className="h-4 w-4" /> Connecter Google
          </Button>
        )}
      </PageHeader>

      {error && (
        googleAccessPending ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-900">Connexion Google reussie</p>
            <p className="mt-1 text-sm text-amber-800">
              Votre compte Google est bien connecte a Hellobat.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Nous attendons maintenant l autorisation officielle de Google pour importer et gerer votre fiche et vos avis depuis l application.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Des que Google valide cet acces, votre fiche apparaitra ici automatiquement.
            </p>
            <div className="mt-4 rounded-xl border border-amber-200 bg-white/90 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Validation Google en cours</p>
                <span className="text-xs font-medium text-amber-700">{googleApprovalProgress}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-primary transition-all duration-500"
                  style={{ width: `${googleApprovalProgress}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-amber-700">
                Votre connexion est terminee. Il ne reste plus que l autorisation officielle de Google.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-amber-700">Connexion Google</p>
                <p className="mt-1 text-sm font-medium text-foreground">Reussie</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-amber-700">Autorisation Google</p>
                <p className="mt-1 text-sm font-medium text-foreground">En attente</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-amber-700">Import de la fiche</p>
                <p className="mt-1 text-sm font-medium text-foreground">En attente de validation</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-amber-700">
              Vous n avez rien d autre a faire pour le moment. Nous finaliserons automatiquement l acces des que Google aura valide notre demande.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )
      )}

      {!isConnected ? (
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Avis Google
            </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              {googleAccessPending
                ? 'Votre compte Google est bien relie. Nous attendons maintenant la validation de Google.'
                : status.connected
                  ? 'Votre compte Google est bien relie, mais aucune fiche n a encore ete trouvee.'
                  : 'Connectez votre fiche Google pour envoyer votre lien d avis en un clic.'}
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
              {googleAccessPending
                ? 'Des que Google nous autorise officiellement a importer et gerer votre fiche, elle apparaitra automatiquement ici.'
                : status.connected
                  ? 'Si votre fiche vient juste d etre creee, reconnectez Google dans quelques minutes.'
                  : 'Une fois connecte, vous pourrez copier votre lien d avis, voir les avis clients et y repondre depuis Hellobat.'}
              </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {!googleAccessPending && (
                <Button onClick={() => (window.location.href = '/api/google-business/connect')} className="gap-2">
                  <Link2 className="h-4 w-4" /> {status.connected ? 'Reconnecter Google' : 'Connecter ma fiche Google'}
                </Button>
              )}
              <Button variant="outline" className="gap-2" onClick={() => window.open(GOOGLE_CREATE_PROFILE_URL, '_blank')}>
                <ExternalLink className="h-4 w-4" /> Creer ma fiche Google
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                    <BadgeCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selectedLocation.title}</p>
                    <p className="text-xs text-muted-foreground">Fiche Google connectee</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={disconnectGoogle} disabled={syncing}>
                  <Unplug className="h-3.5 w-3.5" /> Deconnecter
                </Button>
              </div>

              {status.locations.length > 1 && (
                <div className="mt-4">
                  <label className="text-xs font-medium text-muted-foreground">Fiche selectionnee</label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedLocation.locationName}
                    onChange={(event) => changeLocation(event.target.value)}
                    disabled={syncing}
                  >
                    {status.locations.map((location) => (
                      <option key={location.locationName} value={location.locationName}>
                        {location.title} · {location.accountDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avis suivis</span>
                  <span className="font-medium text-foreground">{status.totalReviewCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reponses a faire</span>
                  <span className="font-medium text-foreground">{pendingReplies}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Place ID</span>
                  <span className="font-medium text-foreground">{selectedLocation.placeId || 'Indisponible'}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">Lien officiel d avis</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Google fournit ce lien pour demander un avis sur la fiche selectionnee.
              </p>
              <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground break-all">
                {selectedLocation.newReviewUri || 'Aucun lien d avis fourni par Google pour cette fiche'}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => copyText(selectedLocation.newReviewUri, 'link')}
                  disabled={!selectedLocation.newReviewUri}
                >
                  <Copy className="h-3.5 w-3.5" /> {copiedState === 'link' ? 'Lien copie' : 'Copier le lien'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(selectedLocation.newReviewUri || selectedLocation.mapsUri, '_blank')}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" /> Ouvrir
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground">Demande d avis rapide</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Prepare un message client pre-rempli avec le vrai lien Google de la fiche selectionnee.
              </p>
              <Button onClick={() => setShowRequest(true)} className="mt-4 w-full gap-2">
                <Send className="h-4 w-4" /> Ouvrir la demande client
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-foreground">{status.averageRating.toFixed(1)}</p>
                <div className="mt-2 flex justify-center">
                  <StarRating rating={Math.round(status.averageRating)} size="lg" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{status.totalReviewCount} avis Google</p>
              </div>
              <div className="mt-6 space-y-2">
                {ratingDistribution.map((item) => (
                  <div key={item.stars} className="flex items-center gap-2">
                    <span className="w-3 text-xs text-muted-foreground">{item.stars}</span>
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${item.pct}%` }} />
                    </div>
                    <span className="w-6 text-right text-xs text-muted-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Avis reels remontes depuis Google</h2>
                  <p className="text-sm text-muted-foreground">
                    Repondez depuis Hellobat sans sortir du logiciel.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={loadGoogleData} disabled={syncing}>
                  <Sparkles className="h-3.5 w-3.5" /> Actualiser
                </Button>
              </div>

              <div className="mt-5 space-y-4">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((index) => (
                      <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
                    ))}
                  </div>
                ) : status.reviews.length === 0 ? (
                  <EmptyState
                    icon={Star}
                    title="Aucun avis pour l'instant"
                    description="La connexion Google est active. Des qu un avis remonte sur cette fiche, il apparaitra ici."
                  >
                    <Button onClick={() => setShowRequest(true)} className="gap-2">
                      <Send className="h-4 w-4" /> Demander un avis
                    </Button>
                  </EmptyState>
                ) : (
                  status.reviews.map((review) => {
                    const localRow = localReviewsMap.get(review.name);
                    const isPublishedOnSite = localRow?.is_published_on_site ?? true;
                    const isToggling = togglingReview === review.name;
                    return (
                    <div key={review.name} className="rounded-xl border border-border bg-background p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {review.reviewerName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{review.reviewerName}</p>
                              <StarRating rating={review.starRating} />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              isPublishedOnSite
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-muted text-muted-foreground'
                            )}
                            title={
                              isPublishedOnSite
                                ? 'Cet avis est affiche sur votre site vitrine'
                                : 'Cet avis est masque de votre site vitrine'
                            }
                          >
                            {isPublishedOnSite ? 'Sur le site' : 'Masque'}
                          </span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-medium',
                              review.reviewReplyComment ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            )}
                          >
                            {review.reviewReplyComment ? 'Repondu' : 'En attente'}
                          </span>
                        </div>
                      </div>

                      {review.comment && <p className="mt-3 text-sm text-foreground">{review.comment}</p>}

                      {review.reviewReplyComment && (
                        <div className="mt-3 rounded-lg bg-muted/50 p-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Votre reponse</p>
                          <p className="text-sm text-foreground">{review.reviewReplyComment}</p>
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {!review.reviewReplyComment && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                setShowRespond(review);
                                setResponseText('');
                              }}
                            >
                              <MessageSquare className="h-3 w-3" /> Repondre
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1">
                              <Sparkles className="h-3 w-3" /> Reponse IA
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => toggleReviewPublished(review)}
                          disabled={isToggling || !siteSlug}
                          title={
                            !siteSlug
                              ? 'Publiez d abord votre site vitrine pour gerer la visibilite des avis'
                              : undefined
                          }
                        >
                          {isPublishedOnSite ? (
                            <>
                              <EyeOff className="h-3 w-3" />{' '}
                              {isToggling ? 'Masquage...' : 'Masquer du site'}
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" />{' '}
                              {isToggling ? 'Publication...' : 'Afficher sur le site'}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <Dialog open={showRequest} onOpenChange={setShowRequest}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preparer une demande d avis</DialogTitle>
            <DialogDescription>
              Remplissez juste le nom du client, puis copiez le message.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Nom du client</label>
              <Input
                className="mt-1"
                placeholder="Ex : Mme Martin"
                value={requestForm.clientName}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, clientName: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                className="mt-1"
                type="email"
                placeholder="client@email.com"
                value={requestForm.email}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Telephone / WhatsApp (optionnel)</label>
              <Input
                className="mt-1"
                placeholder="06 12 34 56 78"
                value={requestForm.phone}
                onChange={(event) => setRequestForm((prev) => ({ ...prev, phone: event.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Message pret a envoyer</label>
              <Textarea className="mt-1 min-h-[160px]" value={requestMessage} readOnly />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => copyText(requestMessage, 'message')} disabled={!requestMessage} className="gap-2">
              <Copy className="h-4 w-4" /> {copiedState === 'message' ? 'Message copie' : 'Copier le message'}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!requestForm.email || !requestMessage}
              onClick={() => {
                const subject = encodeURIComponent(`Votre avis pour ${selectedLocation?.title || 'notre entreprise'}`);
                const body = encodeURIComponent(requestMessage);
                window.open(`mailto:${requestForm.email}?subject=${subject}&body=${body}`, '_blank');
              }}
            >
              <Mail className="h-4 w-4" /> Ouvrir l email
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!requestForm.phone || !requestMessage}
              onClick={() => {
                const phone = normalizePhone(requestForm.phone);
                const body = encodeURIComponent(requestMessage);
                window.open(`https://wa.me/${phone}?text=${body}`, '_blank');
              }}
            >
              <Send className="h-4 w-4" /> Ouvrir WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRespond} onOpenChange={() => setShowRespond(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repondre a {showRespond?.reviewerName}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {showRespond && (
              <div className="rounded-lg bg-muted/50 p-3">
                <StarRating rating={showRespond.starRating} />
                <p className="mt-2 text-sm text-foreground">{showRespond.comment}</p>
              </div>
            )}
            <Textarea
              className="min-h-[140px]"
              placeholder="Votre reponse..."
              value={responseText}
              onChange={(event) => setResponseText(event.target.value)}
            />
            <div className="flex items-center justify-between">
              <Button variant="outline" className="gap-2">
                <Sparkles className="h-4 w-4" /> Generer avec l IA
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowRespond(null)}>
                  Annuler
                </Button>
                <Button onClick={publishReply} disabled={!responseText.trim() || replyLoading}>
                  {replyLoading ? 'Publication...' : 'Publier'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
