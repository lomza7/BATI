import type { SiteContentHero } from '@/lib/site-utils';
import { SiteHeroCta } from './site-hero-cta';
import { SiteHeroCarousel } from './site-hero-carousel';

interface SiteHeroProps {
  hero: SiteContentHero;
  companyName: string;
  heroImageUrl?: string;
  heroImages?: string[];
  heroLayout?: 'single' | 'grid' | 'carousel';
  slug: string;
  phone?: string;
}

export function SiteHero({
  hero,
  companyName,
  heroImageUrl,
  heroImages = [],
  heroLayout = 'single',
  slug,
  phone,
}: SiteHeroProps) {
  // On construit la liste finale d'images utilisables :
  // heroImages en priorite, fallback sur heroImageUrl (compat sites existants).
  const cleanImages = heroImages.filter(Boolean);
  const allImages = cleanImages.length > 0 ? cleanImages : heroImageUrl ? [heroImageUrl] : [];
  const hasAnyImage = allImages.length > 0;

  // Si l'utilisateur a choisi grid/carousel mais n'a qu'une seule photo, on
  // retombe sur le mode single pour eviter une grille a moitie vide.
  const effectiveLayout: 'single' | 'grid' | 'carousel' =
    (heroLayout === 'grid' || heroLayout === 'carousel') && allImages.length >= 2
      ? heroLayout
      : 'single';

  // ── Grid layout : texte a gauche, 3 photos en collage a droite ──
  if (effectiveLayout === 'grid') {
    const gridImages = allImages.slice(0, 3);
    return (
      <section
        className="relative py-12 sm:py-20 lg:py-24 px-4 sm:px-6"
        style={{
          background: 'linear-gradient(135deg, var(--site-bg) 0%, var(--site-bg-alt) 100%)',
        }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <h1
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-6"
              style={{
                color: 'var(--site-heading)',
                fontFamily: 'var(--site-font)',
              }}
            >
              {hero.headline}
            </h1>
            <p
              className="text-base sm:text-lg md:text-xl max-w-xl mb-6 sm:mb-8 mx-auto lg:mx-0"
              style={{ color: 'var(--site-text-muted)' }}
            >
              {hero.subheadline}
            </p>
            <div className="flex justify-center lg:justify-start">
              <SiteHeroCta
                slug={slug}
                companyName={companyName}
                ctaText={hero.cta_text}
                phone={phone}
                hasHeroImage={false}
              />
            </div>
            <p
              className="mt-4 text-xs sm:text-sm"
              style={{ color: 'var(--site-text-muted)' }}
            >
              {companyName} — Devis gratuit et sans engagement
            </p>
          </div>

          {/* Collage 3 photos */}
          <div className="grid grid-cols-2 grid-rows-2 gap-2 sm:gap-3 h-[260px] sm:h-[380px] lg:h-[500px]">
            <div
              className="row-span-2 overflow-hidden"
              style={{ borderRadius: 'var(--site-radius)' }}
            >
              <img
                src={gridImages[0]}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className="overflow-hidden"
              style={{ borderRadius: 'var(--site-radius)' }}
            >
              <img
                src={gridImages[1]}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className="overflow-hidden"
              style={{ borderRadius: 'var(--site-radius)' }}
            >
              {gridImages[2] ? (
                <img
                  src={gridImages[2]}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: 'var(--site-accent-light)' }}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── Carousel layout : 3 photos qui defilent en fond plein ecran ──
  if (effectiveLayout === 'carousel') {
    const carouselImages = allImages.slice(0, 3);
    return (
      <section
        className="relative min-h-[85vh] sm:min-h-[70vh] flex items-center justify-center text-center px-4 sm:px-6 overflow-hidden"
        style={{ backgroundColor: 'var(--site-bg-alt)' }}
      >
        <SiteHeroCarousel images={carouselImages} />

        <div className="relative z-10 w-full max-w-3xl mx-auto py-16 sm:py-24">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-6 text-white"
            style={{ fontFamily: 'var(--site-font)' }}
          >
            {hero.headline}
          </h1>
          <p
            className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-6 sm:mb-8"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {hero.subheadline}
          </p>
          <SiteHeroCta
            slug={slug}
            companyName={companyName}
            ctaText={hero.cta_text}
            phone={phone}
            hasHeroImage={true}
          />
          <p
            className="mt-4 text-xs sm:text-sm"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            {companyName} — Devis gratuit et sans engagement
          </p>
        </div>
      </section>
    );
  }

  // ── Single layout (fallback) ──
  const singleImage = allImages[0];
  return (
    <section
      className="relative min-h-[85vh] sm:min-h-[70vh] flex items-center justify-center text-center px-4 sm:px-6"
      style={{ backgroundColor: 'var(--site-bg-alt)' }}
    >
      {singleImage ? (
        <>
          <img
            src={singleImage}
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

      <div className="relative z-10 w-full max-w-3xl mx-auto py-16 sm:py-24">
        <h1
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-6"
          style={{
            color: hasAnyImage ? '#ffffff' : 'var(--site-heading)',
            fontFamily: 'var(--site-font)',
          }}
        >
          {hero.headline}
        </h1>

        <p
          className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-6 sm:mb-8"
          style={{ color: hasAnyImage ? 'rgba(255,255,255,0.8)' : 'var(--site-text-muted)' }}
        >
          {hero.subheadline}
        </p>

        <SiteHeroCta
          slug={slug}
          companyName={companyName}
          ctaText={hero.cta_text}
          phone={phone}
          hasHeroImage={hasAnyImage}
        />

        <p
          className="mt-4 text-xs sm:text-sm"
          style={{ color: hasAnyImage ? 'rgba(255,255,255,0.6)' : 'var(--site-text-muted)' }}
        >
          {companyName} — Devis gratuit et sans engagement
        </p>
      </div>
    </section>
  );
}
