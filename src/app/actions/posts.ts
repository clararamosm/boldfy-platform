// src/app/actions/posts.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSelf, requireAuth } from '@/lib/auth-guard';
import { requireActiveModuleByRole } from '@/lib/billing/module-gate';
import { fetchPostMetricsBatch, isTokenExpired, refreshAccessToken, buildConnectionData, type LinkedInConnection } from '@/lib/linkedin';

export type ScheduledPost = {
  id: string;
  userId: string;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
  scheduledFor: string; // ISO date string
  status: 'draft' | 'scheduled' | 'in_progress' | 'published' | 'failed';
  linkedinPostId?: string;
  linkedinPostUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export async function createScheduledPost(
  idToken: string,
  userId: string,
  data: {
    caption: string;
    mediaUrl?: string;
    mediaType?: string;
    scheduledFor: string;
  }
): Promise<{ success?: boolean; postId?: string; error?: string }> {
  try {
    const user = await requireSelf(idToken, userId);
    // requireActiveModuleByRole ja cobre billing.* (modular). Legacy subscription
    // foi removida do gate para evitar dupla checagem em fluxos diferentes.
    await requireActiveModuleByRole(user);
    if (!data.caption.trim()) return { error: 'A legenda não pode estar vazia.' };
    if (!data.scheduledFor) return { error: 'Data de agendamento é obrigatória.' };

    const now = new Date().toISOString();
    const postRef = await adminDb.collection('users').doc(userId).collection('scheduledPosts').add({
      userId,
      caption: data.caption,
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType || null,
      scheduledFor: data.scheduledFor,
      status: 'scheduled',
      linkedinPostId: null,
      linkedinPostUrl: null,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, postId: postRef.id };
  } catch (error) {
    console.error('Error creating scheduled post:', error);
    return { error: 'Erro ao agendar post.' };
  }
}

export async function updateScheduledPost(
  idToken: string,
  userId: string,
  postId: string,
  data: {
    caption?: string;
    mediaUrl?: string;
    mediaType?: string;
    scheduledFor?: string;
    status?: 'draft' | 'scheduled' | 'in_progress';
  }
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireSelf(idToken, userId);
    await requireActiveModuleByRole(user);
    if (!postId) return { error: 'Dados insuficientes.' };

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.caption !== undefined) updateData.caption = data.caption;
    if (data.mediaUrl !== undefined) updateData.mediaUrl = data.mediaUrl || null;
    if (data.mediaType !== undefined) updateData.mediaType = data.mediaType || null;
    if (data.scheduledFor !== undefined) updateData.scheduledFor = data.scheduledFor;
    if (data.status !== undefined) updateData.status = data.status;

    await adminDb.collection('users').doc(userId).collection('scheduledPosts').doc(postId).update(updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating scheduled post:', error);
    return { error: 'Erro ao atualizar post.' };
  }
}

export async function deleteScheduledPost(
  idToken: string,
  userId: string,
  postId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireSelf(idToken, userId);
    if (!postId) return { error: 'Dados insuficientes.' };
    await adminDb.collection('users').doc(userId).collection('scheduledPosts').doc(postId).delete();
    return { success: true };
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return { error: 'Erro ao remover post.' };
  }
}

export async function getScheduledPosts(
  idToken: string,
  userId: string
): Promise<{ posts?: ScheduledPost[]; error?: string }> {
  try {
    await requireSelf(idToken, userId);

    const snapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('scheduledPosts')
      .orderBy('scheduledFor', 'asc')
      .get();

    const posts: ScheduledPost[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as ScheduledPost));

    return { posts };
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return { error: 'Erro ao buscar posts agendados.' };
  }
}

export async function getScheduledPost(
  idToken: string,
  userId: string,
  postId: string
): Promise<{ post?: ScheduledPost; error?: string }> {
  try {
    await requireSelf(idToken, userId);
    if (!postId) return { error: 'Post ID obrigatório.' };

    const docSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('scheduledPosts')
      .doc(postId)
      .get();

    if (!docSnap.exists) return { error: 'Post não encontrado.' };

    return {
      post: {
        id: docSnap.id,
        ...docSnap.data(),
      } as ScheduledPost,
    };
  } catch (error) {
    console.error('Error fetching scheduled post:', error);
    return { error: 'Erro ao buscar post.' };
  }
}

// ─── Company Feed ────────────────────────────────────────────────

export type FeedPost = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  authorPosition?: string;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
  linkedinPostId?: string;
  linkedinPostUrl?: string;
  publishedAt: string;
};

