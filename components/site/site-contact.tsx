import { Phone, MapPin, Mail, ExternalLink } from 'lucide-react';
import type { SiteProfile, SiteContentContact } from '@/lib/site-utils';

interface SiteContactProps {
  profile: SiteProfile;
  contact: SiteContentContact;
}

export function SiteContact({ profile, contact }: SiteContactProps) {
  const address = [
    profile.company_address,
    profile.company_postal_code,
    profile.company_city,
  ]
    .filter(Boolean)
    .join(', ');

  const mapsQuery = encodeURIComponent(
    address || `${profile.company_name} ${profile.company_city || ''}`
  );

  return (
    <section id="contact" className="py-16 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-4"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          {contact.title}
        </h2>
        <p
          className="text-center max-w-xl mx-auto mb-12"
          style={{ color: 'var(--site-text-muted)' }}
        >
          {contact.description}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Phone */}
          {profile.company_phone && (
            <a
              href={`tel:${profile.company_phone}`}
              className="flex items-center gap-4 p-5 border transition-shadow hover:shadow-md"
              style={{
                backgroundColor: 'var(--site-card-bg)',
                borderColor: 'var(--site-card-border)',
                borderRadius: 'var(--site-radius)',
              }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: 'var(--site-accent-light)' }}
              >
                <Phone className="w-5 h-5" style={{ color: 'var(--site-accent)' }} />
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--site-text-muted)' }}>
                  Telephone
                </p>
                <p className="font-semibold" style={{ color: 'var(--site-heading)' }}>
                  {profile.company_phone}
                </p>
              </div>
            </a>
          )}

          {/* Address */}
          {address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-5 border transition-shadow hover:shadow-md"
              style={{
                backgroundColor: 'var(--site-card-bg)',
                borderColor: 'var(--site-card-border)',
                borderRadius: 'var(--site-radius)',
              }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: 'var(--site-accent-light)' }}
              >
                <MapPin className="w-5 h-5" style={{ color: 'var(--site-accent)' }} />
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--site-text-muted)' }}>
                  Adresse
                </p>
                <p className="font-semibold text-sm" style={{ color: 'var(--site-heading)' }}>
                  {address}
                </p>
              </div>
            </a>
          )}

          {/* Google Business */}
          {profile.google_business_url && (
            <a
              href={profile.google_business_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-5 border transition-shadow hover:shadow-md"
              style={{
                backgroundColor: 'var(--site-card-bg)',
                borderColor: 'var(--site-card-border)',
                borderRadius: 'var(--site-radius)',
              }}
            >
              <div
                className="w-12 h-12 flex items-center justify-center rounded-lg flex-shrink-0"
                style={{ backgroundColor: 'var(--site-accent-light)' }}
              >
                <ExternalLink className="w-5 h-5" style={{ color: 'var(--site-accent)' }} />
              </div>
              <div>
                <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--site-text-muted)' }}>
                  Google Business
                </p>
                <p className="font-semibold text-sm" style={{ color: 'var(--site-heading)' }}>
                  Voir notre fiche
                </p>
              </div>
            </a>
          )}
        </div>

        {/* CTA button */}
        <div className="mt-10 text-center">
          {profile.company_phone && (
            <a
              href={`tel:${profile.company_phone}`}
              className="inline-block text-base font-semibold px-8 py-3.5 transition-all hover:scale-105"
              style={{
                backgroundColor: 'var(--site-accent)',
                color: '#ffffff',
                borderRadius: 'var(--site-radius)',
              }}
            >
              Appelez-nous
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
