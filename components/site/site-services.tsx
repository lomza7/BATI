import type { SiteContentService, SiteService } from '@/lib/site-utils';
import {
  Hammer, PaintBucket, Wrench, Home, Shield, Ruler, Zap, Droplets,
  Flame, Layers, Brush, HardHat, Building2, Plug, Thermometer,
  Pipette, TreePine, Warehouse, Lightbulb, Settings,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Hammer, PaintBucket, Wrench, Home, Shield, Ruler, Zap, Droplets,
  Flame, Layers, Brush, HardHat, Building2, Plug, Thermometer,
  Pipette, TreePine, Warehouse, Lightbulb, Settings,
};

interface SiteServicesProps {
  aiServices: SiteContentService[];
  dbServices: SiteService[];
}

export function SiteServices({ aiServices, dbServices }: SiteServicesProps) {
  // Merge: use DB services if available, otherwise AI-generated
  const services = dbServices.length > 0
    ? dbServices.map((s) => ({
        name: s.name,
        description: s.description,
        icon: 'Wrench',
      }))
    : aiServices;

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
            const Icon = ICON_MAP[service.icon] || Wrench;
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
