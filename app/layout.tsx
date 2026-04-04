import './globals.css';
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Hellobat - Gestion BTP intelligente',
  description: 'La plateforme tout-en-un pour les artisans du batiment',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
