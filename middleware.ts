import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BASE_DOMAIN = 'hellobat.app';

const publicPaths = ['/', '/login', '/signup', '/carte/publique', '/mentions-legales', '/confidentialite', '/cookies', '/cgu', '/a-propos', '/contact', '/carrieres', '/presse', '/blog'];
const publicPrefixes = ['/site/', '/c/', '/d/', '/f/', '/r/', '/fonctionnalites/', '/comptable/', '/pay/', '/avis-public/'];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ── Sous-domaine artisan : slug.hellobat.app → rewrite vers /site/slug ──
  if (
    hostname !== BASE_DOMAIN &&
    hostname !== `www.${BASE_DOMAIN}` &&
    hostname.endsWith(`.${BASE_DOMAIN}`)
  ) {
    // Les routes API (et internes Next) doivent atteindre leur vrai chemin,
    // pas être préfixées par /site/slug — sinon elles renvoient une page 404
    // HTML que le front ne peut pas parser en JSON ("Unexpected token '<'").
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
      return NextResponse.next();
    }
    const slug = hostname.replace(`.${BASE_DOMAIN}`, '');
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/site/${slug}${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(rewriteUrl);
  }

  // ── Redirection legacy /site/slug → slug.hellobat.app (prod uniquement) ──
  if (pathname.startsWith('/site/') && hostname === BASE_DOMAIN) {
    const slugMatch = pathname.match(/^\/site\/([^/]+)(\/.*)?$/);
    if (slugMatch) {
      const [, slug, rest = ''] = slugMatch;
      return NextResponse.redirect(
        new URL(`https://${slug}.${BASE_DOMAIN}${rest}`),
        301,
      );
    }
  }

  // Legacy: ancienne page "Paiement Stripe" → désormais dans Paramètres > Finance
  if (pathname === '/paiements') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/parametres';
    redirectUrl.searchParams.set('tab', 'finance');
    return NextResponse.redirect(redirectUrl);
  }

  if (publicPaths.includes(pathname) || publicPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)','/', '/(api|trpc)(.*)'],
};
