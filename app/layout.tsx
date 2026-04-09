import './globals.css';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { AnalyticsConsent } from '@/components/analytics-consent';
import { Providers } from '@/components/providers';
import { SchemaOrg } from '@/components/seo/schema-org';

export const metadata: Metadata = {
  metadataBase: new URL('https://hellobat.app'),
  title: {
    default: 'Hellobat — Jusqu\'à 10h gagnées par semaine grâce à l\'IA | Logiciel bâtiment',
    template: '%s | Hellobat',
  },
  description:
    'Jusqu\'à 10h gagnées chaque semaine. Site web offert, devis IA vocal, compta auto (facture 2026), paiement et signature en ligne, Gmail, CRM, planning et chantiers — tout le bâtiment dans une seule app. Essai 30 jours, sans carte.',
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
    title: 'Hellobat — Jusqu\'à 10h gagnées par semaine grâce à l\'IA',
    description:
      'Jusqu\'à 10h gagnées chaque semaine. Site web offert, devis IA vocal, compta auto (facture 2026), paiement et signature en ligne, Gmail, CRM, planning et chantiers — tout le bâtiment dans une seule app. Essai 30 jours, sans carte.',
    locale: 'fr_FR',
    // OG image generated dynamically by app/opengraph-image.tsx (Next.js file-based convention)
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hellobat — Jusqu\'à 10h gagnées par semaine grâce à l\'IA',
    description:
      'Jusqu\'à 10h gagnées chaque semaine. Site web offert, devis IA vocal, compta auto (facture 2026), paiement et signature en ligne, Gmail, CRM, planning et chantiers — tout le bâtiment dans une seule app. Essai 30 jours, sans carte.',
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
        <AnalyticsConsent />
      </body>
    </html>
  );
}
