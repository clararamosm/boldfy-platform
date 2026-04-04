// src/app/actions/linkedin.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateAuthUrl, publishLinkedInPost, refreshAccessToken, buildConnectionData, isTokenExpired, fetchPostMetricsBatch, type LinkedInConnection, type LinkedInPostMetrics } from '@/lib/linkedin';
import { requireSelf } from '@/lib/auth-guard';
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
 */
export async function publishToLinkedIn(
  idToken: string,
  userId: string,
  content: string,
  mediaUrl?: string
): Promise<PublishResult> {
  try {
    await requireSelf(idToken, userId);

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

    // 3. Publish the post (with optional image)
    const result = await publishLinkedInPost(accessToken, connection.linkedinId, content.trim(), mediaUrl);

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

// ─── LinkedIn Post Metrics ──────────────────────────────────────

export type PostWithMetrics = {
  id: string;
  caption: string;
  mediaUrl?: string;
  linkedinPostId: string;
  linkedinPostUrl?: string;
  publishedAt: string;
  metrics: {
    totalReactions: number;
    comments: number;
    reactions: LinkedInPostMetrics['reactions'];
  };
};

export type DashboardMetrics = {
  posts: PostWithMetrics[];
  totals: {
    totalPosts: number;
    totalReactions: number;
    totalComments: number;
    avgReactionsPerPost: number;
    avgCommentsPerPost: number;
  };
  error?: string;
};

/**
 * Fetch LinkedIn metrics for all published posts of a user.
 * Reads posts from Firestore (scheduledPosts with status=published),
 * then batch-fetches engagement from LinkedIn socialMetadata API.
 */
export async function getLinkedInDashboardMetrics(idToken: string, userId: string): Promise<DashboardMetrics> {
  const empty: DashboardMetrics = {
    posts: [],
    totals: { totalPosts: 0, totalReactions: 0, totalComments: 0, avgReactionsPerPost: 0, avgCommentsPerPost: 0 },
  };

  try {
    await requireSelf(idToken, userId);

    // 1. Get user's LinkedIn connection
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return { ...empty, error: 'Usuario nao encontrado.' };

    const userData = userDoc.data();
    const connection = userData?.linkedinConnection as LinkedInConnection | undefined;

    if (!connection) {
      return { ...empty, error: 'LinkedIn nao conectado.' };
    }

    // 2. Check token validity
    let accessToken = connection.accessToken;
    if (isTokenExpired(connection.tokenExpiresAt)) {
      if (connection.refreshToken && connection.refreshTokenExpiresAt && !isTokenExpired(connection.refreshTokenExpiresAt)) {
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
          const userRef = adminDb.collection('users').doc(userId);
          await userRef.update({ linkedinConnection: updatedConnection });
          accessToken = newTokens.access_token;
        } catch {
          return { ...empty, error: 'Token expirado. Reconecte sua conta do LinkedIn.' };
        }
      } else {
        return { ...empty, error: 'Token expirado. Reconecte sua conta do LinkedIn.' };
      }
    }

    // 3. Get all published posts from Firestore
    const postsSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('scheduledPosts')
      .where('status', '==', 'published')
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();

    if (postsSnap.empty) {
      return { ...empty };
    }

    // 4. Collect posts that have linkedinPostId
    const postsWithIds: { doc: FirebaseFirestore.QueryDocumentSnapshot; linkedinPostId: string }[] = [];
    for (const d of postsSnap.docs) {
      const data = d.data();
      if (data.linkedinPostId) {
        postsWithIds.push({ doc: d, linkedinPostId: data.linkedinPostId });
      }
    }

    if (postsWithIds.length === 0) {
      // Posts exist but none have linkedinPostId — return post data without API metrics
      const posts: PostWithMetrics[] = postsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          caption: data.caption || '',
          mediaUrl: data.mediaUrl,
          linkedinPostId: '',
          linkedinPostUrl: data.linkedinPostUrl || '',
          publishedAt: data.updatedAt || data.createdAt || '',
          metrics: { totalReactions: 0, comments: 0, reactions: {} },
        };
      });
      return {
        posts,
        totals: { totalPosts: posts.length, totalReactions: 0, totalComments: 0, avgReactionsPerPost: 0, avgCommentsPerPost: 0 },
      };
    }

    // 5. Batch fetch metrics from LinkedIn
    const linkedinIds = postsWithIds.map(p => p.linkedinPostId);
    let metricsMap: Record<string, LinkedInPostMetrics> = {};

    try {
      const metrics = await fetchPostMetricsBatch(accessToken, linkedinIds);
      for (const m of metrics) {
        metricsMap[m.postId] = m;
      }
    } catch (err) {
      console.error('Error fetching LinkedIn metrics batch:', err);
      // Continue without metrics — show zeros
    }

    // 6. Build response
    let totalReactions = 0;
    let totalComments = 0;

    const posts: PostWithMetrics[] = postsSnap.docs.map(d => {
      const data = d.data();
      const liId = data.linkedinPostId || '';
      const m = metricsMap[liId];

      const reactions = m?.totalReactions || 0;
      const comments = m?.comments || 0;
      totalReactions += reactions;
      totalComments += comments;

      return {
        id: d.id,
        caption: data.caption || '',
        mediaUrl: data.mediaUrl,
        linkedinPostId: liId,
        linkedinPostUrl: data.linkedinPostUrl || '',
        publishedAt: data.updatedAt || data.createdAt || '',
        metrics: {
          totalReactions: reactions,
          comments,
          reactions: m?.reactions || {},
        },
      };
    });

    const totalPosts = posts.length;

    return {
      posts,
      totals: {
        totalPosts,
        totalReactions,
        totalComments,
        avgReactionsPerPost: totalPosts > 0 ? Math.round((totalReactions / totalPosts) * 10) / 10 : 0,
        avgCommentsPerPost: totalPosts > 0 ? Math.round((totalComments / totalPosts) * 10) / 10 : 0,
      },
    };
  } catch (error) {
    console.error('Error fetching LinkedIn dashboard metrics:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { ...empty, error: `Erro ao buscar metricas: ${message}` };
  }
}