export async function getCompanyFeed(
  idToken: string,
): Promise<{ posts?: FeedPost[]; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);
    if (!authUser.companyId) return { error: 'Empresa nao encontrada.' };
    if (authUser.role !== 'colaborador' && authUser.role !== 'admin' && authUser.role !== 'thoughtleader') {
      return { error: 'Acesso nao autorizado.' };
    }

    // 1. Get collaborators AND thought leaders in the company
    const [colabSnap, tlSnap] = await Promise.all([
      adminDb.collection('users')
        .where('companyId', '==', authUser.companyId)
        .where('role', '==', 'colaborador')
        .get(),
      adminDb.collection('users')
        .where('companyId', '==', authUser.companyId)
        .where('role', '==', 'thoughtleader')
        .get(),
    ]);

    // 2. Build user info map for all content creators
    const userMap = new Map<string, { name: string; avatar?: string; position?: string; role: string }>();
    for (const userDoc of colabSnap.docs) {
      const data = userDoc.data();
      userMap.set(userDoc.id, {
        name: data.profile?.name || data.name || 'Colaborador',
        avatar: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture,
        position: data.linkedinConnection?.position || data.profile?.position || '',
        role: 'colaborador',
      });
    }
    for (const userDoc of tlSnap.docs) {
      const data = userDoc.data();
      userMap.set(userDoc.id, {
        name: data.profile?.name || data.name || 'Thought Leader',
        avatar: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture,
        position: data.linkedinConnection?.position || data.profile?.position || '',
        role: 'thoughtleader',
      });
    }

    if (userMap.size === 0) return { posts: [] };

    const allPosts: FeedPost[] = [];

    // Helper: fetch com orderBy, com fallback sem orderBy caso o índice ainda não exista
    async function fetchPostsWithFallback(
      collection: FirebaseFirestore.CollectionReference,
      statusValue: string,
    ): Promise<FirebaseFirestore.QuerySnapshot> {
      try {
        return await collection
          .where('status', '==', statusValue)
          .orderBy('publishedAt', 'desc')
          .limit(50)
          .get();
      } catch {
        // Índice composto ainda não deployado — fallback sem orderBy
        // O sort final por publishedAt no allPosts ainda garante a ordem correta
        console.warn('[Feed] publishedAt index not ready, falling back to unordered query');
        return collection
          .where('status', '==', statusValue)
          .limit(50)
          .get();
      }
    }

    // 3a. Fetch published scheduledPosts from collaborators (parallel)
    const colabPromises = colabSnap.docs.map(async (userDoc) => {
      try {
        const postsSnap = await fetchPostsWithFallback(
          adminDb.collection('users').doc(userDoc.id).collection('scheduledPosts'),
          'published',
        );

        const userInfo = userMap.get(userDoc.id);

        for (const postDoc of postsSnap.docs) {
          const data = postDoc.data();
          allPosts.push({
            id: postDoc.id,
            userId: userDoc.id,
            authorName: userInfo?.name || 'Colaborador',
            authorAvatar: userInfo?.avatar,
            authorPosition: userInfo?.position,
            caption: data.caption || '',
            mediaUrl: data.mediaUrl || undefined,
            mediaType: data.mediaType || undefined,
            linkedinPostId: data.linkedinPostId || undefined,
            linkedinPostUrl: data.linkedinPostUrl || undefined,
            publishedAt: data.publishedAt || data.updatedAt || data.createdAt || '',
          });
        }
      } catch (e) {
        console.error(`[Feed] Error fetching posts for colab ${userDoc.id}:`, e);
      }
    });

    // 3b. Fetch published pipeline posts from TLs (status === 'postado')
    const tlPromises = tlSnap.docs.map(async (userDoc) => {
      try {
        const postsSnap = await fetchPostsWithFallback(
          adminDb.collection('users').doc(userDoc.id).collection('contentPipeline'),
          'postado',
        );

        const userInfo = userMap.get(userDoc.id);

        for (const postDoc of postsSnap.docs) {
          const data = postDoc.data();
          allPosts.push({
            id: postDoc.id,
            userId: userDoc.id,
            authorName: userInfo?.name || 'Thought Leader',
            authorAvatar: userInfo?.avatar,
            authorPosition: userInfo?.position,
            caption: data.caption || '',
            mediaUrl: data.mediaUrl || undefined,
            mediaType: data.mediaType || undefined,
            linkedinPostId: data.linkedinPostId || undefined,
            linkedinPostUrl: data.linkedinPostUrl || undefined,
            publishedAt: data.publishedAt || data.updatedAt || data.createdAt || '',
          });
        }
      } catch (e) {
        console.error(`[Feed] Error fetching pipeline posts for TL ${userDoc.id}:`, e);
      }
    });

    await Promise.all([...colabPromises, ...tlPromises]);

    // 4. Sort all posts by publishedAt descending
    allPosts.sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime() || 0;
      const dateB = new Date(b.publishedAt).getTime() || 0;
      return dateB - dateA;
    });

    // 5. Return top 50 most recent
    return { posts: allPosts.slice(0, 50) };
  } catch (error) {
    console.error('Error fetching company feed:', error);
    return { error: 'Erro ao carregar feed.' };
  }
}

