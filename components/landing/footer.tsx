import Link from 'next/link';

const footerLinks = {
  Produit: [
    { label: 'Fonctionnalités', href: '/#features' },
    { label: 'Tarifs', href: '/#pricing' },
    { label: 'Démo', href: '/#demo' },
    { label: 'Témoignages', href: '/#testimonials' },
  ],
  Ressources: [
    { label: 'Blog', href: '/blog' },
  ],
  Entreprise: [
    { label: 'À propos', href: '/a-propos' },
    { label: 'Contact', href: '/contact' },
    { label: 'Carrières', href: '/carrieres' },
    { label: 'Presse', href: '/presse' },
  ],
  Légal: [
    { label: 'CGU', href: '/cgu' },
    { label: 'Confidentialité', href: '/confidentialite' },
    { label: 'Cookies', href: '/cookies' },
    { label: 'Mentions légales', href: '/mentions-legales' },
  ],
};

export function Footer() {
  return (
    <footer className="py-10 sm:py-16 bg-[var(--landing-off)] border-t border-[var(--landing-border)]">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon.svg" alt="Hellobat" width={32} height={32} />
              <span className="font-serif font-medium text-[var(--landing-text)] text-lg">Hellobat</span>
            </Link>
            <p className="text-xs text-[var(--landing-muted)] leading-relaxed">
              La plateforme tout-en-un pour les artisans du bâtiment.
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
            &copy; 2026 Hellobat. Tous droits réservés.
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--landing-muted)]">Fait avec soin pour les artisans français</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
