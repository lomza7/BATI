'use client';

import { useEffect, useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { Turnstile } from '@/components/shared/turnstile';

interface SiteQuoteModalProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  companyName: string;
  ctaText?: string;
}

export function SiteQuoteModal({ open, onClose, slug, companyName, ctaText }: SiteQuoteModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [project, setProject] = useState('');
  const [budget, setBudget] = useState('');
  // Honeypot field
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // Reset form when reopening
  useEffect(() => {
    if (open) {
      setSuccess(false);
      setError('');
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (captchaToken === null) {
      setError('Vérification anti-bot en cours, réessayez dans un instant');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/site/quote-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          email,
          phone,
          address,
          postal_code: postalCode,
          city,
          project,
          budget,
          company_website: companyWebsite,
          turnstile_token: captchaToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Erreur lors de l\u2019envoi');
      }

      setSuccess(true);
      // Reset form fields after success
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setPostalCode('');
      setCity('');
      setProject('');
      setBudget('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\u2019envoi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-quote-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          backgroundColor: 'var(--site-card-bg)',
          borderRadius: 'var(--site-radius)',
          border: '1px solid var(--site-card-border)',
          color: 'var(--site-text)',
          fontFamily: 'var(--site-font)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b"
          style={{
            backgroundColor: 'var(--site-card-bg)',
            borderColor: 'var(--site-card-border)',
          }}
        >
          <div>
            <h2
              id="site-quote-modal-title"
              className="text-lg sm:text-xl font-bold"
              style={{ color: 'var(--site-heading)' }}
            >
              {ctaText || 'Demander un devis gratuit'}
            </h2>
            <p className="text-xs sm:text-sm mt-0.5" style={{ color: 'var(--site-text-muted)' }}>
              {success
                ? 'Votre demande a ete envoyee'
                : `Reponse rapide et personnalisee par ${companyName}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-md hover:bg-black/5 transition-colors"
            aria-label="Fermer"
            style={{ color: 'var(--site-text-muted)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {success ? (
          <div className="px-5 sm:px-6 py-10 text-center">
            <div
              className="inline-flex w-16 h-16 items-center justify-center rounded-full mb-4"
              style={{ backgroundColor: 'var(--site-accent-light)' }}
            >
              <Check className="w-8 h-8" style={{ color: 'var(--site-accent)' }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--site-heading)' }}>
              Merci pour votre demande
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--site-text-muted)' }}>
              {companyName} a bien recu votre message et vous recontactera tres rapidement.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-block text-sm font-semibold px-6 py-2.5 transition-all hover:scale-105"
              style={{
                backgroundColor: 'var(--site-accent)',
                color: '#ffffff',
                borderRadius: 'var(--site-radius)',
              }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
            {/* Honeypot — hidden from users, visible to bots */}
            <div style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
              <label>
                Site web
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={companyWebsite}
                  onChange={e => setCompanyWebsite(e.target.value)}
                />
              </label>
            </div>

            <FieldLabel required>Votre nom</FieldLabel>
            <ThemedInput
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jean Dupont"
              autoComplete="name"
              maxLength={120}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <FieldLabel required>Telephone</FieldLabel>
                <ThemedInput
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  autoComplete="tel"
                  maxLength={40}
                />
              </div>
              <div>
                <FieldLabel required>Email</FieldLabel>
                <ThemedInput
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jean@exemple.fr"
                  autoComplete="email"
                  maxLength={200}
                />
              </div>
            </div>

            <div>
              <FieldLabel>Adresse du chantier</FieldLabel>
              <ThemedInput
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="12 rue des Lilas"
                autoComplete="street-address"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="col-span-1">
                <FieldLabel>Code postal</FieldLabel>
                <ThemedInput
                  type="text"
                  value={postalCode}
                  onChange={e => setPostalCode(e.target.value)}
                  placeholder="69003"
                  autoComplete="postal-code"
                  maxLength={20}
                />
              </div>
              <div className="col-span-2">
                <FieldLabel>Ville</FieldLabel>
                <ThemedInput
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Lyon"
                  autoComplete="address-level2"
                  maxLength={80}
                />
              </div>
            </div>

            <div>
              <FieldLabel required>Decrivez votre projet</FieldLabel>
              <textarea
                required
                value={project}
                onChange={e => setProject(e.target.value)}
                placeholder="Ex: Renovation complete de ma salle de bain de 6 m2 : depose de l'existant, nouvelle plomberie, carrelage, douche italienne..."
                maxLength={4000}
                rows={4}
                className="w-full px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 transition-shadow"
                style={{
                  backgroundColor: 'var(--site-bg)',
                  border: '1px solid var(--site-card-border)',
                  borderRadius: 'var(--site-radius)',
                  color: 'var(--site-text)',
                }}
              />
            </div>

            <div>
              <FieldLabel>Budget envisage (optionnel)</FieldLabel>
              <ThemedInput
                type="text"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="Ex: 5 000 - 8 000 EUR"
                maxLength={40}
              />
            </div>

            <Turnstile onVerify={(token) => setCaptchaToken(token)} />

            {error && (
              <div
                className="rounded-md px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full text-base font-semibold px-6 py-3 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 inline-flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'var(--site-accent)',
                color: '#ffffff',
                borderRadius: 'var(--site-radius)',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                'Envoyer ma demande'
              )}
            </button>

            <p className="text-xs text-center" style={{ color: 'var(--site-text-muted)' }}>
              En soumettant ce formulaire, vous acceptez d&apos;etre recontacte par {companyName}.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Small themed helpers ──

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-text-muted)' }}>
      {children}
      {required && <span style={{ color: 'var(--site-accent)' }}> *</span>}
    </label>
  );
}

function ThemedInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-shadow"
      style={{
        backgroundColor: 'var(--site-bg)',
        border: '1px solid var(--site-card-border)',
        borderRadius: 'var(--site-radius)',
        color: 'var(--site-text)',
      }}
    />
  );
}
