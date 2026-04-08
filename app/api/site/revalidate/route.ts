import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  }

  try {
    const { slug } = await request.json();
    if (!slug) {
      return NextResponse.json({ error: 'slug requis' }, { status: 400 });
    }

    // Verify the user owns this site
    const { data: site } = await userClient
      .from('artisan_sites')
      .select('id')
      .eq('slug', slug)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!site) {
      return NextResponse.json({ error: 'Site introuvable' }, { status: 404 });
    }

    // Revalide la home du site et l'ensemble des pages realisations via layout.
    revalidatePath(`/site/${slug}`);
    revalidatePath(`/site/${slug}/realisations/[projectSlug]`, 'page');
    // Revalide aussi le sitemap pour les nouveaux chantiers/avis publies.
    revalidatePath('/site/sitemap.xml');

    return NextResponse.json({ revalidated: true });
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
