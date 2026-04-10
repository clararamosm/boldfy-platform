// src/middleware.ts
// Server-side route protection using session cookie.
// The cookie is set by AuthProvider (auth-context.tsx) and contains the user role.
// This prevents the "flash of content" on protected routes before client-side auth kicks in.
// Full token verification still happens in layouts and server actions — this is a fast first gate.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_PREFIXES = ['/admin', '/colaborador', '/master'];

// Role-to-route mapping
const ROLE_ROUTES: Record<string, string> = {
  master: '/master',
  admin: '/admin',
  colaborador: '/colaborador',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only check protected routes
  const isProtected = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  // Check session cookie
  const session = request.cookies.get('boldfy-session')?.value;

  if (!session) {
    // No session → redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Check role matches route
  const role = session; // Cookie value = role (master | admin | colaborador)

  // Master can access /admin routes (with ?companyId=)
  if (pathname.startsWith('/admin') && (role === 'admin' || role === 'master')) {
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
  matcher: ['/admin/:path*', '/colaborador/:path*', '/master/:path*'],
};
