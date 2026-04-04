import type { SiteContentHero } from '@/lib/site-utils';

interface SiteHeroProps {
  hero: SiteContentHero;
  companyName: string;
  heroImageUrl?: string;
}

export function SiteHero({ hero, companyName, heroImageUrl }: SiteHeroProps) {
  return (
    <section
      className="relative min-h-[70vh] flex items-center justify-center text-center px-4 sm:px-6"
      style={{ backgroundColor: 'var(--site-bg-alt)' }}
    >
      {/* Background image or gradient */}
      {heroImageUrl ? (
        <>
          <img
            src={heroImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'var(--site-hero-overlay)' }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, var(--site-bg) 0%, var(--site-bg-alt) 100%)`,
          }}
        />
      )}

      <div className="relative z-10 max-w-3xl mx-auto py-20 sm:py-28">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
          style={{
            color: heroImageUrl ? '#ffffff' : 'var(--site-heading)',
            fontFamily: 'var(--site-font)',
          }}
        >
          {hero.headline}
        </h1>

        <p
          className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8"
          style={{ color: heroImageUrl ? 'rgba(255,255,255,0.8)' : 'var(--site-text-muted)' }}
        >
          {hero.subheadline}
        </p>

        <a
          href="#contact"
          className="inline-block text-base sm:text-lg font-semibold px-8 py-3.5 rounded-md transition-all hover:scale-105"
          style={{
            backgroundColor: 'var(--site-accent)',
            color: '#ffffff',
            borderRadius: 'var(--site-radius)',
          }}
        >
          {hero.cta_text}
        </a>

        <p
          className="mt-4 text-sm"
          style={{ color: heroImageUrl ? 'rgba(255,255,255,0.6)' : 'var(--site-text-muted)' }}
        >
          {companyName} — Devis gratuit et sans engagement
        </p>
      </div>
    </section>
  );
}
