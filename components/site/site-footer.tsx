import type { SiteProfile, SiteContentFooter, SiteSocialLinks } from '@/lib/site-utils';

interface SiteFooterProps {
  profile: SiteProfile;
  footer: SiteContentFooter;
  legalText?: string;
  activity?: string;
  city?: string;
  socialLinks?: SiteSocialLinks;
}

/** Variantes d'ancres pour un profil de liens naturel aux yeux de Google. */
function getAnchor(activity?: string, city?: string): { text: string; title: string } {
  if (activity && city) {
    return {
      text: 'Hellobat — logiciel pour artisans du bâtiment',
      title: `Créer un site web ${activity.toLowerCase()} à ${city} avec Hellobat`,
    };
  }
  if (activity) {
    return {
      text: 'Hellobat — logiciel pour artisans du bâtiment',
      title: `Créer un site web pour artisan ${activity.toLowerCase()} avec Hellobat`,
    };
  }
  return {
    text: 'Hellobat',
    title: 'Hellobat — logiciel tout-en-un pour artisans du bâtiment',
  };
}

const SOCIAL_ICONS: Record<string, { label: string; icon: JSX.Element }> = {
  instagram: {
    label: 'Instagram',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  tiktok: {
    label: 'TikTok',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  linkedin: {
    label: 'LinkedIn',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
};

export function SiteFooter({ profile, footer, legalText, activity, city, socialLinks }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const anchor = getAnchor(activity, city);

  const activeSocials = socialLinks
    ? Object.entries(socialLinks).filter(([, url]) => url && url.trim())
    : [];

  return (
    <footer
      className="py-8 sm:py-10 px-4 sm:px-6 border-t"
      style={{
        backgroundColor: 'var(--site-bg)',
        borderColor: 'var(--site-border)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4">
          <div className="text-center sm:text-left">
            <p className="font-bold text-base sm:text-lg" style={{ color: 'var(--site-heading)' }}>
              {profile.company_name}
            </p>
            <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--site-text-muted)' }}>
              {footer.tagline}
            </p>
          </div>

          <div className="text-center sm:text-right text-xs space-y-1" style={{ color: 'var(--site-text-muted)' }}>
            {profile.siret && <p>SIRET : {profile.siret}</p>}
            {profile.tva_number && <p>TVA : {profile.tva_number}</p>}
            <p>&copy; {year} {profile.company_name}. Tous droits réservés.</p>
          </div>
        </div>

        {/* Social media links */}
        {activeSocials.length > 0 && (
          <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t" style={{ borderColor: 'var(--site-border)' }}>
            {activeSocials.map(([key, url]) => {
              const social = SOCIAL_ICONS[key];
              if (!social) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="transition-opacity hover:opacity-70"
                  style={{ color: 'var(--site-text-muted)' }}
                >
                  {social.icon}
                </a>
              );
            })}
          </div>
        )}

        {/* Legal text / CGV */}
        {legalText && (
          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--site-border)' }}>
            <details>
              <summary
                className="text-xs font-medium cursor-pointer hover:underline"
                style={{ color: 'var(--site-text-muted)' }}
              >
                Mentions légales et conditions générales
              </summary>
              <div
                className="mt-3 text-xs leading-relaxed whitespace-pre-line"
                style={{ color: 'var(--site-text-muted)' }}
              >
                {legalText}
              </div>
            </details>
          </div>
        )}

        <div className="mt-6 pt-4 border-t text-center" style={{ borderColor: 'var(--site-border)' }}>
          <p className="text-xs" style={{ color: 'var(--site-text-muted)' }}>
            Site créé avec{' '}
            <a
              href="https://hellobat.app"
              target="_blank"
              rel="noopener"
              title={anchor.title}
              className="font-medium hover:underline"
              style={{ color: 'var(--site-accent)' }}
            >
              {anchor.text}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
