import type { SiteProfile, SiteReview } from '@/lib/site-utils';

interface SiteJsonLdProps {
  profile: SiteProfile;
  reviews: SiteReview[];
  siteUrl: string;
}

export function SiteJsonLd({ profile, reviews, siteUrl }: SiteJsonLdProps) {
  const address = [
    profile.company_address,
    profile.company_postal_code,
    profile.company_city,
  ].filter(Boolean);

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: profile.company_name,
    url: siteUrl,
    ...(profile.company_phone && { telephone: profile.company_phone }),
    ...(profile.logo_url && { image: profile.logo_url }),
    ...(profile.company_address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: profile.company_address,
        addressLocality: profile.company_city,
        postalCode: profile.company_postal_code,
        addressCountry: 'FR',
      },
    }),
    ...(profile.google_business_url && {
      sameAs: [profile.google_business_url],
    }),
    ...(avgRating !== null && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: avgRating.toFixed(1),
        reviewCount: reviews.length,
        bestRating: '5',
        worstRating: '1',
      },
    }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
