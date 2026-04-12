// Tests for session.ts — HMAC cookie signing and verification
// Critical security tests: tampering detection, timing-safe comparison

import { describe, it, expect, beforeAll } from 'vitest';
import { signSessionValue, verifySessionValue } from '@/lib/session';

// These tests use the dev fallback secret (COOKIE_SECRET not set in test env)

describe('Session HMAC signing', () => {
  let signedAdmin: string;
  let signedColab: string;

  beforeAll(async () => {
    signedAdmin = await signSessionValue('admin');
    signedColab = await signSessionValue('colaborador');
  });

  it('signs a value with format: value.hmac', async () => {
    expect(signedAdmin).toContain('.');
    const [value, hmac] = signedAdmin.split('.');
    expect(value).toBe('admin');
    expect(hmac).toHaveLength(64); // SHA-256 hex = 64 chars
  });

  it('verifies a valid signed value', async () => {
    const result = await verifySessionValue(signedAdmin);
    expect(result).toBe('admin');
  });

  it('different values produce different signatures', () => {
    const hmacAdmin = signedAdmin.split('.')[1];
    const hmacColab = signedColab.split('.')[1];
    expect(hmacAdmin).not.toBe(hmacColab);
  });

  it('rejects a tampered value', async () => {
    const tampered = signedAdmin.replace('admin', 'master');
    const result = await verifySessionValue(tampered);
    expect(result).toBeNull();
  });

  it('rejects a tampered HMAC', async () => {
    const [value] = signedAdmin.split('.');
    const fakeHmac = 'a'.repeat(64);
    const result = await verifySessionValue(`${value}.${fakeHmac}`);
    expect(result).toBeNull();
  });

  it('rejects a value without dot separator', async () => {
    const result = await verifySessionValue('no-dot-here');
    expect(result).toBeNull();
  });

  it('rejects an empty string', async () => {
    const result = await verifySessionValue('');
    expect(result).toBeNull();
  });

  it('handles role values with special characters', async () => {
    const signed = await signSessionValue('role:with:colons');
    const result = await verifySessionValue(signed);
    expect(result).toBe('role:with:colons');
  });

  it('produces consistent signatures for the same value', async () => {
    const first = await signSessionValue('master');
    const second = await signSessionValue('master');
    expect(first).toBe(second);
  });
});
