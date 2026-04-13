import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BASE_DOMAIN = 'hellobat.app';

const publicPaths = ['/', '/login', '/signup', '/carte/publique', '/mentions-legales', '/confidentialite', '/cookies', '/cgu', '/a-propos', '/contact', '/carrieres', '/presse', '/blog'];
const publicPrefixes = ['/site/', '/c/', '/d/', '/f/', '/r/', '/fonctionnalites/', '/comptable/', '/pay/'];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ── Sous-domaine artisan : slug.hellobat.app → rewrite vers /site/slug ──
  if (
    hostname !== BASE_DOMAIN &&
    hostname !== `www.${BASE_DOMAIN}` &&
    hostname.endsWith(`.${BASE_DOMAIN}`)
  ) {
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

  if (publicPaths.includes(pathname) || publicPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)','/', '/(api|trpc)(.*)'],
};
