import { Star } from 'lucide-react';
import type { SiteReview } from '@/lib/site-utils';

interface SiteReviewsProps {
  reviews: SiteReview[];
  googleReviewLink?: string | null;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="w-4 h-4"
          style={{
            color: i < rating ? '#facc15' : 'var(--site-border)',
            fill: i < rating ? '#facc15' : 'none',
          }}
        />
      ))}
    </div>
  );
}

export function SiteReviews({ reviews, googleReviewLink }: SiteReviewsProps) {
  if (reviews.length === 0) return null;

  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section id="avis" className="py-12 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--site-bg)' }}>
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-2"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          Avis clients
        </h2>

        <div className="flex items-center justify-center gap-2 mb-8 sm:mb-12">
          <Stars rating={Math.round(avgRating)} />
          <span className="text-sm font-medium" style={{ color: 'var(--site-text-muted)' }}>
            {avgRating.toFixed(1)}/5 — {reviews.length} avis
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {reviews.slice(0, 6).map((review) => (
            <div
              key={review.id}
              className="p-5 sm:p-6 border"
              style={{
                backgroundColor: 'var(--site-card-bg)',
                borderColor: 'var(--site-card-border)',
                borderRadius: 'var(--site-radius)',
              }}
            >
              <Stars rating={review.rating} />
              {review.comment && (
                <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--site-text)' }}>
                  &ldquo;{review.comment}&rdquo;
                </p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm font-semibold" style={{ color: 'var(--site-heading)' }}>
                  {review.author_name}
                </p>
                <p className="text-xs" style={{ color: 'var(--site-text-muted)' }}>
                  {new Date(review.created_at).toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'short',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        {googleReviewLink && (
          <div className="mt-8 sm:mt-10 text-center">
            <a
              href={googleReviewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold px-6 py-3 border transition-colors hover:opacity-80"
              style={{
                color: 'var(--site-accent)',
                borderColor: 'var(--site-accent)',
                borderRadius: 'var(--site-radius)',
              }}
            >
              Laisser un avis sur Google
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
