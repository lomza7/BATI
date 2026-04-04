import type { SiteProfile, SiteContentFooter } from '@/lib/site-utils';

interface SiteFooterProps {
  profile: SiteProfile;
  footer: SiteContentFooter;
  legalText?: string;
}

export function SiteFooter({ profile, footer, legalText }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className="py-10 px-4 sm:px-6 border-t"
      style={{
        backgroundColor: 'var(--site-bg)',
        borderColor: 'var(--site-border)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="font-bold text-lg" style={{ color: 'var(--site-heading)' }}>
              {profile.company_name}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--site-text-muted)' }}>
              {footer.tagline}
            </p>
          </div>

          <div className="text-center sm:text-right text-xs space-y-1" style={{ color: 'var(--site-text-muted)' }}>
            {profile.siret && <p>SIRET : {profile.siret}</p>}
            {profile.tva_number && <p>TVA : {profile.tva_number}</p>}
            <p>&copy; {year} {profile.company_name}. Tous droits reserves.</p>
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
                Mentions legales et conditions generales
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
            Site propulse par{' '}
            <a
              href="https://hellobat.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:underline"
              style={{ color: 'var(--site-accent)' }}
            >
              Hellobat
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
