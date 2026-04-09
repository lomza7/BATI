import './globals.css';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from '@/components/providers';
import { SchemaOrg } from '@/components/seo/schema-org';

export const metadata: Metadata = {
  metadataBase: new URL('https://hellobat.app'),
  title: {
    default: 'Hellobat — Logiciel du bâtiment tout-en-un pour artisans',
    template: '%s | Hellobat',
  },
  description:
    'Hellobat, le logiciel du bâtiment tout-en-un pour artisans : devis IA vocal, facture électronique 2026, gestion chantiers, planning, CRM, paiements. Essai gratuit.',
  keywords: [
    'logiciel bâtiment',
    'logiciel BTP',
    'logiciel artisan',
    'logiciel devis BTP',
    'facture électronique 2026',
    'gestion chantier',
    'logiciel devis artisan',
    'logiciel artisan gratuit',
    'CRM BTP',
    'ERP BTP',
    'Hellobat',
  ],
  authors: [{ name: 'Hellobat' }],
  creator: 'Hellobat',
  publisher: 'Hellobat',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    url: 'https://hellobat.app',
    siteName: 'Hellobat',
    title: 'Hellobat — Logiciel du bâtiment tout-en-un pour artisans',
    description:
      'Hellobat, le logiciel du bâtiment tout-en-un pour artisans : devis IA vocal, facture électronique 2026, gestion chantiers, planning, CRM, paiements. Essai gratuit.',
    locale: 'fr_FR',
    // OG image generated dynamically by app/opengraph-image.tsx (Next.js file-based convention)
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hellobat — Logiciel du bâtiment tout-en-un pour artisans',
    description:
      'Hellobat, le logiciel du bâtiment tout-en-un pour artisans : devis IA vocal, facture électronique 2026, gestion chantiers, planning, CRM, paiements. Essai gratuit.',
    creator: '@hellobat',
    // Twitter image generated dynamically by app/twitter-image.tsx (Next.js file-based convention)
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  // Icons handled by file-based conventions: app/icon.svg + app/apple-icon.png
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  // Google Search Console verification is handled at the domain level via
  // Google Workspace (DNS ownership), so no meta tag is required here.
  category: 'technology',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr-FR" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <SchemaOrg />
        <Analytics />
      </body>
    </html>
  );
}
