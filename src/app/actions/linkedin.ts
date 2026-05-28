// src/app/actions/linkedin.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateAuthUrl, publishLinkedInPost, refreshAccessToken, buildConnectionData, isTokenExpired, type LinkedInConnection } from '@/lib/linkedin';
import { requireSelf, requireAdmin } from '@/lib/auth-guard';
import { requireActiveModuleByRole } from '@/lib/billing/module-gate';
import { awardPublicationPoints } from '@/app/actions/gamification';
import crypto from 'crypto';

type LinkedInAuthResult = {
  url?: string;
  error?: string;
};

/**
 * Generate LinkedIn OAuth authorization URL.
 * The state parameter encodes the userId for validation in the callback.
 */
export async function getLinkedInAuthUrl(idToken: string, userId: string): Promise<LinkedInAuthResult> {
  try {
    await requireSelf(idToken, userId);

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
export async function disconnectLinkedIn(idToken: string, userId: string): Promise<DisconnectResult> {
  try {
    await requireSelf(idToken, userId);

    const userRef = adminDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return { error: 'Usuário não encontrado.' };
    }

    // Remove LinkedIn connection data using FieldValue.delete()
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
  linkedinPostId?: string;
  error?: string;
  needsReconnect?: boolean;
};

/**
 * Get the current LinkedIn connection status for a user.
 */
export async function getLinkedInStatus(idToken: string, userId: string): Promise<{
  connected: boolean;
  name?: string;
  picture?: string;
  headline?: string;
  tokenValid?: boolean;
}> {
  try {
    await requireSelf(idToken, userId);

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return { connected: false };

    const data = userDoc.data();
    const connection = data?.linkedinConnection as LinkedInConnection | undefined;

    if (!connection) return { connected: false };

    return {
      connected: true,
      name: connection.name,
      picture: data?.photoURL || connection.picture,
      headline: data?.position || data?.profile?.position || undefined,
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
 * Optionally includes an image (Firebase Storage URL).
 * If postId is provided, updates that post's status to 'published' in Firestore.
 */
export async function publishToLinkedIn(
  idToken: string,
  userId: string,
  content: string,
  mediaUrl?: string,
  postId?: string,
  mediaType?: string,
  // Multi-image (rodada 6): quando ha 2+ imagens, mediaUrl/mediaType ficam
  // vazios e mediaUrls/mediaTypes carregam o array. Pra retrocompat com
  // chamadas single, ambas as formas sao aceitas.
  mediaUrls?: string[],
  mediaTypes?: string[],
  // Título customizado pro carrossel/PDF. Ignorado quando a mídia não é PDF.
  documentTitle?: string,
): Promise<PublishResult> {
  try {
    const user = await requireSelf(idToken, userId);
    await requireActiveModuleByRole(user);

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

    // 3. Publish the post — normaliza single/multi pra arrays paralelos.
    const urls: string[] = mediaUrls && mediaUrls.length > 0
      ? mediaUrls
      : mediaUrl ? [mediaUrl] : [];
    const types: string[] = mediaTypes && mediaTypes.length > 0
      ? mediaTypes
      : mediaType ? [mediaType] : [];
    const result = await publishLinkedInPost(accessToken, connection.linkedinId, content.trim(), urls, types, documentTitle);

    // Defesa em profundidade: publishLinkedInPost já lança LINKEDIN_NO_POST_ID
    // quando o postId vem vazio, mas se por algum motivo passar reto, evitamos
    // gravar URL quebrada (`/feed/update//`) marcando como falha aqui também.
    if (!result.postId) {
      throw new Error('LINKEDIN_NO_POST_ID');
    }

    // 4. Update the post document in Firestore with published status
    const now = new Date().toISOString();
    if (postId) {
      await adminDb
        .collection('users')
        .doc(userId)
        .collection('scheduledPosts')
        .doc(postId)
        .update({
          status: 'published',
          linkedinPostId: result.postId,
          linkedinPostUrl: result.postUrl,
          publishedAt: now,
          // Limpa qualquer error de tentativas anteriores que falharam.
          error: FieldValue.delete(),
          updatedAt: now,
        });

      // Award gamification points for collaborator publication (fire-and-forget)
      awardPublicationPoints(userId, postId)
        .catch(err => console.error(`[Gamification] Failed to award points:`, err));
    }

    return {
      success: true,
      postUrl: result.postUrl,
      linkedinPostId: result.postId,
    };
  } catch (error) {
    console.error('Error publishing to LinkedIn:', error);

    // Mensagens internas (tokens) viram texto amigável.
    let userMessage: string;
    let needsReconnect = false;
    if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
      userMessage = 'Token do LinkedIn expirado. Reconecte sua conta nas Configurações.';
      needsReconnect = true;
    } else if (error instanceof Error && error.message === 'LINKEDIN_NO_POST_ID') {
      // Caso "falso sucesso": LinkedIn respondeu 2xx mas sem x-restli-id.
      // Antes desta correção isso virava status:'published' com URL quebrada.
      userMessage = 'O LinkedIn aceitou a requisição mas não confirmou a publicação. Por favor, reagende para tentar novamente.';
    } else {
      const message = error instanceof Error ? error.message : 'Erro desconhecido.';
      userMessage = `Erro ao publicar: ${message}`;
    }

    // Marca o doc como `failed` com o motivo — assim o user vê no card do
    // calendário e no banner do editor mesmo se fechar o toast e voltar
    // depois. Antes, em erro o doc ficava como `scheduled` (esperando o
    // cron pegar de novo), o que silenciava a falha pro user.
    if (postId) {
      try {
        await adminDb
          .collection('users')
          .doc(userId)
          .collection('scheduledPosts')
          .doc(postId)
          .update({
            status: 'failed',
            error: userMessage,
            updatedAt: new Date().toISOString(),
          });
      } catch (updateErr) {
        console.error('Error marking post as failed after publish error:', updateErr);
      }
    }

    return { error: userMessage, needsReconnect };
  }
}
