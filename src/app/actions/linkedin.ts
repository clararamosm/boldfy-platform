// src/app/actions/linkedin.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateAuthUrl, publishLinkedInPost, refreshAccessToken, buildConnectionData, isTokenExpired, fetchPostMetricsBatch, type LinkedInConnection, type LinkedInPostMetrics } from '@/lib/linkedin';
import { requireSelf, requireStrategistForTL, requireAdmin, requireAuth } from '@/lib/auth-guard';
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
  mediaType?: string
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

    // 3. Publish the post (with optional image/video)
    const result = await publishLinkedInPost(accessToken, connection.linkedinId, content.trim(), mediaUrl, mediaType);

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
          updatedAt: now,
        });
    }

    return {
      success: true,
      postUrl: result.postUrl,
      linkedinPostId: result.postId,
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
 *
 * @param dateRange - Optional date range filter { start: ISO, end: ISO }
 * @param callerRole - When 'strategist', uses requireStrategistForTL; when 'admin', uses requireAdmin; otherwise requireSelf
 */
export async function getLinkedInDashboardMetrics(
  idToken: string,
  userId: string,
  dateRange?: { start: string; end: string },
  callerRole?: 'self' | 'strategist' | 'admin',
): Promise<DashboardMetrics> {
  const empty: DashboardMetrics = {
    posts: [],
    totals: { totalPosts: 0, totalReactions: 0, totalComments: 0, avgReactionsPerPost: 0, avgCommentsPerPost: 0 },
  };

  try {
    // Auth: strategist can view TL metrics, admin can view any user, otherwise self-only
    if (callerRole === 'strategist') {
      await requireStrategistForTL(idToken, userId);
    } else if (callerRole === 'admin') {
      await requireAdmin(idToken);
    } else {
      await requireSelf(idToken, userId);
    }

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

    // 3. Get all published posts from both collections:
    //    - scheduledPosts (colaboradores): status === 'published'
    //    - contentPipeline (TLs):         status === 'postado'
    const [scheduledSnap, pipelineSnap] = await Promise.all([
      adminDb
        .collection('users')
        .doc(userId)
        .collection('scheduledPosts')
        .where('status', '==', 'published')
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get(),
      adminDb
        .collection('users')
        .doc(userId)
        .collection('contentPipeline')
        .where('status', '==', 'postado')
        .orderBy('updatedAt', 'desc')
        .limit(50)
        .get(),
    ]);

    // Merge both collections' docs, sort by updatedAt desc, and take top 50
    const allDocs = [...scheduledSnap.docs, ...pipelineSnap.docs]
      .sort((a, b) => {
        const aDate = a.data().updatedAt || a.data().createdAt || '';
        const bDate = b.data().updatedAt || b.data().createdAt || '';
        return String(bDate).localeCompare(String(aDate));
      })
      .slice(0, 50);

    // Apply client-side date filtering (Firestore can't filter on two fields efficiently)
    let filteredDocs = allDocs;
    if (dateRange) {
      const rangeStart = new Date(dateRange.start).getTime();
      const rangeEnd = new Date(dateRange.end).getTime();
      filteredDocs = filteredDocs.filter((d) => {
        const data = d.data();
        const publishedAt = data.updatedAt || data.createdAt || '';
        const ts = typeof publishedAt === 'string'
          ? new Date(publishedAt).getTime()
          : publishedAt?.toDate?.() ? publishedAt.toDate().getTime() : 0;
        return ts >= rangeStart && ts <= rangeEnd;
      });
    }

    if (filteredDocs.length === 0) {
      return { ...empty };
    }

    // 4. Collect posts that have linkedinPostId
    const postsWithIds: { doc: FirebaseFirestore.QueryDocumentSnapshot; linkedinPostId: string }[] = [];
    for (const d of filteredDocs) {
      const data = d.data();
      if (data.linkedinPostId) {
        postsWithIds.push({ doc: d, linkedinPostId: data.linkedinPostId });
      }
    }

    if (postsWithIds.length === 0) {
      // Posts exist but none have linkedinPostId — return post data without API metrics
      const posts: PostWithMetrics[] = filteredDocs.map(d => {
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

    const posts: PostWithMetrics[] = filteredDocs.map(d => {
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

// ─── Company LinkedIn Profiles ──────────────────────────────────

export type CompanyLinkedInProfile = {
  id: string;
  name: string;
  role: string;
  hasLinkedin: boolean;
};

/**
 * Get all users (colaboradores + thought leaders) from a company
 * that have LinkedIn connected. Used by admin dashboard to populate
 * the profile filter for LinkedIn Performance.
 */
export async function getCompanyLinkedInProfiles(
  idToken: string,
  companyId: string,
): Promise<{ profiles: CompanyLinkedInProfile[]; error?: string }> {
  try {
    await requireAdmin(idToken, companyId);

    const usersSnap = await adminDb
      .collection('users')
      .where('companyId', '==', companyId)
      .where('status', '==', 'Ativo')
      .get();

    const profiles: CompanyLinkedInProfile[] = [];
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      const role = data.role as string;
      // Only include colaboradores and thought leaders
      if (role !== 'colaborador' && role !== 'thoughtleader') continue;

      const connection = data.linkedinConnection as LinkedInConnection | undefined;
      profiles.push({
        id: doc.id,
        name: data.name || data.email || doc.id,
        role,
        hasLinkedin: !!connection,
      });
    }

    // Sort: LinkedIn connected first, then by name
    profiles.sort((a, b) => {
      if (a.hasLinkedin !== b.hasLinkedin) return a.hasLinkedin ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return { profiles };
  } catch (error) {
    console.error('Error fetching company LinkedIn profiles:', error);
    return { profiles: [], error: 'Erro ao buscar perfis.' };
  }
}
