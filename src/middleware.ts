// src/middleware.ts
// Server-side route protection using HMAC-signed session cookie.
// The cookie is set by the /api/auth/session endpoint (HttpOnly, Secure).
// The HMAC signature prevents client-side tampering.
// Full token verification still happens in layouts and server actions — this is a fast first gate.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionValue } from '@/lib/session';

// Routes that require authentication
const PROTECTED_PREFIXES = ['/admin', '/colaborador', '/master', '/thoughtleader', '/strategist'];

// Role-to-route mapping
const ROLE_ROUTES: Record<string, string> = {
  master: '/master',
  admin: '/admin',
  colaborador: '/colaborador',
  thoughtleader: '/thoughtleader',
  strategist: '/strategist',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only check protected routes
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  // Check signed session cookie
  const sessionCookie = request.cookies.get('boldfy-session')?.value;

  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Verify HMAC signature — returns the role if valid, null if tampered
  const role = await verifySessionValue(sessionCookie);

  if (!role) {
    // Invalid/tampered cookie → clear it and redirect to login
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set('boldfy-session', '', { path: '/', maxAge: 0 });
    return response;
  }

  // Master and Strategist can access /admin routes (with ?companyId=)
  if (pathname.startsWith('/admin') && (role === 'admin' || role === 'master' || role === 'strategist')) {
    return NextResponse.next();
  }

  // Strategist can access /thoughtleader routes (with ?userId= to view TL accounts)
  if (pathname.startsWith('/thoughtleader') && (role === 'thoughtleader' || role === 'strategist')) {
    return NextResponse.next();
  }

  // Check if role has access to the requested route prefix
  const allowedPrefix = ROLE_ROUTES[role];
  if (allowedPrefix && pathname.startsWith(allowedPrefix)) {
    return NextResponse.next();
  }

  // Wrong role for this route → redirect to login
  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/colaborador/:path*', '/master/:path*', '/thoughtleader/:path*', '/strategist/:path*'],
};