// ─── Unread Feed Count ──────────────────────────────────────────
export async function getUnreadFeedCount(
  idToken: string,
): Promise<{ count: number; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);
    if (!authUser.companyId) return { count: 0, error: 'Empresa não encontrada.' };

    // Get last read timestamp from user doc
    const userDoc = await adminDb.collection('users').doc(authUser.uid).get();
    const userData = userDoc.data();
    const lastReadAt = userData?.lastFeedReadAt;
    // Convert Firestore Timestamp or string to Date
    const lastReadDate = lastReadAt
      ? (lastReadAt.toDate ? lastReadAt.toDate() : new Date(lastReadAt))
      : new Date(0); // epoch = never read

    // Get all collaborators in company
    const usersSnap = await adminDb.collection('users')
      .where('companyId', '==', authUser.companyId)
      .where('role', '==', 'colaborador')
      .get();

    if (usersSnap.empty) return { count: 0 };

    // Count published posts newer than lastReadDate
    let unreadCount = 0;

    const countPromises = usersSnap.docs.map(async (uDoc) => {
      try {
        const postsSnap = await adminDb
          .collection('users')
          .doc(uDoc.id)
          .collection('scheduledPosts')
          .where('status', '==', 'published')
          .limit(20)
          .get();

        for (const postDoc of postsSnap.docs) {
          const data = postDoc.data();
          const publishedAt = data.publishedAt || data.updatedAt || data.createdAt;
          if (!publishedAt) continue;
          const postDate = publishedAt.toDate ? publishedAt.toDate() : new Date(publishedAt);
          if (postDate > lastReadDate) {
            unreadCount++;
          }
        }
      } catch (e) {
        console.error(`[UnreadFeed] Error counting for user ${uDoc.id}:`, e);
      }
    });

    await Promise.all(countPromises);

    return { count: unreadCount };
  } catch (error) {
    console.error('Error counting unread feed:', error);
    return { count: 0, error: 'Erro ao contar posts não lidos.' };
  }
}

// ─── Mark Feed as Read ──────────────────────────────────────────
export async function markFeedAsRead(
  idToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);

    await adminDb.collection('users').doc(authUser.uid).update({
      lastFeedReadAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error marking feed as read:', error);
    return { success: false, error: 'Erro ao marcar feed como lido.' };
  }
}

// ─── Feed Post Metrics (batch) ──────────────────────────────────
/**
 * Fetch LinkedIn engagement metrics for a list of feed posts.
 * Groups posts by userId, fetches each user's token, and batch-fetches
 * metrics from the LinkedIn socialMetadata API.
 *
 * Returns a map of postId -> { reactions, comments }.
 */
export async function getFeedPostMetrics(
  idToken: string,
  posts: Array<{ id: string; userId: string; linkedinPostId?: string }>,
): Promise<{ metrics: Record<string, { reactions: number; comments: number }>; error?: string }> {
  try {
    await requireAuth(idToken);

    // Only include posts that have a linkedinPostId
    const postsWithIds = posts.filter((p) => p.linkedinPostId);
    if (postsWithIds.length === 0) return { metrics: {} };

    // Group by userId so we can use each user's own token
    const byUser = new Map<string, Array<{ id: string; linkedinPostId: string }>>();
    for (const p of postsWithIds) {
      const arr = byUser.get(p.userId) || [];
      arr.push({ id: p.id, linkedinPostId: p.linkedinPostId! });
      byUser.set(p.userId, arr);
    }

    const result: Record<string, { reactions: number; comments: number }> = {};

    // Process each user's posts in parallel
    const userPromises = Array.from(byUser.entries()).map(async ([userId, userPosts]) => {
      try {
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        const connection = userData?.linkedinConnection as LinkedInConnection | undefined;
        if (!connection) return;

        // Check token validity
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
              await adminDb.collection('users').doc(userId).update({ linkedinConnection: updatedConnection });
              accessToken = newTokens.access_token;
            } catch {
              return; // Skip this user — can't refresh token
            }
          } else {
            return; // Token expired, no refresh available
          }
        }

        // Batch fetch metrics
        const linkedinIds = userPosts.map((p) => p.linkedinPostId);
        const metrics = await fetchPostMetricsBatch(accessToken, linkedinIds);

        // Map linkedin post IDs back to our post IDs
        const metricsById = new Map(metrics.map((m) => [m.postId, m]));
        for (const post of userPosts) {
          const m = metricsById.get(post.linkedinPostId);
          if (m) {
            result[post.id] = {
              reactions: m.totalReactions || 0,
              comments: m.comments || 0,
            };
          }
        }
      } catch (e) {
        console.error(`[FeedMetrics] Error fetching metrics for user ${userId}:`, e);
      }
    });

    await Promise.all(userPromises);

    return { metrics: result };
  } catch (error) {
    console.error('Error fetching feed post metrics:', error);
    return { metrics: {}, error: 'Erro ao buscar metricas.' };
  }
}
