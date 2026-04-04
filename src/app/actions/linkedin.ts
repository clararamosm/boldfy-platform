// src/app/actions/linkedin.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { generateAuthUrl, publishLinkedInPost, refreshAccessToken, buildConnectionData, isTokenExpired, type LinkedInConnection } from '@/lib/linkedin';
import crypto from 'crypto';

type LinkedInAuthResult = {
  url?: string;
  error?: string;
};

/**
 * Generate LinkedIn OAuth authorization URL.
 * The state parameter encodes the userId for validation in the callback.
 */
export async function getLinkedInAuthUrl(userId: string): Promise<LinkedInAuthResult> {
  try {
    if (!userId) {
      return { error: 'Usuário não identificado.' };
    }

    // Generate a secure random state that includes the userId
    const nonce = crypto.randomBytes(16).toString('hex');
    const state = Buffer.from(JSON.stringify({ userId, nonce })).toString('base64url');

    // Store the state in Firestore for validation in the callback
    await adminDb.collection('linkedin_oauth_states').doc(nonce).set({
      userId,
      state,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    const url = generateAuthUrl(state);
    return { url };
  } catch (error) {
    console.error('Error generating LinkedIn auth URL:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { error: `Erro ao iniciar conexão com LinkedIn: ${message}` };
  }
}

type DisconnectResult = {
  success?: boolean;
  error?: string;
};

/**
 * Disconnect LinkedIn account from user profile.
 * Removes stored tokens and connection data from Firestore.
 */
export async function disconnectLinkedIn(userId: string): Promise<DisconnectResult> {
  try {
    if (!userId) {
      return { error: 'Usuário não identificado.' };
    }

    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { error: 'Usuário não encontrado.' };
    }

    // Remove LinkedIn connection data using FieldValue.delete()
    const { FieldValue } = await import('firebase-admin/firestore');
    await userRef.update({
      linkedinConnection: FieldValue.delete(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error disconnecting LinkedIn:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { error: `Erro ao desconectar LinkedIn: ${message}` };
  }
}

// ─── Publish to LinkedIn ─────────────────────────────────────────

type PublishResult = {
  success?: boolean;
  postUrl?: string;
  error?: string;
  needsReconnect?: boolean;
};

/**
 * Get the current LinkedIn connection status for a user.
 */
export async function getLinkedInStatus(userId: string): Promise<{
  connected: boolean;
  name?: string;
  picture?: string;
  tokenValid?: boolean;
}> {
  try {
    if (!userId) return { connected: false };

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return { connected: false };

    const data = userDoc.data();
    const connection = data?.linkedinConnection as LinkedInConnection | undefined;

    if (!connection) return { connected: false };

    return {
      connected: true,
      name: connection.name,
      picture: connection.picture,
      tokenValid: !isTokenExpired(connection.tokenExpiresAt),
    };
  } catch (error) {
    console.error('Error checking LinkedIn status:', error);
    return { connected: false };
  }
}

/**
 * Publish content to LinkedIn on behalf of the user.
 * Handles token refresh automatically if needed.
 */
export async function publishToLinkedIn(
  userId: string,
  content: string
): Promise<PublishResult> {
  try {
    if (!userId) {
      return { error: 'Usuário não identificado.' };
    }

    if (!content || content.trim().length === 0) {
      return { error: 'Conteúdo vazio. Escreva algo antes de publicar.' };
    }

    // 1. Get user's LinkedIn connection
    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { error: 'Usuário não encontrado.' };
    }

    const userData = userDoc.data();
    const connection = userData?.linkedinConnection as LinkedInConnection | undefined;

    if (!connection) {
      return {
        error: 'LinkedIn não conectado. Conecte sua conta nas Configurações.',
        needsReconnect: true,
      };
    }

    // 2. Check if token is expired, try refresh
    let accessToken = connection.accessToken;

    if (isTokenExpired(connection.tokenExpiresAt)) {
      if (connection.refreshToken && connection.refreshTokenExpiresAt && !isTokenExpired(connection.refreshTokenExpiresAt)) {
        // Try to refresh
        try {
          const newTokens = await refreshAccessToken(connection.refreshToken);
          const profile = {
            sub: connection.linkedinId,
            name: connection.name,
            given_name: '',
            family_name: '',
            picture: connection.picture,
            email: connection.email,
          };
          const updatedConnection = buildConnectionData(newTokens, profile);
          await userRef.update({ linkedinConnection: updatedConnection });
          accessToken = newTokens.access_token;
        } catch {
          return {
            error: 'Token expirado e não foi possível renovar. Reconecte sua conta do LinkedIn.',
            needsReconnect: true,
          };
        }
      } else {
        return {
          error: 'Token do LinkedIn expirado. Reconecte sua conta nas Configurações.',
          needsReconnect: true,
        };
      }
    }

    // 3. Publish the post
    const result = await publishLinkedInPost(accessToken, connection.linkedinId, content.trim());

    return {
      success: true,
      postUrl: result.postUrl,
    };
  } catch (error) {
    console.error('Error publishing to LinkedIn:', error);

    if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
      return {
        error: 'Token do LinkedIn expirado. Reconecte sua conta nas Configurações.',
        needsReconnect: true,
      };
    }

    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { error: `Erro ao publicar: ${message}` };
  }
}
