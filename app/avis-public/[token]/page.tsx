'use client';

import { use, useEffect, useState } from 'react';
import { Star, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function AvisPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    rating: 5,
    comment: '',
  });

  useEffect(() => {
    fetch(`/api/reviews/public?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setCompanyName(d.company_name);
        setLogoUrl(d.logo_url);
      })
      .catch(() => setNotFound(true));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.client_name.trim()) return;
    setSubmitting(true);
    const res = await fetch('/api/reviews/public', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...form }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || 'Une erreur est survenue.');
      return;
    }
    setDone(true);
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <p className="text-sm text-muted-foreground">Lien introuvable.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
        <div className="max-w-md w-full text-center space-y-4 bg-white rounded-2xl border p-8 shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
          <h1 className="text-xl font-semibold">Merci pour votre avis !</h1>
          <p className="text-sm text-muted-foreground">
            Votre retour a bien été transmis à {companyName}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50">
      <form onSubmit={submit} className="max-w-md w-full bg-white rounded-2xl border p-6 sm:p-8 shadow-sm space-y-5">
        <div className="text-center space-y-2">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={companyName ?? ''} className="h-12 mx-auto" />
          )}
          <h1 className="text-xl font-semibold">Laissez votre avis</h1>
          {companyName && (
            <p className="text-sm text-muted-foreground">à propos de {companyName}</p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Votre note</label>
          <div className="mt-1 flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setForm({ ...form, rating: n })}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    'h-9 w-9',
                    n <= form.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30',
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Votre nom</label>
          <Input
            value={form.client_name}
            onChange={(e) => setForm({ ...form, client_name: e.target.value })}
            className="mt-1"
            required
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Votre email (optionnel)</label>
          <Input
            type="email"
            value={form.client_email}
            onChange={(e) => setForm({ ...form, client_email: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Votre commentaire</label>
          <Textarea
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            rows={4}
            className="mt-1"
            placeholder="Décrivez votre expérience…"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting || !form.client_name.trim()} className="w-full">
          {submitting ? 'Envoi…' : 'Envoyer mon avis'}
        </Button>
      </form>
    </div>
  );
}
