// src/app/api/cron/publish-posts/route.ts
// Cron endpoint: publishes scheduled LinkedIn posts whose time has arrived.
// Handles BOTH:
//   1. scheduledPosts (direct scheduling by users)
//   2. contentPipeline posts with status 'agendado' (TL pipeline managed by strategists)
// Call this every 5 minutes via Cloud Scheduler or a cron service.
// Secured via CRON_SECRET header.
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { publishLinkedInPost, isTokenExpired, refreshAccessToken, buildConnectionData, type LinkedInConnection } from '@/lib/linkedin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 second timeout

// ─── Shared publish logic ──────────────────────────────

async function getConnectionAndToken(
  userId: string,
  now: string,
): Promise<{ accessToken: string; linkedinId: string } | { error: string }> {
  const userDoc = await adminDb.collection('users').doc(userId).get();
  if (!userDoc.exists) return { error: 'Usuário não encontrado.' };

  const userData = userDoc.data();
  const connection = userData?.linkedinConnection as LinkedInConnection | undefined;
  if (!connection) return { error: 'LinkedIn não conectado.' };

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
        return { error: 'Token expirado, não foi possível renovar.' };
      }
    } else {
      return { error: 'Token expirado. Reconecte o LinkedIn.' };
    }
  }

  return { accessToken, linkedinId: connection.linkedinId };
}

// ─── Process scheduledPosts collection ─────────────────

async function processScheduledPosts(
  now: string,
  counters: { published: number; failed: number; skipped: number },
) {
  const postsSnapshot = await adminDb
    .collectionGroup('scheduledPosts')
    .where('status', '==', 'scheduled')
    .where('scheduledFor', '<=', now)
    .limit(20)
    .get();

  if (postsSnapshot.empty) return;

  for (const postDoc of postsSnapshot.docs) {
    const post = postDoc.data();
    const userId = post.userId;

    try {
      // Atomic lock
      const lockSuccess = await adminDb.runTransaction(async (tx) => {
        const freshDoc = await tx.get(postDoc.ref);
        if (freshDoc.data()?.status !== 'scheduled') return false;
        tx.update(postDoc.ref, { status: 'publishing', updatedAt: now });
        return true;
      });
      if (!lockSuccess) { counters.skipped++; continue; }

      const connResult = await getConnectionAndToken(userId, now);
      if ('error' in connResult) {
        await postDoc.ref.update({ status: 'failed', error: connResult.error, updatedAt: now });
        counters.failed++;
        continue;
      }

      const result = await publishLinkedInPost(
        connResult.accessToken,
        connResult.linkedinId,
        post.caption,
        post.mediaUrl || undefined,
      );

      await postDoc.ref.update({
        status: 'published',
        linkedinPostId: result.postId,
        linkedinPostUrl: result.postUrl,
        publishedAt: now,
        updatedAt: now,
      });

      counters.published++;
    } catch (error) {
      console.error(`Failed to publish scheduledPost ${postDoc.id}:`, error);
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      await postDoc.ref.update({ status: 'failed', error: errMsg, updatedAt: now });
      counters.failed++;
    }
  }
}

// ─── Process contentPipeline posts (TL pipeline) ───────

async function processPipelinePosts(
  now: string,
  counters: { published: number; failed: number; skipped: number },
) {
  const pipelineSnapshot = await adminDb
    .collectionGroup('contentPipeline')
    .where('status', '==', 'agendado')
    .where('scheduledFor', '<=', now)
    .limit(20)
    .get();

  if (pipelineSnapshot.empty) return;

  for (const postDoc of pipelineSnapshot.docs) {
    const post = postDoc.data();

    // The TL userId is the parent of the contentPipeline collection:
    // users/{tlUserId}/contentPipeline/{postId}
    const tlUserId = postDoc.ref.parent.parent?.id;
    if (!tlUserId) {
      console.error(`Could not resolve TL userId for pipeline post ${postDoc.id}`);
      counters.failed++;
      continue;
    }

    try {
      // Atomic lock: mark as 'publicando' to prevent double-publish
      const lockSuccess = await adminDb.runTransaction(async (tx) => {
        const freshDoc = await tx.get(postDoc.ref);
        if (freshDoc.data()?.status !== 'agendado') return false;
        tx.update(postDoc.ref, { status: 'publicando', updatedAt: now });
        return true;
      });
      if (!lockSuccess) { counters.skipped++; continue; }

      const connResult = await getConnectionAndToken(tlUserId, now);
      if ('error' in connResult) {
        // Revert to agendado so strategist can see the issue
        await postDoc.ref.update({ status: 'agendado', error: connResult.error, updatedAt: now });
        counters.failed++;
        console.error(`Pipeline post ${postDoc.id} for TL ${tlUserId}: ${connResult.error}`);
        continue;
      }

      const result = await publishLinkedInPost(
        connResult.accessToken,
        connResult.linkedinId,
        post.caption,
        post.mediaUrl || undefined,
      );

      await postDoc.ref.update({
        status: 'postado',
        linkedinPostId: result.postId,
        linkedinPostUrl: result.postUrl,
        publishedAt: now,
        updatedAt: now,
      });

      counters.published++;
    } catch (error) {
      console.error(`Failed to publish pipeline post ${postDoc.id}:`, error);
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
      // Revert to agendado with error info
      await postDoc.ref.update({ status: 'agendado', error: errMsg, updatedAt: now });
      counters.failed++;
    }
  }
}

// ─── Main handler ──────────────────────────────────────

export async function GET(request: NextRequest) {
  // Security: verify cron secret (fail-closed)
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  const counters = { published: 0, failed: 0, skipped: 0 };

  try {
    // Process both collections in parallel
    await Promise.all([
      processScheduledPosts(now, counters),
      processPipelinePosts(now, counters),
    ]);

    return NextResponse.json({
      message: `Cron complete. Published: ${counters.published}, Failed: ${counters.failed}, Skipped: ${counters.skipped}.`,
      ...counters,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
