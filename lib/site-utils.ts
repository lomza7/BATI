// Site vitrine artisan — utilitaires

// ── Types ──

export type SiteTheme = 'modern' | 'warm' | 'clean' | 'bold';

export interface SiteContentHero {
  headline: string;
  subheadline: string;
  cta_text: string;
}

export interface SiteContentAbout {
  title: string;
  paragraphs: string[];
}

export interface SiteContentService {
  name: string;
  description: string;
  icon: string;
}

export interface SiteContentContact {
  title: string;
  description: string;
}

export interface SiteContentSeo {
  meta_title: string;
  meta_description: string;
}

export interface SiteContentFooter {
  tagline: string;
}

export interface SiteContent {
  hero: SiteContentHero;
  about: SiteContentAbout;
  services: SiteContentService[];
  contact: SiteContentContact;
  seo: SiteContentSeo;
  footer: SiteContentFooter;
}

export interface ArtisanSite {
  id: string;
  user_id: string;
  slug: string;
  status: 'draft' | 'published';
  theme: SiteTheme;
  site_content: SiteContent;
  show_services: boolean;
  show_projects: boolean;
  show_reviews: boolean;
  show_contact: boolean;
  custom_slogan: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteProfile {
  id: string;
  company_name: string;
  full_name: string | null;
  company_activity: string | null;
  company_city: string | null;
  company_address: string | null;
  company_postal_code: string | null;
  company_phone: string | null;
  logo_url: string | null;
  siret: string | null;
  tva_number: string | null;
  google_business_url: string | null;
  google_review_link: string | null;
  google_place_id: string | null;
  document_config: Record<string, unknown> | null;
}

export interface SiteProject {
  id: string;
  title: string;
  description: string | null;
  address: string | null;
  city: string | null;
  status: string;
  project_photos: { id: string; photo_url: string; caption: string | null }[];
}

export interface SiteReview {
  id: string;
  author_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface SiteService {
  id: string;
  name: string;
  description: string;
  category: string | null;
  unit_price: number | null;
}

// ── Slug ──

export function generateSlug(companyName: string, city?: string | null): string {
  const parts = [companyName, city].filter(Boolean).join(' ');
  return parts
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')     // non-alphanum → dash
    .replace(/^-+|-+$/g, '')          // trim dashes
    .substring(0, 60);                // max length
}

// ── Theme definitions ──

export const SITE_THEMES: Record<SiteTheme, { name: string; preview_bg: string; preview_accent: string }> = {
  modern: { name: 'Moderne', preview_bg: 'bg-slate-900', preview_accent: 'bg-blue-500' },
  warm: { name: 'Chaleureux', preview_bg: 'bg-amber-50', preview_accent: 'bg-amber-600' },
  clean: { name: 'Epure', preview_bg: 'bg-white', preview_accent: 'bg-emerald-500' },
  bold: { name: 'Dynamique', preview_bg: 'bg-slate-800', preview_accent: 'bg-red-500' },
};
