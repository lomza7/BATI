import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/', '/login', '/signup', '/carte/publique'];
const publicPrefixes = ['/site/', '/c/', '/d/'];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.includes(pathname) || publicPrefixes.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)','/', '/(api|trpc)(.*)'],
};
