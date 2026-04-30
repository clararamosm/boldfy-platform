/**
 * DEBUG ENDPOINT — Analytics Snapshot Inspector + Force Re-enrich
 * GET  /api/debug-analytics?userId=XXX&mesAno=YYYY-MM          → lê e mostra o estado atual
 * POST /api/debug-analytics?userId=XXX&mesAno=YYYY-MM          → força re-enriquecimento e mostra log
 *
 * REMOVER após resolver os bugs de enriquecimento.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebase-admin';
import { normalizeLinkedInUrl } from '@/lib/linkedin-xlsx-parser';

// ── GET: inspeciona o estado atual ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const mesAno = searchParams.get('mesAno');

  if (!userId || !mesAno) {
    return NextResponse.json({ error: 'userId e mesAno são obrigatórios' }, { status: 400 });
  }

  try {
    const snapshotDoc = await adminDb
      .collection('users').doc(userId)
      .collection('linkedinSnapshots').doc(mesAno).get();

    if (!snapshotDoc.exists) {
      return NextResponse.json({ error: `Snapshot ${mesAno} não encontrado para userId=${userId}` }, { status: 404 });
    }

    const snapshot = snapshotDoc.data() as Record<string, unknown>;

    const pipelineSnap = await adminDb
      .collection('users').doc(userId)
      .collection('contentPipeline')
      .where('status', '==', 'postado')
      .get();

    const pipelinePosts = pipelineSnap.docs.map(doc => {
      const d = doc.data();
      const rawUrl = d.linkedinPostUrl ?? null;
      const decoded = rawUrl ? (() => { try { return decodeURIComponent(rawUrl as string); } catch { return rawUrl; } })() : null;
      return {
        id: doc.id,
        title: d.title,
        caption_preview: d.caption ? (d.caption as string).substring(0, 60) + '...' : null,
        mediaUrl: d.mediaUrl ?? null,
        publishedAt: d.publishedAt ?? null,
        linkedinPostUrl_raw: rawUrl,
        linkedinPostUrl_decoded: decoded,
        linkedinPostUrl_normalized: rawUrl ? normalizeLinkedInUrl(rawUrl as string) : null,
      };
    });

    const topEng = ((snapshot.topPostsByEngagement as unknown[]) ?? []).map((p: unknown) => {
      const post = p as Record<string, unknown>;
      return {
        url_raw: post.url,
        url_normalized: post.url ? normalizeLinkedInUrl(post.url as string) : null,
        date: post.date,
        hasCaption: !!post.caption,
        hasMediaUrl: !!post.mediaUrl,
        caption_preview: post.caption ? (post.caption as string).substring(0, 60) + '...' : null,
      };
    });

    const topImp = ((snapshot.topPostsByImpressions as unknown[]) ?? []).map((p: unknown) => {
      const post = p as Record<string, unknown>;
      return {
        url_raw: post.url,
        url_normalized: post.url ? normalizeLinkedInUrl(post.url as string) : null,
        date: post.date,
        hasCaption: !!post.caption,
        hasMediaUrl: !!post.mediaUrl,
      };
    });

    const topKeys = new Set([...topEng, ...topImp].map(p => p.url_normalized).filter(Boolean));
    const pipelineUrlKeys = new Set(pipelinePosts.filter(p => p.linkedinPostUrl_normalized).map(p => p.linkedinPostUrl_normalized));
    const pipelineDateKeys = pipelinePosts.filter(p => p.publishedAt).map(p => (p.publishedAt as string).substring(0, 10));

    const demographics = (snapshot.demographics as unknown[]) ?? [];
    const demoByCategory: Record<string, number> = {};
    for (const d of demographics) {
      const cat = (d as Record<string, unknown>).category as string ?? 'unknown';
      demoByCategory[cat] = (demoByCategory[cat] ?? 0) + 1;
    }

    return NextResponse.json({
      _hint: 'Use POST nesta mesma URL para forçar re-enriquecimento com log detalhado',
      snapshot_meta: {
        mesAno,
        uploadedAt: snapshot.uploadedAt,
        totalImpressions: snapshot.totalImpressions,
        totalFollowers: snapshot.totalFollowers,
      },
      demographics: {
        total_rows: demographics.length,
        categories_count: demoByCategory,
        sample_rows: demographics.slice(0, 5),
      },
      top_posts_by_engagement: topEng,
      top_posts_by_impressions: topImp,
      pipeline_postado: {
        count: pipelinePosts.length,
        posts: pipelinePosts,
      },
      match_analysis: {
        top_post_normalized_keys: [...topKeys],
        pipeline_url_normalized_keys: [...pipelineUrlKeys],
        pipeline_date_keys: pipelineDateKeys,
        url_intersections: [...topKeys].filter(k => pipelineUrlKeys.has(k!)),
        date_intersections: pipelineDateKeys.filter(d =>
          [...topEng, ...topImp].some(p => p.date === d)
        ),
      },
    });
  } catch (err) {
    console.error('[debug-analytics GET]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── POST: força re-enriquecimento com log verbose ────────────────────────────

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const mesAno = searchParams.get('mesAno');

  if (!userId || !mesAno) {
    return NextResponse.json({ error: 'userId e mesAno são obrigatórios' }, { status: 400 });
  }

  const log: string[] = [];

  try {
    const snapshotRef = adminDb.collection('users').doc(userId).collection('linkedinSnapshots').doc(mesAno);
    const snap = await snapshotRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'Snapshot não encontrado' }, { status: 404 });

    const data = snap.data() as Record<string, unknown>;

    const pipelineSnap = await adminDb
      .collection('users').doc(userId)
      .collection('contentPipeline')
      .where('status', '==', 'postado')
      .get();

    log.push(`pipeline posts com status=postado: ${pipelineSnap.size}`);

    type Entry = { postId: string; caption?: string; mediaUrl?: string; format?: string; pillar?: string };
    const urlMap: Record<string, Entry> = {};
    const dateMap: Record<string, Entry[]> = {};

    for (const doc of pipelineSnap.docs) {
      const d = doc.data();
      const entry: Entry = {
        postId: doc.id,
        caption: (d.caption as string | undefined) ?? (d.title as string | undefined),
        mediaUrl: d.mediaUrl as string | undefined,
        format: d.formato as string | undefined,
        pillar: d.contentPillar as string | undefined,
      };

      const rawUrl = d.linkedinPostUrl as string | undefined;
      if (rawUrl) {
        const key = normalizeLinkedInUrl(rawUrl);
        log.push(`  pipeline ${doc.id}: linkedinPostUrl="${rawUrl}" → normalized="${key}"`);
        if (key) { urlMap[key] = entry; continue; }
      } else {
        log.push(`  pipeline ${doc.id}: sem linkedinPostUrl`);
      }

      const publishedAt = d.publishedAt as string | undefined;
      if (publishedAt && publishedAt.startsWith(mesAno)) {
        const dayKey = publishedAt.substring(0, 10);
        log.push(`  pipeline ${doc.id}: publishedAt=${publishedAt} → dateMap[${dayKey}]`);
        if (!dateMap[dayKey]) dateMap[dayKey] = [];
        dateMap[dayKey].push(entry);
      } else {
        log.push(`  pipeline ${doc.id}: publishedAt="${publishedAt}" — fora do mesAno ${mesAno}`);
      }
    }

    log.push(`urlMap keys: ${JSON.stringify(Object.keys(urlMap))}`);
    log.push(`dateMap keys: ${JSON.stringify(Object.keys(dateMap))}`);

    type SnapPost = { url: string; date?: string; caption?: string; mediaUrl?: string };

    function enrichList(posts: SnapPost[], label: string) {
      return posts.map(post => {
        const key = normalizeLinkedInUrl(post.url);
        log.push(`  [${label}] url="${post.url}" normalized="${key}"`);
        const byUrl = key ? urlMap[key] : undefined;
        if (byUrl) {
          log.push(`    ✓ URL MATCH → postId=${byUrl.postId} caption="${(byUrl.caption ?? '').substring(0, 50)}"`);
          return { ...post, ...byUrl };
        }
        if (!post.caption && !post.mediaUrl && post.date) {
          const candidates = dateMap[post.date];
          if (candidates?.length === 1) {
            log.push(`    ✓ DATE MATCH date=${post.date} → postId=${candidates[0].postId}`);
            return { ...post, ...candidates[0] };
          }
          log.push(`    ✗ NO MATCH: key="${key}" not in urlMap, date="${post.date}" candidates=${candidates?.length ?? 0}`);
        }
        return post;
      });
    }

    const enrichedEng = enrichList((data.topPostsByEngagement as SnapPost[]) ?? [], 'eng');
    const enrichedImp = enrichList((data.topPostsByImpressions as SnapPost[]) ?? [], 'imp');

    await snapshotRef.update({
      topPostsByEngagement: enrichedEng,
      topPostsByImpressions: enrichedImp,
    });

    log.push('snapshot atualizado no Firestore');

    return NextResponse.json({ success: true, log });
  } catch (err) {
    log.push(`ERRO: ${String(err)}`);
    console.error('[debug-analytics POST]', err);
    return NextResponse.json({ error: String(err), log }, { status: 500 });
  }
}
