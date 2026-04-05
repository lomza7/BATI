import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Hellobat — Gestion pour artisans BTP',
    template: '%s | Hellobat',
  },
  description:
    'La plateforme de gestion tout-en-un pour les artisans et entreprises du bâtiment en France.',
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://hellobat.app'),
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
