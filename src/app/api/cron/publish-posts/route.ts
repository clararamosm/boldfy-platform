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
import { awardPublicationPoints } from '@/app/actions/gamification';

/**
 * Converte uma exceção do `publishLinkedInPost` numa mensagem amigável pro
 * usuário ver no editor/calendário. As mensagens já em PT que vêm de dentro
 * da função são preservadas — só intercepta tokens internos como
 * 'TOKEN_EXPIRED' e 'LINKEDIN_NO_POST_ID' que não fazem sentido pro usuário.
 */
function formatPublishError(error: unknown): string {
  if (!(error instanceof Error)) return 'Erro desconhecido ao publicar.';
  const msg = error.message;
  if (msg === 'TOKEN_EXPIRED') {
    return 'Token do LinkedIn expirado. Reconecte sua conta nas Configurações.';
  }
  if (msg === 'LINKEDIN_NO_POST_ID') {
    return 'O LinkedIn aceitou a requisição mas não confirmou a publicação (não retornou ID do post). Por favor, reagende para tentar novamente.';
  }
  return msg;
}

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

      // Multi-image gallery support: prioriza mediaUrls[] (novo schema),
      // cai pro mediaUrl singular (legado) se ausente.
      const mediaUrlsArr: string[] = Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0
        ? post.mediaUrls
        : post.mediaUrl ? [post.mediaUrl] : [];
      const mediaTypesArr: string[] = Array.isArray(post.mediaTypes) && post.mediaTypes.length > 0
        ? post.mediaTypes
        : post.mediaType ? [post.mediaType] : [];

      const result = await publishLinkedInPost(
        connResult.accessToken,
        connResult.linkedinId,
        post.caption,
        mediaUrlsArr,
        mediaTypesArr,
      );

      // Defesa em profundidade: publishLinkedInPost já lança LINKEDIN_NO_POST_ID
      // quando o postId vem vazio. Se passar reto, marcamos como falha em vez
      // de gravar linkedinPostUrl quebrada.
      if (!result.postId) {
        throw new Error('LINKEDIN_NO_POST_ID');
      }

      await postDoc.ref.update({
        status: 'published',
        linkedinPostId: result.postId,
        linkedinPostUrl: result.postUrl,
        publishedAt: now,
        // Limpa erros de tentativas anteriores que possam ter sido gravados.
        error: null,
        updatedAt: now,
      });

      // Award gamification points for collaborator publication (fire-and-forget)
      awardPublicationPoints(userId, postDoc.id)
        .catch(err => console.error(`[Gamification] Failed to award points for post ${postDoc.id}:`, err));

      counters.published++;
    } catch (error) {
      console.error(`Failed to publish scheduledPost ${postDoc.id}:`, error);
      const errMsg = formatPublishError(error);
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

      // Multi-image gallery support (mesma lógica do scheduledPosts acima).
      const mediaUrlsArr: string[] = Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0
        ? post.mediaUrls
        : post.mediaUrl ? [post.mediaUrl] : [];
      const mediaTypesArr: string[] = Array.isArray(post.mediaTypes) && post.mediaTypes.length > 0
        ? post.mediaTypes
        : post.mediaType ? [post.mediaType] : [];

      const result = await publishLinkedInPost(
        connResult.accessToken,
        connResult.linkedinId,
        post.caption,
        mediaUrlsArr,
        mediaTypesArr,
      );

      // Mesma defesa do scheduledPosts — evita gravar URL quebrada em
      // contentPipeline.
      if (!result.postId) {
        throw new Error('LINKEDIN_NO_POST_ID');
      }

      await postDoc.ref.update({
        status: 'postado',
        linkedinPostId: result.postId,
        linkedinPostUrl: result.postUrl,
        publishedAt: now,
        error: null,
        updatedAt: now,
      });

      counters.published++;
    } catch (error) {
      console.error(`Failed to publish pipeline post ${postDoc.id}:`, error);
      const errMsg = formatPublishError(error);
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

  // Process both collections in parallel — use allSettled so one failure
  // doesn't prevent the other from running.
  const results = await Promise.allSettled([
    processScheduledPosts(now, counters),
    processPipelinePosts(now, counters),
  ]);

  const errors: string[] = [];
  for (const r of results) {
    if (r.status === 'rejected') {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      console.error('Cron job partial error:', r.reason);
      errors.push(msg);
    }
  }

  if (errors.length > 0 && counters.published === 0) {
    // Both failed and nothing was published — return 500
    return NextResponse.json({
      error: `Cron failed: ${errors.join('; ')}`,
      ...counters,
    }, { status: 500 });
  }

  return NextResponse.json({
    message: `Cron complete. Published: ${counters.published}, Failed: ${counters.failed}, Skipped: ${counters.skipped}.${errors.length > 0 ? ` Errors: ${errors.join('; ')}` : ''}`,
    ...counters,
    errors: errors.length > 0 ? errors : undefined,
  });
}
