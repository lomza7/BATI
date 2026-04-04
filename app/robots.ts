import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/site/',
        disallow: ['/api/', '/(app)/'],
      },
    ],
    sitemap: 'https://hellobat.app/site/sitemap.xml',
  };
}
