'use client';

import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';

interface SiteMobileNavProps {
  links: { label: string; href: string }[];
}

export function SiteMobileNav({ links }: SiteMobileNavProps) {
  const [open, setOpen] = useState(false);

  // Close on Escape + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (links.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden inline-flex items-center justify-center w-9 h-9 -ml-1 transition-colors"
        style={{
          color: 'var(--site-heading)',
          borderRadius: 'var(--site-radius)',
        }}
        aria-label="Ouvrir le menu"
        aria-expanded={open}
      >
        <Menu className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div
            className="absolute left-0 top-0 bottom-0 w-[80%] max-w-[320px] flex flex-col animate-in slide-in-from-left duration-200 shadow-2xl"
            style={{
              backgroundColor: 'var(--site-bg)',
              borderRight: '1px solid var(--site-border)',
              fontFamily: 'var(--site-font)',
            }}
          >
            <div
              className="flex items-center justify-between px-5 h-16 border-b"
              style={{ borderColor: 'var(--site-border)' }}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: 'var(--site-text-muted)' }}
              >
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center w-9 h-9 transition-colors"
                style={{
                  color: 'var(--site-heading)',
                  borderRadius: 'var(--site-radius)',
                }}
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3.5 text-base font-medium transition-colors"
                  style={{ color: 'var(--site-heading)' }}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
