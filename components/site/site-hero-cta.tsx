'use client';

import { useState } from 'react';
import { Phone } from 'lucide-react';
import { SiteQuoteModal } from './site-quote-modal';

interface SiteHeroCtaProps {
  slug: string;
  companyName: string;
  ctaText: string;
  phone?: string;
  hasHeroImage?: boolean;
}

export function SiteHeroCta({ slug, companyName, ctaText, phone, hasHeroImage }: SiteHeroCtaProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-4 w-full max-w-xs sm:max-w-none mx-auto">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center text-sm sm:text-base font-semibold px-5 sm:px-8 py-3 sm:py-3.5 transition-all hover:scale-105"
          style={{
            backgroundColor: 'var(--site-accent)',
            color: '#ffffff',
            borderRadius: 'var(--site-radius)',
          }}
        >
          {ctaText}
        </button>

        {phone && (
          <a
            href={`tel:${phone.replace(/\s+/g, '')}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm sm:text-base font-semibold px-5 sm:px-6 py-3 sm:py-3.5 transition-all hover:scale-105"
            style={{
              backgroundColor: hasHeroImage ? 'rgba(255,255,255,0.15)' : 'var(--site-accent-light)',
              color: hasHeroImage ? '#ffffff' : 'var(--site-accent)',
              border: hasHeroImage
                ? '1px solid rgba(255,255,255,0.3)'
                : '1px solid var(--site-accent)',
              borderRadius: 'var(--site-radius)',
              backdropFilter: hasHeroImage ? 'blur(8px)' : undefined,
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
        ctaText={ctaText}
      />
    </>
  );
}
