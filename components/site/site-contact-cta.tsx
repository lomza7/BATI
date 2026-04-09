'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { SiteQuoteModal } from './site-quote-modal';

interface SiteContactCtaProps {
  slug: string;
  companyName: string;
  phone?: string;
}

export function SiteContactCta({ slug, companyName, phone }: SiteContactCtaProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-sm sm:max-w-none mx-auto">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center text-base font-semibold px-6 sm:px-8 py-3.5 transition-all hover:scale-105"
          style={{
            backgroundColor: 'var(--site-accent)',
            color: '#ffffff',
            borderRadius: 'var(--site-radius)',
          }}
        >
          Demander un devis gratuit
        </button>

        {phone && (
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-base font-semibold px-6 py-3.5 transition-all hover:scale-105"
            style={{
              backgroundColor: 'var(--site-accent-light)',
              color: 'var(--site-accent)',
              border: '1px solid var(--site-accent)',
              borderRadius: 'var(--site-radius)',
            }}
          >
            <Phone className="w-4 h-4" />
            {phone}
          </a>
        )}
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
