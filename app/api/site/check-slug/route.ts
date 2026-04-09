import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Slugs reserves — ne peuvent pas etre utilises comme sous-chemin /site/{slug}
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'assets',
  'auth',
  'dashboard',
  'login',
  'logout',
  'signup',
  'new',
  'create',
  'edit',
  'settings',
  'public',
  'static',
  'sitemap',
  'robots',
  'favicon',
  'realisations',
  'contact',
  'about',
  'services',
  'projets',
  'devis',
  'hellobat',
  'www',
]);

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MIN_LEN = 3;
const MAX_LEN = 60;

/**
 * GET /api/site/check-slug?slug=mon-slug
 *
 * Auth requise. Verifie si un slug est disponible pour le site de l'artisan.
 * Retourne :
 *   - available=true si libre ou deja possede par l'utilisateur connecte
 *   - available=false + reason (invalid | reserved | taken) sinon
 */
export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('slug') || '').trim().toLowerCase();

  if (!raw) {
    return NextResponse.json({
      available: false,
      reason: 'invalid',
      message: 'Veuillez choisir une adresse',
    });
  }

  if (raw.length < MIN_LEN) {
    return NextResponse.json({
      available: false,
      reason: 'invalid',
      message: `${MIN_LEN} caracteres minimum`,
    });
  }

  if (raw.length > MAX_LEN) {
    return NextResponse.json({
      available: false,
      reason: 'invalid',
      message: `${MAX_LEN} caracteres maximum`,
    });
  }

  if (!SLUG_REGEX.test(raw)) {
    return NextResponse.json({
      available: false,
      reason: 'invalid',
      message: 'Uniquement lettres minuscules, chiffres et tirets',
    });
  }

  if (RESERVED_SLUGS.has(raw)) {
    return NextResponse.json({
      available: false,
      reason: 'reserved',
      message: 'Cette adresse est reservee',
    });
  }

  // Service role — on a besoin de voir tous les sites (pas juste ceux de l'user)
  // pour detecter les collisions entre utilisateurs
  const { data: existing } = await supabaseAdmin
    .from('artisan_sites')
    .select('user_id')
    .eq('slug', raw)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ available: true });
  }

  // Deja possede par l'utilisateur connecte — c'est ok, il peut garder son slug
  if (existing.user_id === user.id) {
    return NextResponse.json({ available: true, reason: 'owned' });
  }

  return NextResponse.json({
    available: false,
    reason: 'taken',
    message: 'Cette adresse est deja prise',
  });
}
