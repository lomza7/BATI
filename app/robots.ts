import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/blog/', '/site/'],
        disallow: [
          '/api/',
          '/dashboard/',
          '/clients/',
          '/devis/',
          '/factures/',
          '/chantiers/',
          '/parametres/',
          '/admin/',
          '/login',
          '/signup',
          '/c/',
          '/d/',
          '/f/',
        ],
      },
    ],
    sitemap: [
      'https://hellobat.app/sitemap.xml',
      'https://hellobat.app/site/sitemap.xml',
    ],
    host: 'https://hellobat.app',
  };
}
