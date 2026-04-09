'use client';

import { useEffect, useState } from 'react';

interface SiteHeroCarouselProps {
  images: string[];
  /** Duree d'affichage de chaque photo, en ms. Defaut 5000. */
  interval?: number;
}

/**
 * Carrousel plein ecran utilise en fond du hero.
 * Fait defiler automatiquement les images avec un fondu.
 */
export function SiteHeroCarousel({ images, interval = 5000 }: SiteHeroCarouselProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, interval);
    return () => clearInterval(id);
  }, [images.length, interval]);

  if (images.length === 0) return null;

  return (
    <>
      {images.map((src, i) => (
        <img
          key={src + i}
          src={src}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{ background: 'var(--site-hero-overlay)' }}
      />

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Photo ${i + 1}`}
              className="h-2 rounded-full transition-all"
              style={{
                width: i === index ? 24 : 8,
                backgroundColor: i === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
