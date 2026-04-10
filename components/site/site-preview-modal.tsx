'use client';

import '@/components/site/site-themes.css';
import { useEffect, useState } from 'react';
import { X, Loader2, Monitor, Smartphone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import type {
  SiteTheme,
  SiteContent,
  SiteProfile,
  SiteProject,
  SiteReview,
  SiteService,
} from '@/lib/site-utils';
import { SiteHeader } from './site-header';
import { SiteHero } from './site-hero';
import { SiteServices } from './site-services';
import { SiteProjects } from './site-projects';
import { SiteMap } from './site-map';
import { SiteReviews } from './site-reviews';
import { SiteFaq } from './site-faq';
import { SiteContact } from './site-contact';
import { SiteFooter } from './site-footer';
import { SitePreviewFrame } from './site-preview-frame';

const THEME_ACCENTS: Record<SiteTheme, string> = {
  modern: '#3b82f6',
  warm: '#d97706',
  clean: '#059669',
  bold: '#ef4444',
};

interface SitePreviewModalProps {
  open: boolean;
  onClose: () => void;
  theme: SiteTheme;
  siteContent: SiteContent;
  slug: string;
  logoUrl: string;
  heroImageUrl: string;
  heroImages: string[];
  heroLayout: 'single' | 'grid' | 'carousel';
  publicPhone: string;
  legalText: string;
  showServices: boolean;
  showProjects: boolean;
  showReviews: boolean;
  showContact: boolean;
  showMap: boolean;
}

type DeviceView = 'desktop' | 'mobile';

export function SitePreviewModal(props: SitePreviewModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<DeviceView>('desktop');
  const [profile, setProfile] = useState<SiteProfile | null>(null);
  const [projects, setProjects] = useState<(SiteProject & { lat?: number; lng?: number })[]>([]);
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [services, setServices] = useState<SiteService[]>([]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!props.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [props.open]);

  // Close on Escape
  useEffect(() => {
    if (!props.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [props.open, props]);

  // Fetch live data on open
  useEffect(() => {
    if (!props.open || !user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [profileRes, projectsRes, reviewsRes, servicesRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase
            .from('projects')
            .select('id, name, description, public_description, public_category, public_slug, public_completion_date, published_at, address, city, status, lat, lng, project_photos(id, url, caption, category)')
            .eq('user_id', user.id)
            .eq('is_public', true)
            .not('published_at', 'is', null)
            .is('deleted_at', null)
            .order('published_at', { ascending: false })
            .limit(30),
          supabase
            .from('reviews')
            .select('id, client_name, rating, comment, created_at, review_date')
            .eq('user_id', user.id)
            .eq('is_published_on_site', true)
            .order('review_date', { ascending: false, nullsFirst: false })
            .limit(12),
          supabase
            .from('services')
            .select('id, name, description, category, unit_price')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .limit(20),
        ]);

        if (cancelled) return;

        setProfile((profileRes.data as SiteProfile) || null);
        setProjects((projectsRes.data || []) as (SiteProject & { lat?: number; lng?: number })[]);
        setReviews(
          (reviewsRes.data || []).map((r: { id: string; client_name: string; rating: number; comment: string | null; created_at: string; review_date?: string | null }) => ({
            id: r.id,
            author_name: r.client_name,
            rating: r.rating,
            comment: r.comment,
            created_at: r.review_date || r.created_at,
          })) as SiteReview[]
        );
        setServices((servicesRes.data || []) as SiteService[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.open, user]);

  if (!props.open) return null;

  const {
    theme,
    siteContent,
    slug,
    logoUrl,
    heroImageUrl,
    heroImages,
    heroLayout,
    publicPhone,
    legalText,
    showServices,
    showProjects,
    showReviews,
    showContact,
    showMap,
  } = props;

  // Profile override: inject the logo in-memory even if not yet saved
  const previewProfile: SiteProfile | null = profile
    ? { ...profile, logo_url: logoUrl || profile.logo_url }
    : null;

  const mapProjects = projects
    .filter((p) => p.lat && p.lng)
    .map((p) => ({ id: p.id, title: p.name, city: p.city, lat: p.lat!, lng: p.lng! }));

  const previewSlug = slug || 'preview';
  const previewPhone = publicPhone || previewProfile?.company_phone || undefined;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-neutral-950/95 text-white shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          <div className="h-2 w-2 rounded-full bg-amber-500" />
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="ml-3 text-sm font-medium truncate">
            Aperçu &mdash;{' '}
            <span className="text-white/60 font-mono">
              {previewSlug}.hellobat.app
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Device toggle */}
          <div className="hidden sm:flex rounded-md border border-white/15 overflow-hidden">
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                device === 'desktop' ? 'bg-white text-neutral-900' : 'text-white/70 hover:text-white hover:bg-white/5'
              )}
              aria-label="Aperçu bureau"
            >
              <Monitor className="h-3.5 w-3.5" />
              Bureau
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-white/15',
                device === 'mobile' ? 'bg-white text-neutral-900' : 'text-white/70 hover:text-white hover:bg-white/5'
              )}
              aria-label="Aperçu mobile"
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobile
            </button>
          </div>

          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10 transition-colors"
            aria-label="Fermer l'aperçu"
          >
            <X className="h-3.5 w-3.5" />
            Fermer
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto flex justify-center">
        {loading || !previewProfile ? (
          <div className="flex items-center justify-center w-full text-white/70">
            <Loader2 className="h-6 w-6 animate-spin mr-3" />
            <span className="text-sm">Chargement de l&apos;aperçu...</span>
          </div>
        ) : (
          <PreviewContent
            device={device}
            theme={theme}
            siteContent={siteContent}
            previewProfile={previewProfile}
            previewSlug={previewSlug}
            previewPhone={previewPhone}
            heroImageUrl={heroImageUrl}
            heroImages={heroImages}
            heroLayout={heroLayout}
            showServices={showServices}
            showProjects={showProjects}
            showReviews={showReviews}
            showContact={showContact}
            showMap={showMap}
            services={services}
            projects={projects}
            mapProjects={mapProjects}
            reviews={reviews}
            legalText={legalText}
          />
        )}
      </div>
    </div>
  );
}

