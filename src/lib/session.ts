// src/lib/session.ts
// Shared session cookie signing/verification logic.
// Uses Web Crypto API (compatible with both Edge Runtime and Node.js).
// Used by both the API route (to sign) and middleware (to verify).

// Lazy secret — validated at first use, not at import/build time.
// Throws in production if not set; warns in dev.
let _cachedSecret: string | null = null;

function getCookieSecret(): string {
  if (_cachedSecret) return _cachedSecret;

  const secret = process.env.COOKIE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'COOKIE_SECRET env var is required in production. Generate with: openssl rand -hex 32'
      );
    }
    // Dev-only fallback — safe because only used locally
    _cachedSecret = 'dev-only-insecure-fallback-do-not-use-in-prod';
    return _cachedSecret;
  }

  _cachedSecret = secret;
  return _cachedSecret;
}

async function hmacHex(value: string): Promise<string> {
  const cookieSecret = getCookieSecret();
  const encoder = new TextEncoder();
  const keyData = encoder.encode(cookieSecret);
  const messageData = encoder.encode(value);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function signSessionValue(value: string): Promise<string> {
  const hmac = await hmacHex(value);
  return `${value}.${hmac}`;
}

export async function verifySessionValue(signed: string): Promise<string | null> {
  const dotIndex = signed.lastIndexOf('.');
  if (dotIndex === -1) return null;

  const value = signed.substring(0, dotIndex);
  const providedHmac = signed.substring(dotIndex + 1);

  const expectedHmac = await hmacHex(value);

  return timingSafeEqual(providedHmac, expectedHmac) ? value : null;
}
