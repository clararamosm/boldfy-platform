// src/app/api/cron/publish-posts/route.ts
// Cron endpoint: publishes scheduled LinkedIn posts whose time has arrived.
// Call this every 5 minutes via Cloud Scheduler or a cron service.
// Secured via CRON_SECRET header.

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { publishLinkedInPost, isTokenExpired, refreshAccessToken, buildConnectionData, type LinkedInConnection } from '@/lib/linkedin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 second timeout

export async function GET(request: NextRequest) {
  // Security: verify cron secret (fail-closed — nega acesso se secret nao estiver configurado)
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;

  // Accept both "Bearer <secret>" and raw "<secret>" formats
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  if (!cronSecret || token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();
  let published = 0;
  let failed = 0;
  let skipped = 0;

  try {
    // Query ALL users who have scheduled posts
    // We need to use a collection group query across all users' scheduledPosts
    const postsSnapshot = await adminDb
      .collectionGroup('scheduledPosts')
      .where('status', '==', 'scheduled')
      .where('scheduledFor', '<=', now)
      .limit(20) // Process max 20 per run to stay within timeout
      .get();

    if (postsSnapshot.empty) {
      return NextResponse.json({ message: 'No posts to publish.', published: 0, failed: 0 });
    }

    for (const postDoc of postsSnapshot.docs) {
      const post = postDoc.data();
      const userId = post.userId;

      try {
        // Get user's LinkedIn connection
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
          await postDoc.ref.update({ status: 'failed', error: 'Usuário não encontrado.', updatedAt: now });
          failed++;
          continue;
        }

        const userData = userDoc.data();
        const connection = userData?.linkedinConnection as LinkedInConnection | undefined;

        if (!connection) {
          await postDoc.ref.update({ status: 'failed', error: 'LinkedIn não conectado.', updatedAt: now });
          failed++;
          continue;
        }

        // Check/refresh token
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
              await postDoc.ref.update({ status: 'failed', error: 'Token expirado, não foi possível renovar.', updatedAt: now });
              failed++;
              continue;
            }
          } else {
            await postDoc.ref.update({ status: 'failed', error: 'Token expirado. Reconecte o LinkedIn.', updatedAt: now });
            failed++;
            continue;
          }
        }

        // Publish! (with optional image)
        const result = await publishLinkedInPost(
          accessToken,
          connection.linkedinId,
          post.caption,
          post.mediaUrl || undefined
        );

        // Update post status to published
        await postDoc.ref.update({
          status: 'published',
          linkedinPostId: result.postId,
          linkedinPostUrl: result.postUrl,
          publishedAt: now,
          updatedAt: now,
        });

        published++;
      } catch (error) {
        console.error(`Failed to publish post ${postDoc.id}:`, error);
        const errMsg = error instanceof Error ? error.message : 'Erro desconhecido';
        await postDoc.ref.update({ status: 'failed', error: errMsg, updatedAt: now });
        failed++;
      }
    }

    return NextResponse.json({
      message: `Cron complete. Published: ${published}, Failed: ${failed}, Skipped: ${skipped}.`,
      published,
      failed,
      skipped,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
