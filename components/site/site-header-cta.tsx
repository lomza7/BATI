'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { SiteQuoteModal } from './site-quote-modal';

interface SiteHeaderCtaProps {
  slug: string;
  companyName: string;
  phone?: string;
}

export function SiteHeaderCta({ slug, companyName, phone }: SiteHeaderCtaProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        {phone && (
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className="hidden lg:inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 transition-colors"
            style={{
              color: 'var(--site-accent)',
              backgroundColor: 'var(--site-accent-light)',
              borderRadius: 'var(--site-radius)',
            }}
          >
            <Phone className="w-4 h-4" />
            <span>{phone}</span>
          </a>
        )}
        {phone && (
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className="inline-flex lg:hidden items-center justify-center w-9 h-9 transition-colors"
            style={{
              color: 'var(--site-accent)',
              backgroundColor: 'var(--site-accent-light)',
              borderRadius: 'var(--site-radius)',
            }}
            aria-label={`Appeler ${phone}`}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm font-semibold px-4 py-2 transition-colors hover:opacity-90"
          style={{
            backgroundColor: 'var(--site-accent)',
            color: '#ffffff',
            borderRadius: 'var(--site-radius)',
          }}
        >
          Devis gratuit
        </button>
      </div>

      <SiteQuoteModal
        open={open}
        onClose={() => setOpen(false)}
        slug={slug}
        companyName={companyName}
      />
    </>
  );
}
