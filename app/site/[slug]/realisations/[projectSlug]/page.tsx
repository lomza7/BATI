import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import { ArrowLeft, Calendar, MapPin, CheckCircle2 } from 'lucide-react';
import type { ArtisanSite, SiteContent, SiteProfile } from '@/lib/site-utils';
import { getSiteUrl } from '@/lib/site-utils';
import { SiteHeader } from '@/components/site/site-header';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteContact } from '@/components/site/site-contact';

export const revalidate = 3600;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

interface ProjectPhoto {
  id: string;
  url: string;
  caption: string | null;
  category: string;
}

interface ProjectRow {
  id: string;
  name: string;
  notes: string | null;
  public_description: string | null;
  public_category: string | null;
  public_slug: string | null;
  public_completion_date: string | null;
  published_at: string | null;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  project_photos: ProjectPhoto[];
}

async function getProjectData(siteSlug: string, projectSlug: string) {
  const sb = getAnonClient();

  const { data: site } = await sb
    .from('artisan_sites')
    .select('*')
    .eq('slug', siteSlug)
    .eq('status', 'published')
    .maybeSingle();

  if (!site) return null;
  const typedSite = site as ArtisanSite;

  const [projectRes, profileRes, otherProjectsRes, reviewsRes, servicesRes] = await Promise.all([
    sb
      .from('projects')
      .select('id, name, notes, public_description, public_category, public_slug, public_completion_date, published_at, address, city, lat, lng, status, start_date, end_date, project_photos(id, url, caption, category)')
      .eq('user_id', typedSite.user_id)
      .eq('public_slug', projectSlug)
      .eq('is_public', true)
      .is('deleted_at', null)
      .maybeSingle(),
    sb.from('profiles').select('*').eq('id', typedSite.user_id).maybeSingle(),
    sb
      .from('projects')
      .select('id, name, public_slug, public_category, public_description, city, project_photos(id, url, category)')
      .eq('user_id', typedSite.user_id)
      .eq('is_public', true)
      .not('public_slug', 'is', null)
      .not('published_at', 'is', null)
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(6),
    sb
      .from('reviews')
      .select('id')
      .eq('user_id', typedSite.user_id)
      .eq('is_published_on_site', true),
    sb
      .from('services')
      .select('id')
      .eq('user_id', typedSite.user_id)
      .is('deleted_at', null)
      .limit(1),
  ]);

  if (!projectRes.data) return null;

  return {
    site: typedSite,
    project: projectRes.data as ProjectRow,
    profile: profileRes.data as SiteProfile | null,
    relatedProjects: ((otherProjectsRes.data || []) as ProjectRow[]).filter(
      (p) => p.public_slug !== projectSlug
    ),
    hasReviews: (reviewsRes.data?.length || 0) > 0,
    hasServices: (servicesRes.data?.length || 0) > 0,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}): Promise<Metadata> {
  const { slug, projectSlug } = await params;
  const data = await getProjectData(slug, projectSlug);
  if (!data || !data.profile) return { title: 'Chantier introuvable' };

  const { project, profile } = data;
  const city = project.city || profile.company_city || '';
  const activity = profile.company_activity || 'artisan';
  const keywords = [
    project.public_category,
    project.name,
    city,
    activity,
    profile.company_name,
    `${project.public_category || ''} ${city}`.trim(),
    `${activity} ${city}`.trim(),
  ].filter(Boolean) as string[];

  const title = [
    project.public_category || project.name,
    city ? `a ${city}` : '',
    '-',
    profile.company_name,
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 60);

  const description = (project.public_description || project.notes || '')
    .replace(/\s+/g, ' ')
    .slice(0, 155);

  const canonicalUrl = `${getSiteUrl(slug)}/realisations/${projectSlug}`;
  const firstPhoto = project.project_photos.find((p) => p.category === 'presentation')
    || project.project_photos.find((p) => p.category === 'apres')
    || project.project_photos[0];

  return {
    title,
    description: description || `${project.public_category || 'Chantier'} realise par ${profile.company_name}${city ? ` a ${city}` : ''}.`,
    keywords,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'article',
      locale: 'fr_FR',
      siteName: profile.company_name,
      ...(firstPhoto && {
        images: [
          { url: firstPhoto.url, alt: project.name, width: 1200, height: 800 },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(firstPhoto && { images: [firstPhoto.url] }),
    },
  };
}

// Pas de pre-rendu au build : on compte sur l'ISR on-demand (revalidate=3600).
// Les chantiers sont publies en continu — un build complet ne les verrait pas.
export async function generateStaticParams() {
  return [];
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = await params;
  const data = await getProjectData(slug, projectSlug);
  if (!data || !data.profile) notFound();

  const { site, project, profile, relatedProjects, hasReviews, hasServices } = data;
  const content = site.site_content as SiteContent;
  const siteUrl = getSiteUrl(slug);
  const canonicalUrl = `${siteUrl}/realisations/${projectSlug}`;

  const sortedPhotos = [...project.project_photos].sort((a, b) => {
    const order = ['presentation', 'apres', 'pendant', 'avant'];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });

  const heroPhoto = sortedPhotos[0];
  const galleryPhotos = sortedPhotos.slice(1);
  const completionLabel = formatDate(
    project.public_completion_date || project.end_date || project.published_at
  );
  const city = project.city || profile.company_city || '';
  const activity = profile.company_activity || 'Artisan du batiment';

  // JSON-LD : Article + BreadcrumbList + Service
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: project.public_category
        ? `${project.public_category}${city ? ` a ${city}` : ''}`
        : project.name,
      description: project.public_description || project.notes || undefined,
      image: sortedPhotos.map((p) => p.url).slice(0, 6),
      datePublished: project.published_at || undefined,
      dateModified: project.published_at || undefined,
      author: {
        '@type': 'Organization',
        name: profile.company_name,
        url: siteUrl,
        ...(profile.logo_url && { logo: profile.logo_url }),
      },
      publisher: {
        '@type': 'Organization',
        name: profile.company_name,
        ...(profile.logo_url && { logo: { '@type': 'ImageObject', url: profile.logo_url } }),
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
      ...(city && {
        contentLocation: {
          '@type': 'Place',
          name: city,
          ...(project.lat && project.lng && {
            geo: { '@type': 'GeoCoordinates', latitude: project.lat, longitude: project.lng },
          }),
        },
      }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Realisations', item: `${siteUrl}#realisations` },
        {
          '@type': 'ListItem',
          position: 3,
          name: project.public_category || project.name,
          item: canonicalUrl,
        },
      ],
    },
  ];

  return (
    <div
      data-site-theme={site.theme}
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--site-bg)',
        color: 'var(--site-text)',
        fontFamily: 'var(--site-font)',
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader
        profile={profile}
        slug={slug}
        phone={site.public_phone || profile.company_phone || undefined}
        showServices={site.show_services}
        showProjects={site.show_projects}
        showReviews={site.show_reviews}
        showContact={site.show_contact}
        hasServices={hasServices}
        hasProjects={true}
        hasReviews={hasReviews}
        basePath={`/site/${slug}`}
      />

      {/* Hero photo */}
      {heroPhoto && (
        <div className="relative h-[45vh] sm:h-[55vh] overflow-hidden">
          <img
            src={heroPhoto.url}
            alt={project.name}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%)' }}
          />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-8 lg:p-12">
            <div className="max-w-4xl mx-auto">
              {project.public_category && (
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-2 sm:mb-3"
                  style={{ backgroundColor: 'var(--site-accent)', color: '#ffffff' }}
                >
                  {project.public_category}
                </span>
              )}
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-md leading-tight">
                {project.name}
              </h1>
              <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-white/90">
                {city && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {city}
                  </span>
                )}
                {completionLabel && (
                  <span className="flex items-center gap-1.5 capitalize">
                    <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    {completionLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb + content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        {/* Breadcrumb */}
        <nav className="mb-6 sm:mb-8 text-xs" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 flex-wrap">
            <li>
              <Link
                href={`/site/${slug}`}
                className="flex items-center gap-1 hover:underline"
                style={{ color: 'var(--site-text-muted)' }}
              >
                <ArrowLeft className="h-3 w-3" />
                Accueil
              </Link>
            </li>
            <li style={{ color: 'var(--site-text-muted)' }}>/</li>
            <li>
              <Link
                href={`/site/${slug}#realisations`}
                className="hover:underline"
                style={{ color: 'var(--site-text-muted)' }}
              >
                Realisations
              </Link>
            </li>
            <li style={{ color: 'var(--site-text-muted)' }}>/</li>
            <li style={{ color: 'var(--site-text)' }}>
              {project.public_category || project.name}
            </li>
          </ol>
        </nav>

        {!heroPhoto && (
          <div className="mb-6 sm:mb-8">
            {project.public_category && (
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-3"
                style={{ backgroundColor: 'var(--site-accent)', color: '#ffffff' }}
              >
                {project.public_category}
              </span>
            )}
            <h1 className="text-2xl sm:text-4xl font-bold leading-tight" style={{ color: 'var(--site-heading)' }}>
              {project.name}
            </h1>
            <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm" style={{ color: 'var(--site-text-muted)' }}>
              {city && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {city}
                </span>
              )}
              {completionLabel && (
                <span className="flex items-center gap-1.5 capitalize">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {completionLabel}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        {(project.public_description || project.notes) && (
          <div className="prose max-w-none mb-8 sm:mb-12">
            {(project.public_description || project.notes || '')
              .split('\n')
              .filter((p) => p.trim())
              .map((paragraph, i) => (
                <p
                  key={i}
                  className="text-sm sm:text-base lg:text-lg leading-relaxed mb-4 sm:mb-5"
                  style={{ color: 'var(--site-text)' }}
                >
                  {paragraph}
                </p>
              ))}
          </div>
        )}

        {/* Gallery */}
        {galleryPhotos.length > 0 && (
          <section className="mb-8 sm:mb-12">
            <h2
              className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6"
              style={{ color: 'var(--site-heading)' }}
            >
              Galerie du chantier
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {galleryPhotos.map((photo) => (
                <figure
                  key={photo.id}
                  className="overflow-hidden border"
                  style={{
                    backgroundColor: 'var(--site-card-bg)',
                    borderColor: 'var(--site-card-border)',
                    borderRadius: 'var(--site-radius)',
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || `${project.name} - photo ${photo.category}`}
                    className="w-full h-56 sm:h-64 object-cover"
                    loading="lazy"
                  />
                  {(photo.caption || photo.category) && (
                    <figcaption
                      className="px-4 py-2.5 sm:py-3 text-xs capitalize"
                      style={{ color: 'var(--site-text-muted)' }}
                    >
                      {photo.caption || `Photo ${photo.category}`}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Trust block / CTA */}
        <div
          className="border p-5 sm:p-8 text-center"
          style={{
            backgroundColor: 'var(--site-bg-alt)',
            borderColor: 'var(--site-border)',
            borderRadius: 'var(--site-radius)',
          }}
        >
          <CheckCircle2
            className="mx-auto h-9 w-9 sm:h-10 sm:w-10 mb-3"
            style={{ color: 'var(--site-accent)' }}
          />
          <h2
            className="text-lg sm:text-2xl font-bold mb-2 leading-tight"
            style={{ color: 'var(--site-heading)' }}
          >
            Vous avez un projet similaire {city ? `a ${city}` : ''}?
          </h2>
          <p className="text-xs sm:text-sm mb-5 sm:mb-6 max-w-xl mx-auto" style={{ color: 'var(--site-text-muted)' }}>
            {profile.company_name} intervient sur tous vos projets de {activity.toLowerCase()}. Devis gratuit et sans engagement.
          </p>
          <Link
            href={`/site/${slug}#contact`}
            className="inline-flex items-center justify-center w-full sm:w-auto text-sm sm:text-base font-semibold px-6 py-3 transition-all hover:scale-105"
            style={{
              backgroundColor: 'var(--site-accent)',
              color: '#ffffff',
              borderRadius: 'var(--site-radius)',
            }}
          >
            Demander un devis gratuit
          </Link>
        </div>

        {/* Related projects */}
        {relatedProjects.length > 0 && (
          <section className="mt-10 sm:mt-16">
            <h2
              className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6"
              style={{ color: 'var(--site-heading)' }}
            >
              Nos autres realisations
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {relatedProjects.slice(0, 3).map((rp) => {
                const photos = (rp.project_photos || []) as ProjectPhoto[];
                const cover =
                  photos.find((p) => p.category === 'presentation') ||
                  photos.find((p) => p.category === 'apres') ||
                  photos[0];
                return (
                  <Link
                    key={rp.id}
                    href={`/site/${slug}/realisations/${rp.public_slug}`}
                    className="group overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    style={{
                      backgroundColor: 'var(--site-card-bg)',
                      borderColor: 'var(--site-card-border)',
                      borderRadius: 'var(--site-radius)',
                    }}
                  >
                    {cover && (
                      <div className="aspect-[4/3] overflow-hidden">
                        <img
                          src={cover.url}
                          alt={rp.name}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      {rp.public_category && (
                        <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--site-accent)' }}>
                          {rp.public_category}
                        </p>
                      )}
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--site-heading)' }}>
                        {rp.name}
                      </h3>
                      {rp.city && (
                        <p className="text-xs mt-1" style={{ color: 'var(--site-text-muted)' }}>
                          {rp.city}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Contact */}
      {site.show_contact && (
        <SiteContact
          profile={profile}
          contact={content.contact}
          slug={slug}
          phone={site.public_phone || profile.company_phone || undefined}
        />
      )}

      <SiteFooter profile={profile} footer={content.footer} legalText={site.legal_text || undefined} activity={profile.company_activity || undefined} city={profile.company_city || undefined} />
    </div>
  );
}