/* ── Inner preview content — shared between desktop (div) and mobile (iframe) ── */

interface PreviewContentProps {
  device: DeviceView;
  theme: SiteTheme;
  siteContent: SiteContent;
  previewProfile: SiteProfile;
  previewSlug: string;
  previewPhone: string | undefined;
  heroImageUrl: string;
  heroImages: string[];
  heroLayout: 'single' | 'grid' | 'carousel';
  showServices: boolean;
  showProjects: boolean;
  showReviews: boolean;
  showContact: boolean;
  showMap: boolean;
  services: SiteService[];
  projects: (SiteProject & { lat?: number; lng?: number })[];
  mapProjects: { id: string; title: string; city: string | null; lat: number; lng: number }[];
  reviews: SiteReview[];
  legalText: string;
}

function SiteContentRenderer({
  theme, siteContent, previewProfile, previewSlug, previewPhone,
  heroImageUrl, heroImages, heroLayout,
  showServices, showProjects, showReviews, showContact, showMap,
  services, projects, mapProjects, reviews, legalText,
}: Omit<PreviewContentProps, 'device'>) {
  return (
    <div
      data-site-theme={theme}
      className="min-h-full"
      style={{
        backgroundColor: 'var(--site-bg)',
        color: 'var(--site-text)',
        fontFamily: 'var(--site-font)',
      }}
    >
      <SiteHeader
        profile={previewProfile}
        slug={previewSlug}
        phone={previewPhone}
        showServices={showServices}
        showProjects={showProjects}
        showReviews={showReviews}
        showContact={showContact}
        hasServices={services.length > 0 || (siteContent.services?.length || 0) > 0}
        hasProjects={projects.length > 0}
        hasReviews={reviews.length > 0}
      />

      <SiteHero
        hero={siteContent.hero}
        companyName={previewProfile.company_name}
        heroImageUrl={heroImageUrl || undefined}
        heroImages={heroImages || []}
        heroLayout={heroLayout || 'single'}
        slug={previewSlug}
        phone={previewPhone}
      />

      {/* About + Highlights */}
      <section
        id="a-propos"
        className="py-12 sm:py-20 px-4 sm:px-6"
        style={{ backgroundColor: 'var(--site-bg)' }}
      >
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8"
            style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
          >
            {siteContent.about?.title || 'À propos'}
          </h2>
          {siteContent.about?.paragraphs?.map((p, i) => (
            <p key={i} className="mb-4 leading-relaxed text-sm sm:text-base" style={{ color: 'var(--site-text)' }}>
              {p}
            </p>
          ))}

          {siteContent.about?.highlights && siteContent.about.highlights.length > 0 && (
            <div className="flex flex-wrap justify-center gap-6 sm:gap-8 mt-8 sm:mt-10">
              {siteContent.about.highlights.map((h, i) => (
                <div key={i} className="text-center">
                  <p
                    className="text-3xl sm:text-4xl font-bold"
                    style={{ color: 'var(--site-accent)' }}
                  >
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

      {showServices && (services.length > 0 || (siteContent.services?.length || 0) > 0) && (
        <SiteServices aiServices={siteContent.services || []} dbServices={services} />
      )}

      {showProjects && projects.length > 0 && (
        <SiteProjects projects={projects} siteSlug={previewSlug} />
      )}

      {showMap && mapProjects.length > 0 && (
        <SiteMap projects={mapProjects} accentColor={THEME_ACCENTS[theme]} />
      )}

      {showReviews && reviews.length > 0 && (
        <SiteReviews reviews={reviews} googleReviewLink={previewProfile.google_review_link} />
      )}

      {siteContent.faq && siteContent.faq.length > 0 && <SiteFaq faq={siteContent.faq} />}

      {showContact && (
        <SiteContact
          profile={previewProfile}
          contact={siteContent.contact}
          slug={previewSlug}
          phone={previewPhone}
        />
      )}

      <SiteFooter
        profile={previewProfile}
        footer={siteContent.footer}
        legalText={legalText || undefined}
        activity={previewProfile.company_activity || undefined}
        city={previewProfile.company_city || undefined}
      />
    </div>
  );
}

function PreviewContent(props: PreviewContentProps) {
  const { device, ...contentProps } = props;

  if (device === 'mobile') {
    return (
      <div className="my-6 flex justify-center">
        <div className="w-[390px] max-w-full rounded-[2.5rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl overflow-hidden"
          style={{ height: 'calc(100vh - 96px)' }}
        >
          <SitePreviewFrame
            className="w-full h-full rounded-[1.5rem]"
            style={{ width: '100%', height: '100%' }}
          >
            <SiteContentRenderer {...contentProps} />
          </SitePreviewFrame>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full transition-all duration-300 bg-white shadow-2xl">
      <SiteContentRenderer {...contentProps} />
    </div>
  );
}
