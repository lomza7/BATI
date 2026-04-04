import type { SiteProject } from '@/lib/site-utils';

interface SiteProjectsProps {
  projects: SiteProject[];
}

export function SiteProjects({ projects }: SiteProjectsProps) {
  if (projects.length === 0) return null;

  // Collect all photos across projects
  const allPhotos = projects.flatMap((p) =>
    p.project_photos.map((photo) => ({
      ...photo,
      projectTitle: p.title,
      projectCity: p.city,
    }))
  );

  return (
    <section
      id="realisations"
      className="py-16 sm:py-20 px-4 sm:px-6"
      style={{ backgroundColor: 'var(--site-bg-alt)' }}
    >
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-12"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          Nos realisations
        </h2>

        {/* Photo gallery */}
        {allPhotos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allPhotos.slice(0, 9).map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-[4/3] overflow-hidden group"
                style={{ borderRadius: 'var(--site-radius)' }}
              >
                <img
                  src={photo.photo_url}
                  alt={photo.caption || photo.projectTitle}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }}
                >
                  <div>
                    <p className="text-white text-sm font-semibold">{photo.projectTitle}</p>
                    {photo.projectCity && (
                      <p className="text-white/80 text-xs">{photo.projectCity}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback: project cards without photos */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.slice(0, 6).map((project) => (
              <div
                key={project.id}
                className="p-6 border"
                style={{
                  backgroundColor: 'var(--site-card-bg)',
                  borderColor: 'var(--site-card-border)',
                  borderRadius: 'var(--site-radius)',
                }}
              >
                <h3
                  className="text-lg font-semibold mb-1"
                  style={{ color: 'var(--site-heading)' }}
                >
                  {project.title}
                </h3>
                {project.city && (
                  <p className="text-sm mb-2" style={{ color: 'var(--site-text-muted)' }}>
                    {project.city}
                  </p>
                )}
                {project.description && (
                  <p className="text-sm" style={{ color: 'var(--site-text)' }}>
                    {project.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
