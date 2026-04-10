import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site-utils';

// Revalidation reguliere du sitemap pour que Google decouvre
// les nouveaux chantiers publies.
export const revalidate = 3600;

interface SiteRow {
  slug: string;
  user_id: string;
  updated_at: string;
}

interface ProjectRow {
  public_slug: string;
  user_id: string;
  published_at: string | null;
  updated_at: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [{ data: sites }, { data: projects }] = await Promise.all([
    sb
      .from('artisan_sites')
      .select('slug, user_id, updated_at')
      .eq('status', 'published'),
    sb
      .from('projects')
      .select('public_slug, user_id, published_at, updated_at')
      .eq('is_public', true)
      .not('published_at', 'is', null)
      .not('public_slug', 'is', null)
      .is('deleted_at', null),
  ]);

  const siteList = (sites || []) as SiteRow[];
  const projectList = (projects || []) as ProjectRow[];

  // Map user_id -> slug du site publie, pour construire les URLs realisations
  const userToSlug = new Map<string, string>();
  for (const s of siteList) {
    userToSlug.set(s.user_id, s.slug);
  }

  const entries: MetadataRoute.Sitemap = [];

  // Pages d'accueil des sites
  for (const site of siteList) {
    entries.push({
      url: getSiteUrl(site.slug),
      lastModified: site.updated_at,
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  // Pages detail chantiers publies
  for (const project of projectList) {
    const siteSlug = userToSlug.get(project.user_id);
    if (!siteSlug || !project.public_slug) continue;
    entries.push({
      url: `${getSiteUrl(siteSlug)}/realisations/${project.public_slug}`,
      lastModified: project.published_at || project.updated_at,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  return entries;
}
