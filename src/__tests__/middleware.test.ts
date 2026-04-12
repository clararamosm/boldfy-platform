// Tests for middleware.ts — route protection and role-based access
// Validates that every role can only access their designated routes.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the session module
const mockVerify = vi.fn();
vi.mock('@/lib/session', () => ({
  verifySessionValue: (...args: unknown[]) => mockVerify(...args),
}));

// Mock Next.js server modules
const mockRedirect = vi.fn();
const mockNext = vi.fn();
const mockSetCookie = vi.fn();

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (...args: unknown[]) => {
      mockRedirect(...args);
      return { cookies: { set: mockSetCookie } };
    },
    next: () => {
      mockNext();
      return { type: 'next' };
    },
  },
}));

import { middleware } from '@/middleware';

// ─── Helpers ──────────────────────────────────────────────────

function createRequest(pathname: string, sessionCookie?: string) {
  return {
    nextUrl: { pathname },
    url: 'https://app.boldfy.com.br' + pathname,
    cookies: {
      get: (name: string) =>
        name === 'boldfy-session' && sessionCookie
          ? { value: sessionCookie }
          : undefined,
    },
  } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// ─── Tests ────────────────────────────────────────────────────

describe('Middleware route protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows public routes without auth', async () => {
    await middleware(createRequest('/login'));
    expect(mockNext).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('allows public routes like /beta-test', async () => {
    await middleware(createRequest('/beta-test'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('redirects to login when no session cookie on protected route', async () => {
    await middleware(createRequest('/admin/dashboard'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('clears cookie and redirects on tampered session', async () => {
    mockVerify.mockResolvedValue(null);
    await middleware(createRequest('/admin/dashboard', 'tampered.cookie'));
    expect(mockRedirect).toHaveBeenCalled();
    expect(mockSetCookie).toHaveBeenCalledWith('boldfy-session', '', { path: '/', maxAge: 0 });
  });

  // ─── Role-based route access ─────────────────────────────

  it('allows admin to access /admin routes', async () => {
    mockVerify.mockResolvedValue('admin');
    await middleware(createRequest('/admin/dashboard', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows master to access /master routes', async () => {
    mockVerify.mockResolvedValue('master');
    await middleware(createRequest('/master/dashboard', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows master to access /admin routes', async () => {
    mockVerify.mockResolvedValue('master');
    await middleware(createRequest('/admin/dashboard', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows strategist to access /strategist routes', async () => {
    mockVerify.mockResolvedValue('strategist');
    await middleware(createRequest('/strategist/dashboard', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows strategist to access /admin routes', async () => {
    mockVerify.mockResolvedValue('strategist');
    await middleware(createRequest('/admin/dashboard', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows strategist to access /thoughtleader routes', async () => {
    mockVerify.mockResolvedValue('strategist');
    await middleware(createRequest('/thoughtleader/dashboard', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows colaborador to access /colaborador routes', async () => {
    mockVerify.mockResolvedValue('colaborador');
    await middleware(createRequest('/colaborador/dashboard', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows thoughtleader to access /thoughtleader routes', async () => {
    mockVerify.mockResolvedValue('thoughtleader');
    await middleware(createRequest('/thoughtleader/dashboard', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  // ─── Cross-role blocking ─────────────────────────────────

  it('blocks colaborador from /admin routes', async () => {
    mockVerify.mockResolvedValue('colaborador');
    await middleware(createRequest('/admin/dashboard', 'valid.session'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('blocks colaborador from /master routes', async () => {
    mockVerify.mockResolvedValue('colaborador');
    await middleware(createRequest('/master/dashboard', 'valid.session'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('blocks admin from /master routes', async () => {
    mockVerify.mockResolvedValue('admin');
    await middleware(createRequest('/master/dashboard', 'valid.session'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  it('blocks thoughtleader from /admin routes', async () => {
    mockVerify.mockResolvedValue('thoughtleader');
    await middleware(createRequest('/admin/dashboard', 'valid.session'));
    expect(mockRedirect).toHaveBeenCalled();
  });

  // ─── /post route — multi-role access ─────────────────────

  it('allows strategist to access /post routes', async () => {
    mockVerify.mockResolvedValue('strategist');
    await middleware(createRequest('/post/company/tl/post-id', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows thoughtleader to access /post routes', async () => {
    mockVerify.mockResolvedValue('thoughtleader');
    await middleware(createRequest('/post/company/tl/post-id', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows master to access /post routes', async () => {
    mockVerify.mockResolvedValue('master');
    await middleware(createRequest('/post/company/tl/post-id', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });

  it('allows colaborador to access /post routes', async () => {
    mockVerify.mockResolvedValue('colaborador');
    await middleware(createRequest('/post/company/tl/post-id', 'valid.session'));
    expect(mockNext).toHaveBeenCalled();
  });
});
