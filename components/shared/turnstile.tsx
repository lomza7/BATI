'use client';

import { useEffect, useId, useRef, useImperativeHandle, forwardRef } from 'react';

/*
 * Wrapper React minimaliste autour du widget Cloudflare Turnstile.
 *
 * Comportement :
 *  - Si NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas defini, le composant ne rend rien
 *    et appelle immediatement onVerify('') pour debloquer le formulaire (mode dev
 *    / pas encore configure). Le serveur fera de meme cote verifyTurnstile.
 *  - Sinon, charge le script Cloudflare une fois et rend le widget. A chaque
 *    challenge resolu, appelle onVerify(token).
 *
 * Pas de dependance npm — on utilise directement l'API JS de Cloudflare.
 */

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('turnstile script error')));
      return;
    }
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile script error'));
    document.head.appendChild(s);
  });

  return scriptPromise;
}

export interface TurnstileHandle {
  /** Reinitialise le widget pour obtenir un nouveau token (a appeler apres chaque tentative). */
  reset: () => void;
}

interface TurnstileProps {
  /** Callback appele avec le token Cloudflare lorsque le challenge est resolu. */
  onVerify: (token: string) => void;
  /** Callback optionnel quand le token expire ou que la verification echoue. */
  onError?: () => void;
  /** Theme visuel — defaut auto. */
  theme?: 'light' | 'dark' | 'auto';
}

export const Turnstile = forwardRef<TurnstileHandle, TurnstileProps>(
  function Turnstile({ onVerify, onError, theme = 'auto' }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const id = useId();
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    useImperativeHandle(ref, () => ({
      reset() {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      // Pas de cle → mode degrade : on debloque immediatement le formulaire.
      if (!siteKey) {
        onVerify('');
        return;
      }

      let cancelled = false;

      loadScript()
        .then(() => {
          if (cancelled || !containerRef.current || !window.turnstile) return;
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            theme,
            callback: (token: string) => {
              if (!cancelled) onVerify(token);
            },
            'error-callback': () => {
              if (!cancelled && onError) onError();
            },
            'expired-callback': () => {
              if (!cancelled) onVerify('');
            },
          });
        })
        .catch(() => {
          if (!cancelled && onError) onError();
        });

      return () => {
        cancelled = true;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
          widgetIdRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [siteKey, theme]);

    if (!siteKey) return null;
    return <div ref={containerRef} id={`turnstile-${id}`} />;
  },
);
