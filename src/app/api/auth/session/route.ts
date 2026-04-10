// POST /api/auth/session — sets a signed, HttpOnly session cookie
// DELETE /api/auth/session — clears the session cookie
//
// The cookie value is: `role.hmac` where hmac = HMAC-SHA256(role, secret)
// This prevents client-side tampering. The middleware validates the signature.
// Force Node.js runtime — firebase-admin requires Node.js APIs
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { auth as adminAuth } from '@/lib/firebase-admin';
import { db as adminDb } from '@/lib/firebase-admin';
import { signSessionValue } from '@/lib/session';

const COOKIE_NAME = 'boldfy-session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: 'Token ausente' }, { status: 400 });
    }

    // Verify Firebase token server-side
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Get role from Firestore
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const role = userDoc.data()?.role;
    if (!role) {
      return NextResponse.json({ error: 'Role não definida' }, { status: 403 });
    }

    // Create signed cookie value
    const signedValue = await signSessionValue(role);

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, signedValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
