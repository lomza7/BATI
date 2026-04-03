import Link from 'next/link';
import { Hexagon } from 'lucide-react';

const footerLinks = {
  Produit: [
    { label: 'Fonctionnalites', href: '#features' },
    { label: 'Tarifs', href: '#pricing' },
    { label: 'Demo', href: '#demo' },
    { label: 'Temoignages', href: '#testimonials' },
  ],
  Ressources: [
    { label: 'Centre d\'aide', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Guides', href: '#' },
    { label: 'API', href: '#' },
  ],
  Entreprise: [
    { label: 'A propos', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Carrieres', href: '#' },
    { label: 'Presse', href: '#' },
  ],
  Legal: [
    { label: 'CGU', href: '#' },
    { label: 'Confidentialite', href: '#' },
    { label: 'Cookies', href: '#' },
    { label: 'Mentions legales', href: '#' },
  ],
};

export function Footer() {
  return (
    <footer className="py-10 sm:py-16 bg-[var(--landing-off)] border-t border-[var(--landing-border)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-[var(--landing-accent)] rounded-lg flex items-center justify-center">
                <Hexagon className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold text-[var(--landing-text)] text-lg">Hellobat</span>
            </Link>
            <p className="text-xs text-[var(--landing-muted)] leading-relaxed">
              La plateforme tout-en-un pour les artisans du batiment.
            </p>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-[var(--landing-text)] uppercase tracking-wider mb-4">
                {category}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--landing-muted)] hover:text-[var(--landing-text)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--landing-border)] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-[var(--landing-muted)]">
            &copy; 2026 Hellobat. Tous droits reserves.
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--landing-muted)]">Fait avec soin pour les artisans francais</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
