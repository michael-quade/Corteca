import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the gate login page and its API endpoint
  if (pathname.startsWith('/gate') || pathname.startsWith('/api/gate')) {
    return NextResponse.next();
  }

  // If gate credentials are not configured (local dev), skip the check
  const siteUser = process.env.SITE_USERNAME;
  const sitePass = process.env.SITE_PASSWORD;
  if (!siteUser || !sitePass) return NextResponse.next();

  const expected = btoa(`${siteUser}:${sitePass}`);
  const cookie   = req.cookies.get('site_auth')?.value;

  if (cookie !== expected) {
    return NextResponse.redirect(new URL('/gate', req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Static images in public/ skip the gate: the image optimizer (_next/image) fetches
  // them server-side without the visitor's cookie, so gating them broke the login
  // page's background (400 "isn't a valid image").
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|avif|ico)$).*)'],
};
