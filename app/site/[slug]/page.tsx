import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import type {
  ArtisanSite,
  SiteProfile,
  SiteProject,
  SiteReview,
  SiteService,
  SiteContent,
} from '@/lib/site-utils';
import { getSiteUrl } from '@/lib/site-utils';
import { SiteHeader } from '@/components/site/site-header';
import { SiteHero } from '@/components/site/site-hero';
import { SiteServices } from '@/components/site/site-services';
import { SiteProjects } from '@/components/site/site-projects';
import { SiteReviews } from '@/components/site/site-reviews';
import { SiteContact } from '@/components/site/site-contact';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteJsonLd } from '@/components/site/site-json-ld';
import { SiteFaq } from '@/components/site/site-faq';
import { SiteMap } from '@/components/site/site-map';

export const revalidate = 3600; // ISR — revalidate every hour

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Theme accent colors for the map markers
const THEME_ACCENTS: Record<string, string> = {
  modern: '#3b82f6',
  warm: '#d97706',
  clean: '#059669',
  bold: '#ef4444',
};

async function getSiteData(slug: string) {
  const sb = getAnonClient();

  const { data: site } = await sb
    .from('artisan_sites')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!site) return null;

  const typedSite = site as ArtisanSite;

  const [profileRes, projectsRes, reviewsRes, servicesRes] = await Promise.all([
    sb.from('profiles').select('*').eq('id', typedSite.user_id).maybeSingle(),
    sb
      .from('projects')
      .select('id, name, notes, public_description, public_category, public_slug, public_completion_date, published_at, address, city, status, lat, lng, project_photos(id, url, caption, category)')
      .eq('user_id', typedSite.user_id)
      .eq('is_public', true)
      .not('published_at', 'is', null)
      .is('deleted_at', null)
      .order('published_at', { ascending: false })
      .limit(30),
    sb
      .from('reviews')
      .select('id, client_name, rating, comment, created_at, review_date')
      .eq('user_id', typedSite.user_id)
      .eq('is_published_on_site', true)
      .order('review_date', { ascending: false, nullsFirst: false })
      .limit(12),
    sb
      .from('services')
      .select('id, name, description, category, unit_price')
      .eq('user_id', typedSite.user_id)
      .is('deleted_at', null)
      .limit(20),
  ]);

  return {
    site: typedSite,
    profile: profileRes.data as SiteProfile | null,
    projects: (projectsRes.data || []) as (SiteProject & { lat?: number; lng?: number })[],
    reviews: (reviewsRes.data || []).map((r: { id: string; client_name: string; rating: number; comment: string | null; created_at: string; review_date?: string | null }) => ({
      id: r.id,
      author_name: r.client_name,
      rating: r.rating,
      comment: r.comment,
      created_at: r.review_date || r.created_at,
    })) as SiteReview[],
    services: (servicesRes.data || []) as SiteService[],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSiteData(slug);
  if (!data) return { title: 'Site introuvable' };

  const content = data.site.site_content as SiteContent;
  const seo = content.seo;
  const siteUrl = getSiteUrl(slug);
  const companyName = data.profile?.company_name || 'Artisan du batiment';
  const city = data.profile?.company_city || '';
  const activity = data.profile?.company_activity || 'Batiment';

  const title =
    seo?.meta_title ||
    (city ? `${companyName} — ${activity} a ${city}` : `${companyName} — ${activity}`);
  const description =
    seo?.meta_description ||
    `${companyName}, ${activity.toLowerCase()}${city ? ` a ${city}` : ''}. Decouvrez nos realisations, services et avis clients.`;

  // Mots cles longue traine : activite + villes + categories de chantiers
  const keywords = Array.from(
    new Set(
      [
        activity,
        city && `${activity} ${city}`,
        city && `artisan ${city}`,
        ...data.projects.map((p) => p.public_category).filter(Boolean),
        ...data.projects
          .map((p) => (p.public_category && p.city ? `${p.public_category} ${p.city}` : null))
          .filter(Boolean),
        ...data.services.slice(0, 8).map((s) => s.name),
      ].filter(Boolean) as string[]
    )
  ).slice(0, 20);

  return {
    title,
    description,
    keywords,
    authors: [{ name: companyName }],
    creator: companyName,
    publisher: companyName,
    openGraph: {
      title,
      description,
      url: siteUrl,
      type: 'website',
      locale: 'fr_FR',
      siteName: companyName,
      ...(data.profile?.logo_url && {
        images: [
          {
            url: data.site.hero_image_url || data.profile.logo_url,
            width: 1200,
            height: 630,
            alt: companyName,
          },
        ],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(data.profile?.logo_url && {
        images: [data.site.hero_image_url || data.profile.logo_url],
      }),
    },
    alternates: { canonical: siteUrl },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function SitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getSiteData(slug);
  if (!data || !data.profile) notFound();

  const { site, profile, projects, reviews, services } = data;
  const content = site.site_content as SiteContent;
  const siteUrl = getSiteUrl(slug);

  // Projects with coordinates for the map
  const mapProjects = projects
    .filter(p => p.lat && p.lng)
    .map(p => ({ id: p.id, title: p.name, city: p.city, lat: p.lat!, lng: p.lng! }));

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
      <SiteJsonLd
        profile={profile}
        reviews={reviews}
        services={services}
        projects={projects}
        faq={content.faq}
        description={content.seo?.meta_description}
        siteUrl={siteUrl}
      />

      <SiteHeader
        profile={profile}
        slug={slug}
        phone={site.public_phone || profile.company_phone || undefined}
        showServices={site.show_services}
        showProjects={site.show_projects}
        showReviews={site.show_reviews}
        showContact={site.show_contact}
        hasServices={services.length > 0 || (content.services?.length || 0) > 0}
        hasProjects={projects.length > 0}
        hasReviews={reviews.length > 0}
      />

      <SiteHero
        hero={content.hero}
        companyName={profile.company_name}
        heroImageUrl={site.hero_image_url || undefined}
        heroImages={site.hero_images || []}
        heroLayout={site.hero_layout || 'single'}
        slug={slug}
        phone={site.public_phone || profile.company_phone || undefined}
      />

      {/* About + Highlights */}
      <section id="a-propos" className="py-12 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--site-bg)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8"
            style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
          >
            {content.about?.title || 'A propos'}
          </h2>
          {content.about?.paragraphs?.map((p, i) => (
            <p key={i} className="mb-4 leading-relaxed text-sm sm:text-base" style={{ color: 'var(--site-text)' }}>
              {p}
            </p>
          ))}

          {/* Highlights / key figures */}
          {content.about?.highlights && content.about.highlights.length > 0 && (
            <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mt-8 sm:mt-10">
              {content.about.highlights.map((h, i) => (
                <div key={i} className="text-center">
                  <p className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--site-accent)' }}>
                    {h.value}
                  </p>
                  <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--site-text-muted)' }}>
                    {h.label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {site.show_services && (services.length > 0 || (content.services?.length || 0) > 0) && (
        <SiteServices aiServices={content.services || []} dbServices={services} />
      )}

      {site.show_projects && projects.length > 0 && (
        <SiteProjects projects={projects} siteSlug={slug} />
      )}

      {/* Map of projects */}
      {(site.show_map ?? true) && mapProjects.length > 0 && (
        <SiteMap projects={mapProjects} accentColor={THEME_ACCENTS[site.theme] || '#3b82f6'} />
      )}

      {site.show_reviews && reviews.length > 0 && (
        <SiteReviews reviews={reviews} googleReviewLink={profile.google_review_link} />
      )}

      {/* FAQ */}
      {content.faq && content.faq.length > 0 && (
        <SiteFaq faq={content.faq} />
      )}

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
