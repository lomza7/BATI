'use client';

import { useEffect, useState } from 'react';
import { GoogleTagManager } from '@next/third-parties/google';

const STORAGE_KEY = 'hellobat-cookie-consent';
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

type ConsentState = 'granted' | 'denied' | null;

/**
 * RGPD-compliant analytics wrapper.
 *
 * - Loads Google Tag Manager only after the visitor has explicitly granted
 *   consent, as required by the CNIL in France.
 * - Displays a discreet cookie banner in the bottom-right corner on first
 *   visit, with equally-sized "Refuser" and "Accepter" buttons (CNIL asks
 *   that refusing is as easy as accepting).
 * - Stores the choice in localStorage so the banner never reappears.
 *
 * To change your mind later, clear `hellobat-cookie-consent` in localStorage
 * (or we can add a footer link "Gérer les cookies" in a later iteration).
 */
export function AnalyticsConsent() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'granted' || stored === 'denied') {
      setConsent(stored);
    }
    setMounted(true);
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, 'granted');
    setConsent('granted');
  }

  function handleRefuse() {
    localStorage.setItem(STORAGE_KEY, 'denied');
    setConsent('denied');
  }

  // Before hydration or without a GTM ID in env, render nothing.
  if (!mounted || !GTM_ID) return null;

  return (
    <>
      {consent === 'granted' && <GoogleTagManager gtmId={GTM_ID} />}

      {consent === null && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Consentement aux cookies"
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[100] bg-white border border-[var(--landing-border)] rounded-2xl shadow-xl shadow-black/5 p-4 animate-fade-up"
        >
          <p className="text-sm leading-relaxed text-[var(--landing-text)] mb-3">
            On utilise des cookies pour mesurer notre audience et améliorer l&apos;expérience.
            Tu peux refuser, ça ne change rien pour toi.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRefuse}
              className="flex-1 px-4 py-2 text-sm font-medium text-[var(--landing-muted)] hover:text-[var(--landing-text)] border border-[var(--landing-border)] hover:border-[var(--landing-muted)] rounded-full transition-colors"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[var(--landing-accent)] hover:bg-[#b94800] rounded-full transition-colors"
            >
              Accepter
            </button>
          </div>
        </div>
      )}
    </>
  );
}
