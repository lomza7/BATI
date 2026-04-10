import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

/**
 * Ajoute slug.hellobat.app comme domaine du projet Vercel.
 * Idempotent — Vercel renvoie 409 si le domaine existe déjà, on l'ignore.
 */
async function registerVercelDomain(slug: string) {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) return;

  const domain = `${slug}.hellobat.app`;
  const url = `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains${VERCEL_TEAM_ID ? `?teamId=${VERCEL_TEAM_ID}` : ''}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  });

  if (res.ok || res.status === 409) return; // 409 = already exists
  const body = await res.text();
  console.warn(`[vercel-domain] ${res.status} for ${domain}: ${body}`);
}

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

    // Enregistre le sous-domaine slug.hellobat.app dans Vercel (idempotent)
    await registerVercelDomain(slug).catch((err) => {
      console.warn('[revalidate] Vercel domain registration failed:', err);
    });

    return NextResponse.json({ revalidated: true });
  } catch {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
