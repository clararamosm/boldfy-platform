/**
 * DEBUG ENDPOINT — Analytics Snapshot Inspector
 * GET /api/debug-analytics?userId=XXX&mesAno=YYYY-MM
 *
 * Retorna os dados reais do snapshot e do pipeline para diagnóstico.
 * REMOVER após resolver os bugs de demographics e enriquecimento.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { normalizeLinkedInUrl } from '@/lib/linkedin-xlsx-parser';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const mesAno = searchParams.get('mesAno');

  if (!userId || !mesAno) {
    return NextResponse.json({ error: 'userId e mesAno são obrigatórios' }, { status: 400 });
  }

  try {
    // 1. Ler o snapshot
    const snapshotDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('linkedinSnapshots')
      .doc(mesAno)
      .get();

    if (!snapshotDoc.exists) {
      return NextResponse.json({ error: `Snapshot ${mesAno} não encontrado para userId=${userId}` }, { status: 404 });
    }

    const snapshot = snapshotDoc.data() as Record<string, unknown>;

    // 2. Ler o pipeline (posts postados)
    const pipelineSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('contentPipeline')
      .where('status', '==', 'postado')
      .get();

    const pipelinePosts = pipelineSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title,
        caption: d.caption ? (d.caption as string).substring(0, 80) + '...' : null,
        mediaUrl: d.mediaUrl ?? null,
        formato: d.formato ?? null,
        contentPillar: d.contentPillar ?? null,
        linkedinPostUrl: d.linkedinPostUrl ?? null,
        linkedinPostUrl_normalized: d.linkedinPostUrl ? normalizeLinkedInUrl(d.linkedinPostUrl as string) : null,
        publishedAt: d.publishedAt ?? null,
        status: d.status,
      };
    });

    // 3. Analisar top posts do snapshot
    const topEng = ((snapshot.topPostsByEngagement as unknown[]) ?? []).map((p: unknown) => {
      const post = p as Record<string, unknown>;
      return {
        url: post.url,
        url_normalized: post.url ? normalizeLinkedInUrl(post.url as string) : null,
        date: post.date,
        hasCaption: !!post.caption,
        hasMediaUrl: !!post.mediaUrl,
        hasPostId: !!post.postId,
        format: post.format ?? null,
        pillar: post.pillar ?? null,
      };
    });

    const topImp = ((snapshot.topPostsByImpressions as unknown[]) ?? []).map((p: unknown) => {
      const post = p as Record<string, unknown>;
      return {
        url: post.url,
        url_normalized: post.url ? normalizeLinkedInUrl(post.url as string) : null,
        date: post.date,
        hasCaption: !!post.caption,
        hasMediaUrl: !!post.mediaUrl,
        hasPostId: !!post.postId,
        format: post.format ?? null,
        pillar: post.pillar ?? null,
      };
    });

    // 4. Analisar demographics
    const demographics = (snapshot.demographics as unknown[]) ?? [];
    const demoByCategory: Record<string, number> = {};
    for (const d of demographics) {
      const cat = (d as Record<string, unknown>).category as string ?? '';
      demoByCategory[cat] = (demoByCategory[cat] ?? 0) + 1;
    }

    return NextResponse.json({
      snapshot_meta: {
        mesAno,
        uploadedAt: snapshot.uploadedAt,
        uploadedBy: snapshot.uploadedBy,
        totalImpressions: snapshot.totalImpressions,
        totalFollowers: snapshot.totalFollowers,
      },
      demographics_summary: {
        total_rows: demographics.length,
        by_category: demoByCategory,
        first_5_rows: demographics.slice(0, 5),
      },
      top_posts_engagement: topEng,
      top_posts_impressions: topImp,
      pipeline_posts_postados: {
        count: pipelinePosts.length,
        posts: pipelinePosts,
      },
      match_analysis: {
        top_post_keys: [...new Set([...topEng, ...topImp].map(p => p.url_normalized).filter(Boolean))],
        pipeline_url_keys: pipelinePosts.filter(p => p.linkedinPostUrl_normalized).map(p => p.linkedinPostUrl_normalized),
        pipeline_date_keys: pipelinePosts.filter(p => p.publishedAt).map(p => (p.publishedAt as string).substring(0, 10)),
      },
    });
  } catch (err) {
    console.error('[debug-analytics]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
