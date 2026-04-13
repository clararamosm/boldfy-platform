// src/app/api/auth/linkedin/callback/route.ts
export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import {
  exchangeCodeForTokens,
  fetchLinkedInProfile,
  buildConnectionData,
} from '@/lib/linkedin';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br';

  // Helper: build the redirect URL based on user role
  function getRedirectBase(role?: string): string {
    switch (role) {
      case 'thoughtleader':
        return `${baseUrl}/thoughtleader/configuracoes`;
      case 'colaborador':
      default:
        return `${baseUrl}/colaborador/configuracoes`;
    }
  }

  // Handle LinkedIn error response (user denied access, etc.)
  if (error) {
    console.error('LinkedIn OAuth error:', error, errorDescription);
    // Without state we can't determine role — fallback to colaborador
    const redirectUrl = new URL(getRedirectBase());
    redirectUrl.searchParams.set('linkedin', 'error');
    redirectUrl.searchParams.set(
      'message',
      errorDescription || 'Acesso negado pelo LinkedIn.'
    );
    return NextResponse.redirect(redirectUrl.toString());
  }

  // Validate required params
  if (!code || !state) {
    const redirectUrl = new URL(getRedirectBase());
    redirectUrl.searchParams.set('linkedin', 'error');
    redirectUrl.searchParams.set('message', 'Parâmetros inválidos na resposta do LinkedIn.');
    return NextResponse.redirect(redirectUrl.toString());
  }

  try {
    // 1. Decode and validate state parameter
    let stateData: { userId: string; nonce: string };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch {
      throw new Error('State parameter inválido.');
    }

    const { userId, nonce } = stateData;

    if (!userId || !nonce) {
      throw new Error('State parameter incompleto.');
    }

    // 2. Validate state against stored nonce in Firestore
    const stateDoc = await adminDb.collection('linkedin_oauth_states').doc(nonce).get();

    if (!stateDoc.exists) {
      throw new Error('Estado OAuth não encontrado. Tente novamente.');
    }

    const stateRecord = stateDoc.data()!;

    // Check expiration (10 min)
    if (Date.now() > stateRecord.expiresAt) {
      await adminDb.collection('linkedin_oauth_states').doc(nonce).delete();
      throw new Error('Sessão OAuth expirada. Tente novamente.');
    }

    // Validate userId matches
    if (stateRecord.userId !== userId) {
      throw new Error('Estado OAuth inválido.');
    }

    // Clean up the state document
    await adminDb.collection('linkedin_oauth_states').doc(nonce).delete();

    // 3. Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // 4. Fetch LinkedIn profile
    const profile = await fetchLinkedInProfile(tokens.access_token);

    // 5. Build connection data and save to Firestore
    const connectionData = buildConnectionData(tokens, profile);

    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new Error('Usuário não encontrado no sistema.');
    }

    // Save LinkedIn connection + sync profile photo from LinkedIn
    const updateData: Record<string, unknown> = {
      linkedinConnection: connectionData,
    };

    // Use LinkedIn photo as the collaborator's profile photo
    if (profile.picture) {
      updateData.photoURL = profile.picture;
      // Also update profile.avatarUrl for rankings / admin views
      const existingData = userDoc.data()!;
      const existingProfile = existingData.profile || {};
      updateData.profile = {
        ...existingProfile,
        avatarUrl: profile.picture,
      };
    }

    await userRef.update(updateData);

    // 6. Redirect back based on user role
    const userRole = userDoc.data()?.role as string | undefined;
    const redirectUrl = new URL(getRedirectBase(userRole));
    redirectUrl.searchParams.set('linkedin', 'success');
    return NextResponse.redirect(redirectUrl.toString());
  } catch (err) {
    console.error('LinkedIn OAuth callback error:', err);
    const message = err instanceof Error ? err.message : 'Erro ao conectar LinkedIn.';
    const redirectUrl = new URL(getRedirectBase());
    redirectUrl.searchParams.set('linkedin', 'error');
    redirectUrl.searchParams.set('message', message);
    return NextResponse.redirect(redirectUrl.toString());
  }
}
