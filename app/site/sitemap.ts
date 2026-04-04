import { createClient } from '@supabase/supabase-js';
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: sites } = await sb
    .from('artisan_sites')
    .select('slug, updated_at')
    .eq('status', 'published');

  return (sites || []).map((site) => ({
    url: `https://hellobat.app/site/${site.slug}`,
    lastModified: site.updated_at,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));
}
