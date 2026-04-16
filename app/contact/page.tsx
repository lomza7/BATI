'use client';

import { useRef, useState } from 'react';
import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { Mail, MapPin, Calendar, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { Turnstile, type TurnstileHandle } from '@/components/shared/turnstile';

const SUBJECTS = [
  'Question sur Hellobat',
  'Demande de démo',
  'Problème technique',
  'Partenariat',
  'Autre',
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [honeypot, setHoneypot] = useState('');
  const [form, setForm] = useState({ name: '', email: '', subject: SUBJECTS[0], message: '' });
  const turnstileRef = useRef<TurnstileHandle>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          turnstile_token: turnstileToken,
          company_website: honeypot,
        }),
      });

      if (res.status === 429) {
        setError('Trop de tentatives. Réessayez dans quelques instants.');
        turnstileRef.current?.reset();
        setTurnstileToken('');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || 'Envoi impossible. Réessayez plus tard.');
        turnstileRef.current?.reset();
        setTurnstileToken('');
        return;
      }

      setSent(true);
    } catch (err) {
      console.warn('[contact] submit failed', err);
      setError('Erreur réseau. Vérifiez votre connexion.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--landing-white)]">
      <Navbar />

      <main className="pt-28 pb-16 sm:pt-36 sm:pb-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-[var(--landing-text)] mb-4">
              Parlons de votre projet
            </h1>
            <p className="text-base sm:text-lg text-[var(--landing-muted)] max-w-xl mx-auto">
              Une question, une démo, un partenariat ? On vous répond sous 24h.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-5">
            {/* Left: Contact info + Cal.com */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-6 space-y-5">
                <h2 className="text-base font-semibold text-[var(--landing-text)]">
                  Coordonnées
                </h2>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-[var(--landing-accent)]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--landing-text)]">Email</div>
                    <a href="mailto:contact@hellobat.app" className="text-sm text-[var(--landing-muted)] hover:text-[var(--landing-accent)] transition-colors">
                      contact@hellobat.app
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-[var(--landing-accent)]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[var(--landing-text)]">Adresse</div>
                    <div className="text-sm text-[var(--landing-muted)]">
                      200 rue de la Croix Nivert<br />
                      75015 Paris, France
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--landing-border)] bg-[var(--landing-off)] p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-[var(--landing-accent)] flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--landing-text)]">
                      Réserver un créneau
                    </div>
                    <div className="text-xs text-[var(--landing-muted)]">
                      30 min de démo gratuite
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--landing-muted)] mb-4 leading-relaxed">
                  Prenez rendez-vous directement avec Louis pour une démo
                  personnalisée de Hellobat adaptée à votre métier.
                </p>
                <a
                  href="https://cal.com/hellobat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-full bg-[var(--landing-accent)] text-white text-sm font-medium hover:bg-[#b94800] transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Choisir un créneau
                </a>
              </div>
            </div>

            {/* Right: Form */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-[var(--landing-border)] bg-white p-6 sm:p-8">
                {sent ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--landing-text)] mb-2">
                      Message envoyé !
                    </h3>
                    <p className="text-sm text-[var(--landing-muted)] max-w-xs">
                      Merci pour votre message. On vous répond sous 24h, promis.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <h2 className="text-base font-semibold text-[var(--landing-text)] mb-1">
                      Envoyez-nous un message
                    </h2>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--landing-text)] mb-1.5">
                          Nom complet
                        </label>
                        <input
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="Jean Dupont"
                          className="w-full px-3 py-2.5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]/20 focus:border-[var(--landing-accent)]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--landing-text)] mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="jean@entreprise.fr"
                          className="w-full px-3 py-2.5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]/20 focus:border-[var(--landing-accent)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--landing-text)] mb-1.5">
                        Sujet
                      </label>
                      <select
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] text-sm text-[var(--landing-text)] focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]/20 focus:border-[var(--landing-accent)]"
                      >
                        {SUBJECTS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--landing-text)] mb-1.5">
                        Message
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        placeholder="Décrivez votre projet ou votre question…"
                        className="w-full px-3 py-2.5 rounded-xl border border-[var(--landing-border)] bg-[var(--landing-off)] text-sm text-[var(--landing-text)] placeholder:text-[var(--landing-muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--landing-accent)]/20 focus:border-[var(--landing-accent)] resize-none"
                      />
                    </div>

                    {/* Honeypot : champ invisible — les bots le remplissent, les humains non */}
                    <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }}>
                      <label>
                        Ne pas remplir
                        <input
                          type="text"
                          tabIndex={-1}
                          autoComplete="off"
                          value={honeypot}
                          onChange={(e) => setHoneypot(e.target.value)}
                        />
                      </label>
                    </div>

                    <Turnstile ref={turnstileRef} onVerify={setTurnstileToken} />

                    {error && (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-[var(--landing-accent)] text-white text-sm font-medium hover:bg-[#b94800] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Envoi en cours…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Envoyer le message
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
