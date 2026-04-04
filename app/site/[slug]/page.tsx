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
import { SiteHeader } from '@/components/site/site-header';
import { SiteHero } from '@/components/site/site-hero';
import { SiteServices } from '@/components/site/site-services';
import { SiteProjects } from '@/components/site/site-projects';
import { SiteReviews } from '@/components/site/site-reviews';
import { SiteContact } from '@/components/site/site-contact';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteJsonLd } from '@/components/site/site-json-ld';

export const revalidate = 3600; // ISR — revalidate every hour

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

async function getSiteData(slug: string) {
  const sb = getAnonClient();

  // 1. Get the published site
  const { data: site } = await sb
    .from('artisan_sites')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!site) return null;

  const typedSite = site as ArtisanSite;

  // 2. Fetch related data in parallel
  const [profileRes, projectsRes, reviewsRes, servicesRes] = await Promise.all([
    sb.from('profiles').select('*').eq('id', typedSite.user_id).maybeSingle(),
    sb
      .from('projects')
      .select('id, title, description, address, city, status, project_photos(id, photo_url, caption)')
      .eq('user_id', typedSite.user_id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(12),
    sb
      .from('reviews')
      .select('id, author_name, rating, comment, created_at')
      .eq('user_id', typedSite.user_id)
      .order('created_at', { ascending: false })
      .limit(12),
    sb
      .from('services')
      .select('id, name, description, category, unit_price')
      .eq('user_id', typedSite.user_id)
      .limit(20),
  ]);

  return {
    site: typedSite,
    profile: profileRes.data as SiteProfile | null,
    projects: (projectsRes.data || []) as SiteProject[],
    reviews: (reviewsRes.data || []) as SiteReview[],
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
  const siteUrl = `https://hellobat.app/site/${slug}`;

  return {
    title: seo?.meta_title || data.profile?.company_name || 'Site artisan',
    description: seo?.meta_description || '',
    openGraph: {
      title: seo?.meta_title || data.profile?.company_name || 'Site artisan',
      description: seo?.meta_description || '',
      url: siteUrl,
      type: 'website',
      ...(data.profile?.logo_url && { images: [{ url: data.profile.logo_url }] }),
    },
    alternates: { canonical: siteUrl },
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
  const siteUrl = `https://hellobat.app/site/${slug}`;

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
      <SiteJsonLd profile={profile} reviews={reviews} siteUrl={siteUrl} />

      <SiteHeader
        profile={profile}
        showServices={site.show_services}
        showProjects={site.show_projects}
        showReviews={site.show_reviews}
        showContact={site.show_contact}
        hasServices={services.length > 0 || (content.services?.length || 0) > 0}
        hasProjects={projects.length > 0}
        hasReviews={reviews.length > 0}
      />

      <SiteHero hero={content.hero} companyName={profile.company_name} />

      {/* About */}
      <section id="a-propos" className="py-16 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--site-bg)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold mb-8"
            style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
          >
            {content.about?.title || 'A propos'}
          </h2>
          {content.about?.paragraphs?.map((p, i) => (
            <p key={i} className="mb-4 leading-relaxed" style={{ color: 'var(--site-text)' }}>
              {p}
            </p>
          ))}
        </div>
      </section>

      {site.show_services && (services.length > 0 || (content.services?.length || 0) > 0) && (
        <SiteServices aiServices={content.services || []} dbServices={services} />
      )}

      {site.show_projects && projects.length > 0 && (
        <SiteProjects projects={projects} />
      )}

      {site.show_reviews && reviews.length > 0 && (
        <SiteReviews reviews={reviews} googleReviewLink={profile.google_review_link} />
      )}

      {site.show_contact && (
        <SiteContact profile={profile} contact={content.contact} />
      )}

      <SiteFooter profile={profile} footer={content.footer} />
    </div>
  );
}
