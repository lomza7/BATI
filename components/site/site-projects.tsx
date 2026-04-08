import Link from 'next/link';
import { MapPin, ArrowRight } from 'lucide-react';
import type { SiteProject } from '@/lib/site-utils';

interface SiteProjectsProps {
  projects: SiteProject[];
  siteSlug: string;
}

function pickCoverPhoto(project: SiteProject) {
  const photos = project.project_photos as (typeof project.project_photos[number] & { category?: string })[];
  return (
    photos.find((p) => p.category === 'presentation') ||
    photos.find((p) => p.category === 'apres') ||
    photos[0]
  );
}

export function SiteProjects({ projects, siteSlug }: SiteProjectsProps) {
  if (projects.length === 0) return null;

  return (
    <section
      id="realisations"
      className="py-16 sm:py-20 px-4 sm:px-6"
      style={{ backgroundColor: 'var(--site-bg-alt)' }}
    >
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-4"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          Nos realisations
        </h2>
        <p
          className="text-center text-sm sm:text-base max-w-2xl mx-auto mb-12"
          style={{ color: 'var(--site-text-muted)' }}
        >
          Decouvrez nos derniers chantiers : photos avant/apres, descriptif des travaux et resultats obtenus.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const cover = pickCoverPhoto(project);
            const href = project.public_slug
              ? `/site/${siteSlug}/realisations/${project.public_slug}`
              : null;

            const cardContent = (
              <>
                <div
                  className="relative aspect-[4/3] overflow-hidden"
                  style={{ backgroundColor: 'var(--site-card-bg)' }}
                >
                  {cover ? (
                    <img
                      src={cover.url}
                      alt={project.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ backgroundColor: 'var(--site-bg-alt)', color: 'var(--site-text-muted)' }}
                    >
                      <span className="text-xs">Aucune photo</span>
                    </div>
                  )}
                  {project.public_category && (
                    <span
                      className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: 'var(--site-accent)',
                        color: 'var(--site-accent-text, #ffffff)',
                      }}
                    >
                      {project.public_category}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3
                    className="text-lg font-semibold mb-1"
                    style={{ color: 'var(--site-heading)' }}
                  >
                    {project.name}
                  </h3>
                  {project.city && (
                    <p
                      className="flex items-center gap-1 text-xs mb-3"
                      style={{ color: 'var(--site-text-muted)' }}
                    >
                      <MapPin className="h-3 w-3" />
                      {project.city}
                    </p>
                  )}
                  {(project.public_description || project.description) && (
                    <p
                      className="text-sm leading-relaxed line-clamp-3"
                      style={{ color: 'var(--site-text)' }}
                    >
                      {project.public_description || project.description}
                    </p>
                  )}
                  {href && (
                    <div
                      className="mt-4 flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: 'var(--site-accent)' }}
                    >
                      Voir le chantier
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  )}
                </div>
              </>
            );

            const cardClasses =
              'group overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-lg';
            const cardStyle = {
              backgroundColor: 'var(--site-card-bg)',
              borderColor: 'var(--site-card-border)',
              borderRadius: 'var(--site-radius)',
            };

            return href ? (
              <Link key={project.id} href={href} className={cardClasses} style={cardStyle}>
                {cardContent}
              </Link>
            ) : (
              <div key={project.id} className={cardClasses} style={cardStyle}>
                {cardContent}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
