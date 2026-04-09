import type { SiteContentService, SiteService } from '@/lib/site-utils';
import { SERVICE_ICON_MAP, DEFAULT_SERVICE_ICON } from './site-service-icons';
import { Wrench } from 'lucide-react';

interface SiteServicesProps {
  aiServices: SiteContentService[];
  dbServices: SiteService[];
}

export function SiteServices({ aiServices, dbServices }: SiteServicesProps) {
  // Les services afficher sont ceux edites dans /site-web (site_content.services).
  // Ils sont edites manuellement par l'artisan avec une icone au choix. Si aucun
  // service n'a ete saisi, on retombe sur la liste des prestations (services table).
  const services =
    aiServices.length > 0
      ? aiServices
      : dbServices.map((s) => ({
          name: s.name,
          description: s.description,
          icon: DEFAULT_SERVICE_ICON,
        }));

  if (services.length === 0) return null;

  return (
    <section id="services" className="py-16 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--site-bg)' }}>
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-12"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          Nos services
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, i) => {
            const Icon = SERVICE_ICON_MAP[service.icon] || Wrench;
            return (
              <div
                key={i}
                className="p-6 border transition-shadow hover:shadow-lg"
                style={{
                  backgroundColor: 'var(--site-card-bg)',
                  borderColor: 'var(--site-card-border)',
                  borderRadius: 'var(--site-radius)',
                }}
              >
                <div
                  className="w-12 h-12 flex items-center justify-center rounded-lg mb-4"
                  style={{ backgroundColor: 'var(--site-accent-light)' }}
                >
                  <Icon className="w-6 h-6" style={{ color: 'var(--site-accent)' }} />
                </div>
                <h3
                  className="text-lg font-semibold mb-2"
                  style={{ color: 'var(--site-heading)' }}
                >
                  {service.name}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--site-text-muted)' }}>
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
