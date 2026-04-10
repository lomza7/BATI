import type {
  SiteContentFaq,
  SiteProfile,
  SiteProject,
  SiteReview,
  SiteService,
} from '@/lib/site-utils';

interface SiteJsonLdProps {
  profile: SiteProfile;
  reviews: SiteReview[];
  services?: SiteService[];
  projects?: SiteProject[];
  faq?: SiteContentFaq[];
  description?: string;
  siteUrl: string;
}

export function SiteJsonLd({
  profile,
  reviews,
  services = [],
  projects = [],
  faq = [],
  description,
  siteUrl,
}: SiteJsonLdProps) {
  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null;

  // Liste de mots cles pour knowsAbout (activite + categories de projets + prestations)
  const knowsAbout = Array.from(
    new Set(
      [
        profile.company_activity,
        ...projects.map((p) => p.public_category).filter(Boolean),
        ...services.map((s) => s.category).filter(Boolean),
        ...services.slice(0, 10).map((s) => s.name),
      ].filter(Boolean) as string[]
    )
  ).slice(0, 20);

  // Zone desservie : derivee des villes des chantiers publies + ville de l'entreprise
  const areaServed = Array.from(
    new Set(
      [profile.company_city, ...projects.map((p) => p.city)].filter(
        Boolean
      ) as string[]
    )
  ).slice(0, 20);

  const localBusiness: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'GeneralContractor',
    '@id': `${siteUrl}#business`,
    name: profile.company_name,
    url: siteUrl,
    ...(description && { description }),
    ...(profile.company_phone && { telephone: profile.company_phone }),
    ...(profile.logo_url && {
      image: profile.logo_url,
      logo: profile.logo_url,
    }),
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
    ...(knowsAbout.length > 0 && { knowsAbout }),
    ...(areaServed.length > 0 && {
      areaServed: areaServed.map((city) => ({
        '@type': 'City',
        name: city,
      })),
    }),
    priceRange: 'EUR',
    ...(avgRating !== null && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: avgRating.toFixed(1),
        reviewCount: reviews.length,
        bestRating: '5',
        worstRating: '1',
      },
      review: reviews.slice(0, 5).map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author_name },
        reviewRating: {
          '@type': 'Rating',
          ratingValue: r.rating,
          bestRating: '5',
          worstRating: '1',
        },
        ...(r.comment && { reviewBody: r.comment }),
        datePublished: r.created_at,
      })),
    }),
  };

  // WebSite : pour donner a Google le nom/url du site vitrine
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    url: siteUrl,
    name: profile.company_name,
    ...(description && { description }),
    inLanguage: 'fr-FR',
    publisher: { '@id': `${siteUrl}#business` },
    isPartOf: {
      '@type': 'WebApplication',
      name: 'Hellobat',
      url: 'https://hellobat.app',
      description: 'Logiciel tout-en-un pour artisans du bâtiment : devis, factures, chantiers, site web et plus.',
      applicationCategory: 'BusinessApplication',
    },
  };

  // Breadcrumb racine
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: siteUrl,
      },
    ],
  };

  // FAQPage : seulement si FAQ presente
  const faqPage =
    faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: f.answer,
            },
          })),
        }
      : null;

  // ItemList des realisations publiees : aide Google a decouvrir les pages detail
  const itemList =
    projects.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Nos réalisations',
          itemListElement: projects.slice(0, 30).map((p, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: p.public_slug
              ? `${siteUrl}/realisations/${p.public_slug}`
              : siteUrl,
            name: p.name,
          })),
        }
      : null;

  const blocks = [localBusiness, website, breadcrumb, faqPage, itemList].filter(
    Boolean
  );

  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
