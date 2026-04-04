import type { SiteProfile } from '@/lib/site-utils';

interface SiteHeaderProps {
  profile: SiteProfile;
  showServices: boolean;
  showProjects: boolean;
  showReviews: boolean;
  showContact: boolean;
  hasServices: boolean;
  hasProjects: boolean;
  hasReviews: boolean;
}

export function SiteHeader({
  profile,
  showServices,
  showProjects,
  showReviews,
  showContact,
  hasServices,
  hasProjects,
  hasReviews,
}: SiteHeaderProps) {
  const links: { label: string; href: string }[] = [];

  links.push({ label: 'A propos', href: '#a-propos' });
  if (showServices && hasServices) links.push({ label: 'Services', href: '#services' });
  if (showProjects && hasProjects) links.push({ label: 'Realisations', href: '#realisations' });
  if (showReviews && hasReviews) links.push({ label: 'Avis', href: '#avis' });
  if (showContact) links.push({ label: 'Contact', href: '#contact' });

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md border-b"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--site-bg) 85%, transparent)',
        borderColor: 'var(--site-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo + company name */}
        <a
          href="#"
          className="flex items-center gap-3 font-bold text-lg truncate"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          {profile.logo_url && (
            <img
              src={profile.logo_url}
              alt={profile.company_name}
              className="h-8 w-8 rounded-md object-cover flex-shrink-0"
            />
          )}
          <span className="truncate">{profile.company_name}</span>
        </a>

        {/* Navigation — hidden on mobile, visible on md+ */}
        <nav className="hidden md:flex items-center gap-6">
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
          <a
            href="#contact"
            className="text-sm font-semibold px-4 py-2 rounded-md transition-colors"
            style={{
              backgroundColor: 'var(--site-accent)',
              color: '#ffffff',
              borderRadius: 'var(--site-radius)',
            }}
          >
            Devis gratuit
          </a>
        </nav>
      </div>
    </header>
  );
}
