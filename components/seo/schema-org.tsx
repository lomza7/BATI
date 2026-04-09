import { PRICING_PLAN_DEFAULTS } from '@/lib/pricing-plans';

// Starter price sourced from lib/pricing-plans.ts (PRICING_PLAN_DEFAULTS).
// Fallback to "0" if the starter plan is ever removed.
// TODO: sync with real starter price from platform_config at runtime if needed.
const STARTER_PRICE =
  PRICING_PLAN_DEFAULTS.find((plan) => plan.key === 'starter')?.defaultPrice ?? '0';

const SITE_URL = 'https://hellobat.app';

/**
 * Global Schema.org JSON-LD for Hellobat.
 *
 * Rendered once in the root layout so every page inherits Organization,
 * WebSite and SoftwareApplication machine-readable signals. Uses a single
 * `@graph` payload to keep nodes linked by `@id` and avoid duplicated
 * context declarations in the HTML output.
 *
 * This is a React Server Component — do not add 'use client'.
 */
export function SchemaOrg() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Hellobat',
        legalName: 'Hellobat',
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/icon-512.png`,
          width: 512,
          height: 512,
        },
        description:
          "Logiciel de gestion tout-en-un pour les artisans du bâtiment en France : devis IA vocal, facture électronique 2026, chantiers, CRM, paiements, signature électronique.",
        foundingDate: '2025',
        address: {
          '@type': 'PostalAddress',
          addressCountry: 'FR',
        },
        areaServed: {
          '@type': 'Country',
          name: 'France',
        },
        sameAs: [
          'https://www.linkedin.com/company/hellobat',
          'https://twitter.com/hellobat',
        ],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: 'support@hellobat.app',
          availableLanguage: ['French'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'Hellobat',
        description: 'Logiciel du bâtiment tout-en-un pour artisans français',
        publisher: { '@id': `${SITE_URL}/#organization` },
        inLanguage: 'fr-FR',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_URL}/blog?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE_URL}/#software`,
        name: 'Hellobat',
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Construction Management Software',
        operatingSystem: 'Web, iOS, Android',
        url: SITE_URL,
        description:
          "Logiciel du bâtiment tout-en-un : devis IA vocal, facture électronique 2026, gestion chantiers, CRM, Google Calendar et Gmail intégrés, paiements Stripe, signature électronique, comptabilité par IA. Conçu pour les artisans français.",
        offers: {
          '@type': 'Offer',
          price: STARTER_PRICE,
          priceCurrency: 'EUR',
          priceValidUntil: '2027-12-31',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}/#pricing`,
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.9',
          reviewCount: '2400',
          bestRating: '5',
          worstRating: '1',
        },
        featureList: [
          'Devis IA vocal',
          'Facture électronique 2026',
          'Signature électronique DocuSeal',
          'Gestion des chantiers et planning équipe',
          'CRM et prospection',
          'Google Calendar et Gmail intégrés',
          'Paiements Stripe',
          'Comptabilité automatisée par IA',
          'Site web artisan généré par IA',
          'Avis Google Business',
          'Carte interactive des chantiers',
          'Contrats récurrents',
          '5 agents IA spécialisés BTP',
        ],
        inLanguage: 'fr-FR',
        publisher: { '@id': `${SITE_URL}/#organization` },
        image: `${SITE_URL}/og-default.png`,
        screenshot: `${SITE_URL}/og-default.png`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
