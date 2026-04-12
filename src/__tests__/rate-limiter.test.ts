// Tests for the rate limiter used in beta-leads.ts
// Extracts and tests the rate limiting logic independently

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Replicate the rate limiter logic for isolated testing ────

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

let rateLimitMap: Map<string, { count: number; resetAt: number }>;

function checkRateLimit(key: string, now: number = Date.now()): boolean {
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Tests ────────────────────────────────────────────────────

describe('Rate Limiter', () => {
  beforeEach(() => {
    rateLimitMap = new Map();
  });

  it('allows first request', () => {
    expect(checkRateLimit('user@test.com')).toBe(true);
  });

  it('allows up to RATE_LIMIT_MAX requests', () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit('user@test.com', now)).toBe(true);
    }
  });

  it('blocks request at RATE_LIMIT_MAX + 1', () => {
    const now = Date.now();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('user@test.com', now);
    }
    expect(checkRateLimit('user@test.com', now)).toBe(false);
  });

  it('isolates rate limits per key', () => {
    const now = Date.now();
    // Max out first user
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('user1@test.com', now);
    }
    expect(checkRateLimit('user1@test.com', now)).toBe(false);
    // Second user should still be allowed
    expect(checkRateLimit('user2@test.com', now)).toBe(true);
  });

  it('resets after window expires', () => {
    const now = Date.now();
    // Max out
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      checkRateLimit('user@test.com', now);
    }
    expect(checkRateLimit('user@test.com', now)).toBe(false);

    // Fast-forward past the window
    const afterWindow = now + RATE_LIMIT_WINDOW_MS + 1;
    expect(checkRateLimit('user@test.com', afterWindow)).toBe(true);
  });

  it('creates a new entry with count=1 on first call', () => {
    const now = Date.now();
    checkRateLimit('new@test.com', now);
    const entry = rateLimitMap.get('new@test.com');
    expect(entry).toBeDefined();
    expect(entry!.count).toBe(1);
    expect(entry!.resetAt).toBe(now + RATE_LIMIT_WINDOW_MS);
  });

  it('increments count on subsequent calls', () => {
    const now = Date.now();
    checkRateLimit('user@test.com', now);
    checkRateLimit('user@test.com', now);
    checkRateLimit('user@test.com', now);
    const entry = rateLimitMap.get('user@test.com');
    expect(entry!.count).toBe(3);
  });

  it('is case-sensitive for keys', () => {
    const now = Date.now();
    checkRateLimit('User@Test.com', now);
    checkRateLimit('user@test.com', now);
    expect(rateLimitMap.size).toBe(2);
  });
});
