import { Phone, MapPin, ExternalLink } from 'lucide-react';
import type { SiteProfile, SiteContentContact } from '@/lib/site-utils';
import { SiteContactCta } from './site-contact-cta';

interface SiteContactProps {
  profile: SiteProfile;
  contact: SiteContentContact;
  slug: string;
  phone?: string;
}

export function SiteContact({ profile, contact, slug, phone }: SiteContactProps) {
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

  const displayPhone = phone || profile.company_phone || undefined;

  return (
    <section id="contact" className="py-12 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
      <div className="max-w-4xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-3 sm:mb-4"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          {contact.title}
        </h2>
        <p
          className="text-center text-sm sm:text-base max-w-xl mx-auto mb-8 sm:mb-12"
          style={{ color: 'var(--site-text-muted)' }}
        >
          {contact.description}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
          {/* Phone */}
          {displayPhone && (
            <a
              href={`tel:${displayPhone.replace(/\s+/g, '')}`}
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 border transition-shadow hover:shadow-md"
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
                  {displayPhone}
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
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 border transition-shadow hover:shadow-md"
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
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 border transition-shadow hover:shadow-md"
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

        {/* CTA block — demander un devis + telephone a cote */}
        <div className="mt-8 sm:mt-10">
          <SiteContactCta slug={slug} companyName={profile.company_name} phone={displayPhone} />
        </div>
      </div>
    </section>
  );
}
