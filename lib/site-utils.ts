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
  highlights?: { label: string; value: string }[];
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

export interface SiteContentFaq {
  question: string;
  answer: string;
}

export interface SiteContent {
  hero: SiteContentHero;
  about: SiteContentAbout;
  services: SiteContentService[];
  contact: SiteContentContact;
  seo: SiteContentSeo;
  footer: SiteContentFooter;
  faq?: SiteContentFaq[];
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
  show_map: boolean;
  hero_image_url: string;
  hero_layout: 'single' | 'grid' | 'carousel';
  hero_images: string[];
  legal_text: string;
  custom_slogan: string;
  public_phone: string;
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
  name: string;
  notes: string | null;
  public_description?: string | null;
  public_category?: string | null;
  public_slug?: string | null;
  public_completion_date?: string | null;
  published_at?: string | null;
  address: string | null;
  city: string | null;
  status: string;
  project_photos: { id: string; url: string; caption: string | null; category?: string | null }[];
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

// ── Site URL ──

const SITE_BASE_DOMAIN = 'hellobat.app';

/** Returns the public URL of an artisan site (subdomain in prod, path in dev). */
export function getSiteUrl(slug: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `http://localhost:3000/site/${slug}`;
  }
  return `https://${slug}.${SITE_BASE_DOMAIN}`;
}

// ── Slug ──

export function generateSlug(companyName: string, city?: string | null): string {
  const parts = [companyName, city].filter(Boolean).join(' ');
  return slugify(parts, 60);
}

export function slugify(input: string, max = 80): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, max);
}

export function generateProjectSlug(name: string, city?: string | null): string {
  const parts = [name, city].filter(Boolean).join(' ');
  return slugify(parts, 80);
}

// ── Theme definitions ──

export interface SiteThemeStyle {
  name: string;
  tagline: string;
  description: string;
  target: string;
  // Tailwind classes for the legacy small swatch
  preview_bg: string;
  preview_accent: string;
  // Inline color values used by the realistic preview cards / modal
  bg: string;
  bgAlt: string;
  cardBg: string;
  border: string;
  text: string;
  textMuted: string;
  heading: string;
  accent: string;
  accentText: string;
  fontFamily: string;
  fontLabel: string;
  radius: string;
}

export const SITE_THEMES: Record<SiteTheme, SiteThemeStyle> = {
  modern: {
    name: 'Moderne',
    tagline: 'Sobre, sombre, technologique',
    description: "Fond sombre elegant, accents bleus, typographie sans-serif. Donne une image high-tech et premium.",
    target: "Electriciens, domotique, energies renouvelables, photovoltaique, climatisation",
    preview_bg: 'bg-slate-900',
    preview_accent: 'bg-blue-500',
    bg: '#0f172a',
    bgAlt: '#1e293b',
    cardBg: '#1e293b',
    border: '#334155',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    heading: '#ffffff',
    accent: '#3b82f6',
    accentText: '#ffffff',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    fontLabel: 'Inter',
    radius: '0.75rem',
  },
  warm: {
    name: 'Chaleureux',
    tagline: 'Authentique, traditionnel, artisanal',
    description: "Tons creme et ambre, typographie serif elegante. Inspire confiance et savoir-faire traditionnel.",
    target: "Macons, charpentiers, menuisiers, ebenistes, couvreurs, artisans du patrimoine",
    preview_bg: 'bg-amber-50',
    preview_accent: 'bg-amber-600',
    bg: '#fffbf5',
    bgAlt: '#fef3e2',
    cardBg: '#ffffff',
    border: '#e7e5e4',
    text: '#44403c',
    textMuted: '#78716c',
    heading: '#292524',
    accent: '#d97706',
    accentText: '#ffffff',
    fontFamily: "'Georgia', 'Times New Roman', serif",
    fontLabel: 'Georgia',
    radius: '1rem',
  },
  clean: {
    name: 'Epure',
    tagline: 'Minimaliste, lumineux, professionnel',
    description: "Fond blanc, beaucoup d'espace, accents emeraude. Look pro et rassurant, parfait pour la conversion.",
    target: "Plombiers, peintres, carreleurs, platriers, multi-services, generalistes",
    preview_bg: 'bg-white',
    preview_accent: 'bg-emerald-500',
    bg: '#ffffff',
    bgAlt: '#f8faf9',
    cardBg: '#ffffff',
    border: '#e5e7eb',
    text: '#374151',
    textMuted: '#6b7280',
    heading: '#111827',
    accent: '#059669',
    accentText: '#ffffff',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    fontLabel: 'Inter',
    radius: '0.5rem',
  },
  bold: {
    name: 'Dynamique',
    tagline: 'Impactant, energique, moderne',
    description: "Fond charbon, accents rouges puissants. Pour se demarquer et exprimer une identite forte.",
    target: "Depannage urgent, serruriers, chauffagistes, paysagistes, jeunes entreprises",
    preview_bg: 'bg-slate-800',
    preview_accent: 'bg-red-500',
    bg: '#18181b',
    bgAlt: '#27272a',
    cardBg: '#27272a',
    border: '#3f3f46',
    text: '#e4e4e7',
    textMuted: '#a1a1aa',
    heading: '#ffffff',
    accent: '#ef4444',
    accentText: '#ffffff',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    fontLabel: 'Inter',
    radius: '0.75rem',
  },
};
