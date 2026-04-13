'use client';

import { useEffect, useState } from 'react';
import { GoogleTagManager } from '@next/third-parties/google';

const COOKIE_NAME = 'hellobat-cookie-consent';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 an en secondes
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

type ConsentState = 'granted' | 'denied' | null;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function AnalyticsConsent() {
  const [consent, setConsent] = useState<ConsentState>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getCookie(COOKIE_NAME);
    if (stored === 'granted' || stored === 'denied') {
      setConsent(stored);
    }
    setMounted(true);
  }, []);

  function handleAccept() {
    setCookie(COOKIE_NAME, 'granted');
    setConsent('granted');
  }

  function handleRefuse() {
    setCookie(COOKIE_NAME, 'denied');
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
