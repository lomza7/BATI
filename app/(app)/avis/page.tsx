'use client';

import { useState, useEffect } from 'react';
import { Star, Plus, Send, MessageSquare, Sparkles, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  client_name: string;
  rating: number;
  comment: string;
  response: string;
  status: string;
  created_at: string;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const s = size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={cn(s, i <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

export default function AvisPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequest, setShowRequest] = useState(false);
  const [showRespond, setShowRespond] = useState<Review | null>(null);
  const [requestForm, setRequestForm] = useState({ clientName: '', email: '' });
  const [responseText, setResponseText] = useState('');

  useEffect(() => { loadReviews(); }, []);

  async function loadReviews() {
    const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
    setReviews((data as unknown as Review[]) || []);
    setLoading(false);
  }

  async function sendResponse() {
    if (!showRespond) return;
    await supabase.from('reviews').update({ response: responseText, status: 'repondu' }).eq('id', showRespond.id);
    setShowRespond(null);
    setResponseText('');
    loadReviews();
  }

  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const ratingDistribution = [5, 4, 3, 2, 1].map(r => ({
    stars: r,
    count: reviews.filter(rev => rev.rating === r).length,
    pct: reviews.length > 0 ? (reviews.filter(rev => rev.rating === r).length / reviews.length) * 100 : 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Avis Google" description="Gerez et repondez a vos avis clients">
        <Button onClick={() => setShowRequest(true)} className="gap-2">
          <Send className="h-4 w-4" /> Demander un avis
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="text-center">
            <p className="text-3xl sm:text-4xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
            <div className="flex justify-center mt-2"><StarRating rating={Math.round(avgRating)} size="lg" /></div>
            <p className="mt-1 text-sm text-muted-foreground">{reviews.length} avis</p>
          </div>
          <div className="mt-6 space-y-2">
            {ratingDistribution.map(r => (
              <div key={r.stars} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-3">{r.stars}</span>
                <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${r.pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-6 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : reviews.length === 0 ? (
            <EmptyState icon={Star} title="Aucun avis" description="Demandez a vos clients de laisser un avis apres chaque chantier.">
              <Button onClick={() => setShowRequest(true)} className="gap-2"><Send className="h-4 w-4" /> Demander un avis</Button>
            </EmptyState>
          ) : (
            reviews.map(review => (
              <div key={review.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {review.client_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{review.client_name}</p>
                        <StarRating rating={review.rating} />
                      </div>
                    </div>
                  </div>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    review.status === 'repondu' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  )}>
                    {review.status === 'repondu' ? 'Repondu' : 'En attente'}
                  </span>
                </div>
                {review.comment && <p className="mt-3 text-sm text-foreground">{review.comment}</p>}
                {review.response ? (
                  <div className="mt-3 rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Votre reponse :</p>
                    <p className="text-sm text-foreground">{review.response}</p>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => { setShowRespond(review); setResponseText(''); }}>
                      <MessageSquare className="h-3 w-3" /> Repondre
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Sparkles className="h-3 w-3" /> Reponse IA
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={showRequest} onOpenChange={setShowRequest}>
        <DialogContent>
          <DialogHeader><DialogTitle>Demander un avis</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Envoyez une demande d&apos;avis a votre client par email</p>
            <div><label className="text-sm font-medium">Nom du client</label><Input className="mt-1" placeholder="Prenom Nom" value={requestForm.clientName} onChange={e => setRequestForm({ ...requestForm, clientName: e.target.value })} /></div>
            <div><label className="text-sm font-medium">Email</label><Input className="mt-1" type="email" placeholder="client@email.com" value={requestForm.email} onChange={e => setRequestForm({ ...requestForm, email: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRequest(false)}>Annuler</Button>
              <Button disabled={!requestForm.clientName || !requestForm.email} className="gap-2"><Send className="h-4 w-4" /> Envoyer la demande</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showRespond} onOpenChange={() => setShowRespond(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Repondre a {showRespond?.client_name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            {showRespond && (
              <div className="rounded-lg bg-muted/50 p-3">
                <StarRating rating={showRespond.rating} />
                <p className="mt-2 text-sm text-foreground">{showRespond.comment}</p>
              </div>
            )}
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              rows={4}
              placeholder="Votre reponse..."
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <Button variant="outline" className="gap-2"><Sparkles className="h-4 w-4" /> Generer avec l&apos;IA</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowRespond(null)}>Annuler</Button>
                <Button onClick={sendResponse} disabled={!responseText.trim()}>Publier</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
