import type { SiteProfile, SiteContentFooter } from '@/lib/site-utils';

interface SiteFooterProps {
  profile: SiteProfile;
  footer: SiteContentFooter;
  legalText?: string;
  activity?: string;
  city?: string;
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

export function SiteFooter({ profile, footer, legalText, activity, city }: SiteFooterProps) {
  const year = new Date().getFullYear();
  const anchor = getAnchor(activity, city);

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
