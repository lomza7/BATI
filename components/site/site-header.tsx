import type { SiteProfile } from '@/lib/site-utils';
import { SiteHeaderCta } from './site-header-cta';
import { SiteMobileNav } from './site-mobile-nav';

interface SiteHeaderProps {
  profile: SiteProfile;
  slug: string;
  phone?: string;
  showServices: boolean;
  showProjects: boolean;
  showReviews: boolean;
  showContact: boolean;
  hasServices: boolean;
  hasProjects: boolean;
  hasReviews: boolean;
  /**
   * Prefix absolu pour les ancres du menu, ex: "/site/mon-artisan".
   * Utilise quand le header est monte sur une page interne (detail chantier)
   * pour que les liens ramenent bien a la home du site et scrollent a la section.
   */
  basePath?: string;
}

export function SiteHeader({
  profile,
  slug,
  phone,
  showServices,
  showProjects,
  showReviews,
  showContact,
  hasServices,
  hasProjects,
  hasReviews,
  basePath = '',
}: SiteHeaderProps) {
  const prefix = (anchor: string) => `${basePath}${anchor}`;
  const homeHref = basePath || '#';

  const links: { label: string; href: string }[] = [];

  links.push({ label: 'A propos', href: prefix('#a-propos') });
  if (showServices && hasServices) links.push({ label: 'Services', href: prefix('#services') });
  if (showProjects && hasProjects) links.push({ label: 'Realisations', href: prefix('#realisations') });
  if (showReviews && hasReviews) links.push({ label: 'Avis', href: prefix('#avis') });
  if (showContact) links.push({ label: 'Contact', href: prefix('#contact') });

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        backgroundColor: 'var(--site-bg)',
        borderColor: 'var(--site-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-1 min-w-0 flex-1 md:flex-initial">
          {/* Mobile hamburger — only on mobile */}
          <SiteMobileNav links={links} />

          {/* Logo + company name */}
          <a
            href={homeHref}
            className="flex items-center gap-2 sm:gap-3 font-bold text-sm sm:text-lg truncate min-w-0"
            style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
          >
            {profile.logo_url && (
              <img
                src={profile.logo_url}
                alt={profile.company_name}
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-md object-cover flex-shrink-0"
              />
            )}
            <span className="truncate">{profile.company_name}</span>
          </a>
        </div>

        {/* Navigation links — hidden on mobile, visible on md+ */}
        <nav className="hidden md:flex items-center gap-5 flex-1 justify-center">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: 'var(--site-text-muted)' }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA block — phone + devis modal, visible on every breakpoint */}
        <SiteHeaderCta slug={slug} companyName={profile.company_name} phone={phone} />
      </div>
    </header>
  );
}
