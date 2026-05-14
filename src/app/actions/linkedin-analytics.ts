'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, requireStrategistForTL } from '@/lib/auth-guard';
import { ai } from '@/ai/genkit';
import { normalizeLinkedInUrl, linkedInIdPrefix } from '@/lib/linkedin-xlsx-parser';
import type {
  LinkedInSnapshot,
  ParsedLinkedInData,
  AnalyticsUser,
  ActionPlanItem,
  IcpFitScore,
  IcpDefinition,
} from '@/lib/linkedin-analytics-types';
import { formatMesAno } from '@/lib/linkedin-analytics-utils';

// ---------------------------------------------------------------------------
// Pontos por upload de Analytics
// ---------------------------------------------------------------------------
//
// Spec: /Developer/source-of-truth/specs/analytics-dashboard-revamp.md (Frente E)
// - Upload mensal (uploadType='monthly'): 50 pontos, 1x por mês (idempotente).
// - Upload histórico (uploadType='historical'): 100 pontos, 1x na vida do user.
//
// Idempotência via query em pointsHistory: monthly checa por analyticsMonth,
// historical checa por uploadType='historical'. Se já existe, não credita
// de novo. Permite reupar sem dar dupla pontuação.

const ANALYTICS_POINTS = {
  monthly: 50,
  historical: 100,
} as const;

async function awardAnalyticsPoints(
  userId: string,
  mesAno: string,
  uploadType: 'monthly' | 'historical',
): Promise<{ awarded: boolean; points: number }> {
  const points = ANALYTICS_POINTS[uploadType];
  const historyRef = adminDb
    .collection('users')
    .doc(userId)
    .collection('pointsHistory');

  // Idempotência: monthly = 1x por mês; historical = 1x na vida.
  const query = uploadType === 'monthly'
    ? historyRef
        .where('source', '==', 'analytics')
        .where('analyticsMonth', '==', mesAno)
        .limit(1)
    : historyRef
        .where('source', '==', 'analytics')
        .where('uploadType', '==', 'historical')
        .limit(1);

  const existing = await query.get();
  if (!existing.empty) {
    return { awarded: false, points: 0 };
  }

  const description = uploadType === 'monthly'
    ? `Upload Analytics: ${formatMesAno(mesAno)}`
    : 'Upload Analytics: histórico de 12 meses';

  const batch = adminDb.batch();
  const userRef = adminDb.collection('users').doc(userId);

  batch.set(historyRef.doc(), {
    description,
    date: FieldValue.serverTimestamp(),
    points,
    type: 'gain',
    source: 'analytics',
    analyticsMonth: mesAno,
    uploadType,
  });

  batch.update(userRef, {
    points: FieldValue.increment(points),
    pendingNotifications: FieldValue.arrayUnion({
      type: 'points',
      source: 'analytics',
      points,
      description,
      createdAt: Date.now(),
    }),
  });

  await batch.commit();
  return { awarded: true, points };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verifica se o caller tem permissão para acessar snapshots de um userId.
 * Allowed: próprio usuário | estrategista com acesso ao TL | admin da mesma empresa
 */
async function requireSnapshotAccess(idToken: string, targetUserId: string): Promise<void> {
  const caller = await requireAuth(idToken);

  if (caller.uid === targetUserId) return; // próprio usuário

  if (caller.role === 'master') return;

  if (caller.role === 'admin') {
    // Admin pode ver usuários da mesma empresa
    const targetDoc = await adminDb.collection('users').doc(targetUserId).get();
    const targetCompanyId = targetDoc.data()?.companyId;
    if (caller.companyId && caller.companyId === targetCompanyId) return;
    throw new Error('Acesso negado: usuário não pertence à sua empresa.');
  }

  if (caller.role === 'strategist') {
    // Estrategista pode ver TLs com acesso
    await requireStrategistForTL(idToken, targetUserId);
    return;
  }

  throw new Error('Acesso negado.');
}

/**
 * Enriquece os top posts do snapshot com dados do contentPipeline (assíncrono, falha silenciosa)
 */
async function enrichSnapshotWithPostData(userId: string, mesAno: string): Promise<void> {
  try {
    const snapshotRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('linkedinSnapshots')
      .doc(mesAno);

    const snap = await snapshotRef.get();
    if (!snap.exists) return;

    const data = snap.data() as LinkedInSnapshot;

    // Buscar todos os posts do contentPipeline com status postado
    const pipelineSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('contentPipeline')
      .where('status', '==', 'postado')
      .get();

    console.log(`[enrich] userId=${userId} mesAno=${mesAno} pipeline_posts=${pipelineSnap.size}`);

    if (pipelineSnap.empty) {
      console.log(`[enrich] Sem posts postados no pipeline — enriquecimento não possível`);
      return;
    }

    type EnrichmentEntry = {
      postId: string;
      caption?: string;
      mediaUrl?: string;
      format?: string;
      pillar?: string;
      publishedAt?: string; // ISO completo — usado para ordenar candidatos em colisão de data
    };

    // Mapa 1 — match exato: ID numérico completo (só funciona se XLSX e API usam mesmo tipo de URN)
    const urlMap: Record<string, EnrichmentEntry> = {};

    // Mapa 2 — match por prefixo de 8 dígitos do Snowflake ID:
    // urn:li:activity e urn:li:share do mesmo post são criados com poucos ms de diferença,
    // então compartilham os primeiros 8 dígitos decimais do ID.
    // Ex: activity:7451238122723381248 ↔ share:7451238121754484736 → prefixo "74512381"
    const prefixMap: Record<string, EnrichmentEntry> = {};

    // Mapa 3 — fallback por data (YYYY-MM-DD) → candidatos ordenados por publishedAt
    const dateMap: Record<string, EnrichmentEntry[]> = {};

    for (const doc of pipelineSnap.docs) {
      const d = doc.data();
      const publishedAt = d.publishedAt as string | undefined;
      const entry: EnrichmentEntry = {
        postId: doc.id,
        caption: (d.caption as string | undefined) ?? (d.title as string | undefined),
        mediaUrl: d.mediaUrl as string | undefined,
        format: d.formato as string | undefined,
        pillar: d.contentPillar as string | undefined,
        publishedAt,
      };

      const url = d.linkedinPostUrl as string | undefined;
      if (url) {
        // Mapa 1: match exato pelo ID numérico completo
        const key = normalizeLinkedInUrl(url);
        if (key) urlMap[key] = entry;

        // Mapa 2: match por prefixo de 8 dígitos (Snowflake timestamp bits)
        // Cobre o caso urn:li:share (pipeline) ↔ urn:li:activity (XLSX) que têm IDs distintos
        // mas prefixo numérico idêntico pois foram criados com milissegundos de diferença.
        const prefix = linkedInIdPrefix(url);
        if (prefix) prefixMap[prefix] = entry;

        console.log(`[enrich] pipeline doc=${doc.id} url_normalized="${key}" prefix="${prefix}" publishedAt="${publishedAt}"`);
      } else {
        console.log(`[enrich] pipeline doc=${doc.id} sem linkedinPostUrl publishedAt="${publishedAt}"`);
      }

      // Sempre indexa por data também (mesmo que tenha URL) — o URL match falha entre
      // urn:li:activity (XLSX) e urn:li:share (API) pois os IDs numéricos diferem.
      if (publishedAt && publishedAt.startsWith(mesAno)) {
        const dayKey = publishedAt.substring(0, 10);
        console.log(`[enrich] pipeline doc=${doc.id} → dateMap[${dayKey}]`);
        if (!dateMap[dayKey]) dateMap[dayKey] = [];
        dateMap[dayKey].push(entry);
      } else {
        console.log(`[enrich] pipeline doc=${doc.id} publishedAt="${publishedAt}" fora do mesAno=${mesAno}`);
      }
    }

    // Ordenar cada bucket do dateMap por publishedAt crescente (primeiro post do dia primeiro).
    // Isso torna o desempate posicional determinístico.
    for (const dayKey of Object.keys(dateMap)) {
      dateMap[dayKey].sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''));
    }

    const topUrls = [
      ...(data.topPostsByEngagement ?? []),
      ...(data.topPostsByImpressions ?? []),
    ].map(p => normalizeLinkedInUrl(p.url));
    console.log(`[enrich] top post keys (normalized): ${JSON.stringify([...new Set(topUrls)])}`);
    console.log(`[enrich] urlMap keys: ${JSON.stringify(Object.keys(urlMap))}`);

    // Enriquecer cada top post — prioridade: match por URL > match por data.
    // Sempre re-enriquece (sem checar postId existente) para permitir correção de matches errados.
    // usedPostIds é passado por referência para evitar que dois posts diferentes do mesmo dia
    // peguem o mesmo candidato — mas é resetado entre listas independentes (eng vs imp).
    function enrichList(
      posts: typeof data.topPostsByEngagement,
      usedPostIds = new Set<string>(),
    ) {
      return (posts ?? []).map(post => {
        const key = normalizeLinkedInUrl(post.url);
        const prefix = linkedInIdPrefix(post.url);

        // Nível 1 — match exato pelo ID numérico completo
        const byUrl = key ? urlMap[key] : undefined;
        if (byUrl && !usedPostIds.has(byUrl.postId)) {
          console.log(`[enrich] ✓ URL match (exato): post.url="${post.url}" → postId=${byUrl.postId}`);
          usedPostIds.add(byUrl.postId);
          return { ...post, ...byUrl };
        }

        // Nível 2 — match por prefixo Snowflake de 8 dígitos
        // urn:li:activity (XLSX) e urn:li:share/ugcPost (API) têm IDs distintos mas
        // compartilham os primeiros 8 dígitos pois foram criados com ms de diferença.
        const byPrefix = prefix ? prefixMap[prefix] : undefined;
        if (byPrefix && !usedPostIds.has(byPrefix.postId)) {
          console.log(`[enrich] ✓ prefix match (8 dígitos): post.url="${post.url}" prefix="${prefix}" → postId=${byPrefix.postId}`);
          usedPostIds.add(byPrefix.postId);
          return { ...post, ...byPrefix };
        }

        // Nível 3 — fallback por data de publicação (YYYY-MM-DD)
        // Último recurso para posts sem linkedinPostUrl no pipeline.
        // Candidatos ordenados por publishedAt crescente; usedPostIds evita duplicatas.
        if (post.date) {
          const candidates = dateMap[post.date];
          if (candidates?.length) {
            const available = candidates.filter(c => !usedPostIds.has(c.postId));
            if (available.length) {
              const chosen = available[0];
              usedPostIds.add(chosen.postId);
              console.log(`[enrich] ✓ date match${candidates.length > 1 ? ` (${available.length}/${candidates.length} disponíveis)` : ''}: post.date="${post.date}" → postId=${chosen.postId}`);
              return { ...post, ...chosen };
            }
            console.log(`[enrich] ✗ date match: post.date="${post.date}" todos os ${candidates.length} candidatos já foram usados`);
          } else {
            console.log(`[enrich] ✗ sem match: post.url="${post.url}" date="${post.date}" — nenhum candidato`);
          }
        }

        return post;
      });
    }

    const enrichedByEngagement = enrichList(data.topPostsByEngagement ?? []);
    const enrichedByImpressions = enrichList(data.topPostsByImpressions ?? []);

    await snapshotRef.update({
      topPostsByEngagement: enrichedByEngagement,
      topPostsByImpressions: enrichedByImpressions,
    });

    console.log(`[enrich] snapshot ${mesAno} atualizado com sucesso`);

    // Write-back: salva métricas (impressões, reactions, engajamento) de volta no contentPipeline
    // para que os cards do calendário possam exibir ❤️ e 👁️ sem precisar de outra query.
    // Usa a union das duas listas para ter o conjunto mais completo possível.
    const analyticsNow = new Date().toISOString();
    const pipelineMetrics: Record<string, { impressions: number; reactions: number; engagement: number }> = {};

    for (const post of [...enrichedByEngagement, ...enrichedByImpressions]) {
      if (!post.postId) continue;
      const existing = pipelineMetrics[post.postId];
      pipelineMetrics[post.postId] = {
        impressions: Math.max(existing?.impressions ?? 0, post.impressions ?? 0),
        reactions:   Math.max(existing?.reactions ?? 0, post.engagement ?? 0),
        engagement:  Math.max(existing?.engagement ?? 0, post.engagement ?? 0),
      };
    }

    if (Object.keys(pipelineMetrics).length > 0) {
      const pipelineRef = adminDb.collection('users').doc(userId).collection('contentPipeline');
      const writes = Object.entries(pipelineMetrics).map(([postId, m]) =>
        pipelineRef.doc(postId).update({
          analyticsImpressions: m.impressions,
          analyticsReactions:   m.reactions,
          analyticsEngagement:  m.engagement,
          analyticsUpdatedAt:   analyticsNow,
        })
      );
      await Promise.all(writes);
      console.log(`[enrich] write-back: ${writes.length} posts no contentPipeline atualizados com métricas`);
    }
  } catch (err) {
    // Falha silenciosa — o snapshot já está salvo e é válido sem o enriquecimento
    console.error('[linkedin-analytics] enrichSnapshotWithPostData error:', err);
  }
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Salva um snapshot mensal do LinkedIn Analytics no Firestore.
 * Retorna alreadyExists=true se já existe e overwrite não foi solicitado.
 */
export async function uploadLinkedInSnapshot(
  idToken: string,
  userId: string,
  snapshotData: ParsedLinkedInData,
  overwrite = false,
): Promise<{ success?: boolean; alreadyExists?: boolean; mesAno?: string; error?: string }> {
  try {
    const caller = await requireAuth(idToken);

    // Autorizado: próprio usuário, master, admin (mesma empresa), strategist (com acesso ao TL)
    if (caller.uid !== userId && caller.role !== 'master') {
      if (caller.role === 'admin') {
        const tlDoc = await adminDb.collection('users').doc(userId).get();
        if (!tlDoc.exists || tlDoc.data()?.companyId !== caller.companyId) {
          return { error: 'Acesso negado: TL não pertence à sua empresa.' };
        }
      } else if (caller.role === 'strategist') {
        await requireStrategistForTL(idToken, userId);
      } else {
        return { error: 'Acesso negado.' };
      }
    }

    const { mesAno } = snapshotData;
    const snapshotRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('linkedinSnapshots')
      .doc(mesAno);

    // Verificar se já existe
    const existing = await snapshotRef.get();
    if (existing.exists && !overwrite) {
      return { alreadyExists: true, mesAno };
    }

    const snapshot: LinkedInSnapshot = {
      ...snapshotData,
      uploadedAt: new Date().toISOString(),
      uploadedBy: caller.uid,
    };

    await snapshotRef.set(snapshot);

    // Atualizar flag no documento do usuário
    await adminDb.collection('users').doc(userId).update({
      'linkedinSnapshotStatus.lastUploadMonth': mesAno,
      'linkedinSnapshotStatus.lastUploadAt': new Date().toISOString(),
    });

    // Atribui pontos pelo upload mensal (50 pts, 1x por mês). Falha silenciosa
    // não bloqueia o upload em si — o snapshot já está salvo.
    if (snapshot.uploadType !== 'historical') {
      awardAnalyticsPoints(userId, mesAno, 'monthly')
        .catch((err) => console.error('[awardAnalyticsPoints monthly] error:', err));
    }

    // Enriquecimento assíncrono — não bloqueia o retorno
    enrichSnapshotWithPostData(userId, mesAno).catch(() => {});

    return { success: true, mesAno };
  } catch (err) {
    console.error('[linkedin-analytics] uploadLinkedInSnapshot error:', err);
    return { error: 'Erro ao salvar snapshot. Tente novamente.' };
  }
}

/**
 * Salva múltiplos snapshots de uma vez (upload histórico multi-mês).
 * Retorna quais meses foram gravados e quais já existiam.
 * Sempre sobrescreve — histórico é sempre substituído pelo dado mais recente.
 */
export async function uploadLinkedInSnapshotBatch(
  idToken: string,
  userId: string,
  snapshots: ParsedLinkedInData[],
): Promise<{ success?: boolean; savedMonths?: string[]; error?: string }> {
  try {
    const caller = await requireAuth(idToken);

    // Autorizado: próprio usuário, master, admin (mesma empresa), strategist (com acesso ao TL)
    if (caller.uid !== userId && caller.role !== 'master') {
      if (caller.role === 'admin') {
        const tlDoc = await adminDb.collection('users').doc(userId).get();
        if (!tlDoc.exists || tlDoc.data()?.companyId !== caller.companyId) {
          return { error: 'Acesso negado: TL não pertence à sua empresa.' };
        }
      } else if (caller.role === 'strategist') {
        await requireStrategistForTL(idToken, userId);
      } else {
        return { error: 'Acesso negado.' };
      }
    }

    if (!snapshots.length) {
      return { error: 'Nenhum snapshot para salvar.' };
    }

    const savedMonths: string[] = [];
    const now = new Date().toISOString();

    // Gravar cada mês — sempre sobrescreve (histórico substitui, nunca faz média)
    for (const snapshotData of snapshots) {
      const { mesAno } = snapshotData;
      const snapshotRef = adminDb
        .collection('users')
        .doc(userId)
        .collection('linkedinSnapshots')
        .doc(mesAno);

      const snapshot: LinkedInSnapshot = {
        ...snapshotData,
        uploadedAt: now,
        uploadedBy: caller.uid,
      };

      await snapshotRef.set(snapshot);
      savedMonths.push(mesAno);
    }

    // Atualizar flag com o mês mais recente do lote
    const latestMonth = [...savedMonths].sort().reverse()[0];
    await adminDb.collection('users').doc(userId).update({
      'linkedinSnapshotStatus.lastUploadMonth': latestMonth,
      'linkedinSnapshotStatus.lastUploadAt': now,
    });

    // Atribui pontos pelo upload histórico (100 pts, 1x na vida do user).
    // Usa o mês mais recente como label do registro.
    awardAnalyticsPoints(userId, latestMonth, 'historical')
      .catch((err) => console.error('[awardAnalyticsPoints historical] error:', err));

    // Enriquecimento de todos os meses salvos (top posts)
    for (const month of savedMonths) {
      enrichSnapshotWithPostData(userId, month).catch(() => {});
    }

    return { success: true, savedMonths };
  } catch (err) {
    console.error('[linkedin-analytics] uploadLinkedInSnapshotBatch error:', err);
    return { error: 'Erro ao salvar histórico. Tente novamente.' };
  }
}

/**
 * Busca um snapshot mensal específico.
 */
export async function getLinkedInSnapshot(
  idToken: string,
  userId: string,
  mesAno: string,
): Promise<{ snapshot?: LinkedInSnapshot; error?: string }> {
  try {
    await requireSnapshotAccess(idToken, userId);

    const doc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('linkedinSnapshots')
      .doc(mesAno)
      .get();

    if (!doc.exists) return { snapshot: undefined };

    const snapshot = doc.data() as LinkedInSnapshot;

    // Re-enriquecer automaticamente se há top posts sem caption/mediaUrl.
    // Usa `some` em vez de `every` — re-tenta sempre que ao menos 1 post ainda não foi enriquecido,
    // garantindo que posts parcialmente enriquecidos também recebam seus dados.
    const topPosts = [...(snapshot.topPostsByEngagement ?? []), ...(snapshot.topPostsByImpressions ?? [])];
    const needsEnrich = topPosts.length > 0 && topPosts.some(p => !p.caption && !p.mediaUrl);
    if (needsEnrich) {
      // Fire-and-forget: não bloqueia o retorno, mas melhora na próxima leitura
      enrichSnapshotWithPostData(userId, mesAno).catch(() => {});
    }

    return { snapshot };
  } catch (err) {
    console.error('[linkedin-analytics] getLinkedInSnapshot error:', err);
    return { error: 'Erro ao buscar snapshot.' };
  }
}

/**
 * Busca múltiplos snapshots de uma vez (para gráficos multi-mês).
 */
export async function getLinkedInSnapshotBatch(
  idToken: string,
  userId: string,
  months: string[],
): Promise<{ snapshots?: Record<string, LinkedInSnapshot>; error?: string }> {
  try {
    await requireSnapshotAccess(idToken, userId);

    const results: Record<string, LinkedInSnapshot> = {};

    // Firestore não suporta batch get em subcoleções — buscar em paralelo
    await Promise.all(
      months.map(async mesAno => {
        const doc = await adminDb
          .collection('users')
          .doc(userId)
          .collection('linkedinSnapshots')
          .doc(mesAno)
          .get();
        if (doc.exists) {
          results[mesAno] = doc.data() as LinkedInSnapshot;
        }
      })
    );

    return { snapshots: results };
  } catch (err) {
    console.error('[linkedin-analytics] getLinkedInSnapshotBatch error:', err);
    return { error: 'Erro ao buscar snapshots.' };
  }
}

/**
 * Lista todos os meses disponíveis para um usuário (ordem decrescente).
 */
export async function listLinkedInSnapshots(
  idToken: string,
  userId: string,
): Promise<{ months?: string[]; error?: string }> {
  try {
    await requireSnapshotAccess(idToken, userId);

    const snap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('linkedinSnapshots')
      .get();

    // Ordenar descrescente no cliente — YYYY-MM ordena lexicograficamente, dispensa índice
    const months = snap.docs.map(d => d.id).sort((a, b) => b.localeCompare(a));
    return { months };
  } catch (err) {
    console.error('[linkedin-analytics] listLinkedInSnapshots error:', err);
    return { error: 'Erro ao listar snapshots.' };
  }
}

/**
 * Retorna usuários da empresa que publicam no LinkedIn (para filtro do /admin/analytics).
 * Se `filterRole` for informado, retorna apenas aquele papel.
 * Sem filtro → retorna todos (thoughtleaders + colaboradores).
 */
export async function getCompanyAnalyticsUsers(
  idToken: string,
  filterRole?: 'thoughtleader' | 'colaborador',
): Promise<{ users?: AnalyticsUser[]; error?: string }> {
  try {
    const caller = await requireAuth(idToken);

    if (caller.role !== 'admin' && caller.role !== 'master') {
      return { error: 'Acesso negado.' };
    }

    const companyId = caller.companyId;
    if (!companyId) return { error: 'Admin sem empresa associada.' };

    const roles = filterRole ? [filterRole] : ['thoughtleader', 'colaborador'];

    const snap = await adminDb
      .collection('users')
      .where('companyId', '==', companyId)
      .where('role', 'in', roles)
      .get();

    const users: AnalyticsUser[] = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.profile?.name ?? d.name ?? 'Sem nome',
        avatarUrl: d.profile?.avatarUrl ?? d.avatarUrl,
        role: d.role as 'thoughtleader' | 'colaborador',
        lastUploadMonth: d.linkedinSnapshotStatus?.lastUploadMonth,
      };
    });

    // Ordenar alfabético por nome dentro do grupo
    users.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return { users };
  } catch (err) {
    console.error('[linkedin-analytics] getCompanyAnalyticsUsers error:', err);
    return { error: 'Erro ao buscar usuários.' };
  }
}

/**
 * Deleta permanentemente um snapshot mensal do LinkedIn Analytics.
 * Apenas o próprio usuário pode deletar seus snapshots.
 * Atualiza linkedinSnapshotStatus.lastUploadMonth para o mês anterior disponível.
 */
export async function deleteLinkedInSnapshot(
  idToken: string,
  userId: string,
  mesAno: string,
): Promise<{ success?: boolean; newLastMonth?: string | null; error?: string }> {
  try {
    const caller = await requireAuth(idToken);

    // Apenas o próprio usuário pode deletar
    if (caller.uid !== userId) {
      return { error: 'Acesso negado: apenas o próprio usuário pode excluir seus uploads.' };
    }

    const snapshotRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('linkedinSnapshots')
      .doc(mesAno);

    const existing = await snapshotRef.get();
    if (!existing.exists) {
      return { error: 'Snapshot não encontrado.' };
    }

    // Deletar o snapshot
    await snapshotRef.delete();

    // Limpar campos analytics dos posts do contentPipeline que vieram deste snapshot.
    // Sem isso, métricas "fantasma" do upload deletado continuariam aparecendo no
    // Calendário e Feed mesmo após a remoção do snapshot.
    const pipelineSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('contentPipeline')
      .where('analyticsUpdatedAt', '!=', null)
      .get();

    if (!pipelineSnap.empty) {
      const { FieldValue } = await import('firebase-admin/firestore');
      const clearWrites = pipelineSnap.docs.map(doc =>
        doc.ref.update({
          analyticsImpressions: FieldValue.delete(),
          analyticsReactions:   FieldValue.delete(),
          analyticsEngagement:  FieldValue.delete(),
          analyticsUpdatedAt:   FieldValue.delete(),
        })
      );
      await Promise.all(clearWrites);
      console.log(`[deleteSnapshot] limpou métricas de ${clearWrites.length} posts no contentPipeline`);
    }

    // Buscar o mês mais recente que ainda existe para atualizar o status
    const remaining = await adminDb
      .collection('users')
      .doc(userId)
      .collection('linkedinSnapshots')
      .get();

    const remainingMonths = remaining.docs.map(d => d.id).sort((a, b) => b.localeCompare(a));
    const newLastMonth = remainingMonths[0] ?? null;

    await adminDb.collection('users').doc(userId).update({
      'linkedinSnapshotStatus.lastUploadMonth': newLastMonth ?? '',
      'linkedinSnapshotStatus.lastUploadAt': new Date().toISOString(),
    });

    return { success: true, newLastMonth };
  } catch (err) {
    console.error('[linkedin-analytics] deleteLinkedInSnapshot error:', err);
    return { error: 'Erro ao excluir snapshot. Tente novamente.' };
  }
}

/**
 * Atualiza o plano de ação de um TL para o mês especificado.
 * Apenas estrategista com acesso ao TL pode chamar.
 */
export async function updateActionPlan(
  idToken: string,
  tlUserId: string,
  mesAno: string,
  items: ActionPlanItem[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireStrategistForTL(idToken, tlUserId);

    const caller = await requireAuth(idToken);

    const snapshotRef = adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('linkedinSnapshots')
      .doc(mesAno);

    const existing = await snapshotRef.get();
    if (!existing.exists) {
      return { error: 'Snapshot não encontrado para este mês.' };
    }

    await snapshotRef.update({
      actionPlan: {
        updatedAt: new Date().toISOString(),
        updatedBy: caller.uid,
        items,
      },
    });

    return { success: true };
  } catch (err) {
    console.error('[linkedin-analytics] updateActionPlan error:', err);
    return { error: 'Erro ao salvar plano de ação.' };
  }
}

/**
 * Marca ou desmarca um item do plano de ação como concluído.
 * Apenas o próprio TL pode chamar.
 */
export async function toggleActionPlanItem(
  idToken: string,
  tlUserId: string,
  mesAno: string,
  itemId: string,
  completed: boolean,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const caller = await requireAuth(idToken);

    if (caller.uid !== tlUserId) {
      return { error: 'Acesso negado: apenas o próprio thought leader pode marcar itens.' };
    }

    const snapshotRef = adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('linkedinSnapshots')
      .doc(mesAno);

    const snap = await snapshotRef.get();
    if (!snap.exists) return { error: 'Snapshot não encontrado.' };

    const data = snap.data() as LinkedInSnapshot;
    const items = data.actionPlan?.items ?? [];

    const updatedItems = items.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        completed,
        completedAt: completed ? new Date().toISOString() : undefined,
      };
    });

    await snapshotRef.update({
      'actionPlan.items': updatedItems,
    });

    return { success: true };
  } catch (err) {
    console.error('[linkedin-analytics] toggleActionPlanItem error:', err);
    return { error: 'Erro ao atualizar item.' };
  }
}

// ---------------------------------------------------------------------------
// ICP-Fit Score — duas camadas
// ---------------------------------------------------------------------------

/**
 * CAMADA 1 — IA extrai dicionário de match do targetAudience (texto livre).
 *
 * Resultado salvo em companies/{companyId}.icpDefinition para reutilização.
 * Só é recalculado se o targetAudience mudar (comparamos via hash simples).
 */
async function getOrExtractIcpDefinition(
  companyId: string,
  targetAudience: string,
): Promise<IcpDefinition | null> {
  const compRef = adminDb.collection('companies').doc(companyId);
  const compDoc = await compRef.get();
  const existing = compDoc.data()?.icpDefinition as IcpDefinition | undefined;

  // Hash simples: primeiros 200 chars do targetAudience (suficiente para detectar mudanças)
  const fingerprint = targetAudience.trim().slice(0, 200);

  // Se já existe definição extraída do mesmo targetAudience, reutiliza
  if (existing && existing.extractedFrom === fingerprint) {
    return existing;
  }

  // Chama IA para extrair o dicionário estruturado de keywords de match
  const prompt = `Você é um especialista em LinkedIn Analytics B2B.

Seu trabalho é extrair, a partir de uma descrição textual de ICP (Ideal Customer Profile), listas de palavras-chave que serão usadas para fazer match automático com dados demográficos do LinkedIn Analytics.

## Descrição do ICP (texto livre do time de estratégia):
"${targetAudience}"

## Contexto importante:
Os dados demográficos do LinkedIn usam os seguintes formatos reais:
- Cargos: títulos como aparecem no LinkedIn ("CEO", "Fundador", "Diretor de Marketing", "VP de Vendas", "Head de Produto", "Gerente Sênior", "Analista de RH", etc.)
- Setores: nomes de setores como "Tecnologia da Informação e Serviços", "Marketing e Publicidade", "Varejo", "Serviços Financeiros", "Recursos Humanos", etc.
- Tamanhos: exatamente nos formatos do LinkedIn: "1-10 funcionários", "11-50 funcionários", "51-200 funcionários", "201-500 funcionários", "501-1000 funcionários", "1001-5000 funcionários", "5001-10000 funcionários", "Mais de 10001 funcionários"

## Tarefa:
Expanda a descrição do ICP em listas de palavras-chave de match para cada categoria.

REGRAS:
- Para cargos: inclua variações e sinônimos reais que aparecem no LinkedIn (ex: "líderes de marketing" → ["CMO", "VP de Marketing", "Diretor de Marketing", "Head de Marketing", "Gerente de Marketing Sênior"])
- Para setores: inclua variações do nome exato como aparece no LinkedIn
- Para tamanhos: use EXATAMENTE os formatos do LinkedIn listados acima
- Seja abrangente mas preciso — prefira incluir variações legítimas a deixar match falhar por diferença de escrita
- Se o ICP não especificar uma categoria (ex: não menciona tamanho), retorne lista vazia para ela

Responda EXATAMENTE neste formato JSON (sem markdown, sem explicações extras):
{
  "cargos": ["<cargo1>", "<cargo2>", ...],
  "setores": ["<setor1>", "<setor2>", ...],
  "tamanhos": ["<tamanho1>", "<tamanho2>", ...]
}`;

  try {
    const { text } = await ai.generate(prompt);
    const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(clean) as { cargos: string[]; setores: string[]; tamanhos: string[] };

    if (!Array.isArray(parsed.cargos) || !Array.isArray(parsed.setores) || !Array.isArray(parsed.tamanhos)) {
      console.error('[getOrExtractIcpDefinition] Resposta inesperada da IA:', text);
      return null;
    }

    const definition: IcpDefinition = {
      cargos: parsed.cargos,
      setores: parsed.setores,
      tamanhos: parsed.tamanhos,
      extractedFrom: fingerprint,
      extractedAt: new Date().toISOString(),
    };

    // Salva na empresa para reutilização futura
    await compRef.update({ icpDefinition: definition }).catch(() => {});

    return definition;
  } catch (err) {
    console.error('[getOrExtractIcpDefinition] Erro:', err);
    return null;
  }
}

/**
 * CAMADA 2 — Score determinístico.
 *
 * Dado o dicionário de match (IcpDefinition) e os dados demográficos do XLSX,
 * calcula o score por categoria somando as porcentagens dos labels que fizeram match.
 *
 * Match: case-insensitive, verifica se o label do XLSX contém alguma keyword do ICP
 * ou se a keyword do ICP contém o label do XLSX (matching bidirecional parcial).
 *
 * Score da categoria = soma das porcentagens dos itens que fizeram match, limitado a 100.
 * Overall = média ponderada: Cargo (40%) + Setor (35%) + Tamanho (25%).
 */
function computeDeterministicScore(
  demographics: Array<{ category: string; label: string; percentage: number }>,
  definition: IcpDefinition,
): IcpFitScore {
  // Agrupar dados demográficos por categoria
  const byCategory: Record<string, Array<{ label: string; percentage: number }>> = {};
  for (const d of demographics) {
    if (!byCategory[d.category]) byCategory[d.category] = [];
    byCategory[d.category].push({ label: d.label, percentage: d.percentage });
  }

  // Helper: verifica se um label do XLSX faz match com qualquer keyword do ICP
  function matchesAny(label: string, keywords: string[]): boolean {
    const labelLow = label.toLowerCase();
    return keywords.some(kw => {
      const kwLow = kw.toLowerCase();
      // Match bidirecional parcial: label contém keyword OU keyword contém label
      return labelLow.includes(kwLow) || kwLow.includes(labelLow);
    });
  }

  // Helper: calcula score e matched labels para uma categoria
  function calcCategory(
    rawCategory: string, // ex: "Cargo", "Setor", "Tamanho da empresa"
    keywords: string[],
    displayName: string,
    insight_match: string,
    insight_no_data: string,
    insight_low: string,
  ): IcpFitScore['categories'][number] {
    const items = byCategory[rawCategory] ?? [];

    if (items.length === 0 || keywords.length === 0) {
      return {
        category: displayName,
        score: 0,
        insight: keywords.length === 0
          ? 'ICP não especifica esta categoria.'
          : insight_no_data,
        matchedLabels: [],
        matchedPct: 0,
      };
    }

    const matched = items.filter(i => matchesAny(i.label, keywords));
    const matchedPct = Math.min(100, matched.reduce((sum, i) => sum + i.percentage, 0));
    const score = Math.round(matchedPct);

    const matchedLabels = matched
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5)
      .map(i => `${i.label} (${i.percentage}%)`);

    let insight: string;
    if (score >= 70) {
      insight = insight_match.replace('{pct}', `${score}%`).replace('{labels}', matchedLabels.slice(0, 3).join(', '));
    } else if (score >= 30) {
      insight = `Fit parcial — ${score}% da audiência bate com o ICP. ${matchedLabels.length > 0 ? `Destaque: ${matchedLabels[0]}.` : ''}`;
    } else if (score > 0) {
      insight = insight_low.replace('{pct}', `${score}%`);
    } else {
      insight = 'Nenhum item encontrado com match no ICP desta categoria.';
    }

    return { category: displayName, score, insight, matchedLabels: matched.map(i => i.label), matchedPct };
  }

  const cargoResult = calcCategory(
    'Cargo',
    definition.cargos,
    'Cargo & Senioridade',
    '{pct} da audiência está em cargos do ICP: {labels}.',
    'Dados de cargo não disponíveis no snapshot.',
    'Apenas {pct} da audiência está em cargos do ICP — maioria fora do perfil desejado.',
  );

  const setorResult = calcCategory(
    'Setor',
    definition.setores,
    'Setor',
    '{pct} da audiência está nos setores-alvo: {labels}.',
    'Dados de setor não disponíveis no snapshot.',
    'Apenas {pct} da audiência é dos setores-alvo — audiência predominantemente de outros mercados.',
  );

  const tamanhoResult = calcCategory(
    'Tamanho da empresa',
    definition.tamanhos,
    'Tamanho da empresa',
    '{pct} da audiência trabalha em empresas do porte do ICP: {labels}.',
    'Dados de tamanho de empresa não disponíveis no snapshot.',
    'Apenas {pct} da audiência está em empresas do porte desejado.',
  );

  // Pesos: Cargo 40%, Setor 35%, Tamanho 25%
  // Se o ICP não especificou uma categoria (keywords vazias), redistribui peso
  const hasCargoKw = definition.cargos.length > 0;
  const hasSetorKw = definition.setores.length > 0;
  const hasTamanhoKw = definition.tamanhos.length > 0;
  const totalWeight = (hasCargoKw ? 40 : 0) + (hasSetorKw ? 35 : 0) + (hasTamanhoKw ? 25 : 0);

  const overall = totalWeight === 0
    ? 0
    : Math.round(
        ((hasCargoKw ? cargoResult.score * 40 : 0) +
         (hasSetorKw ? setorResult.score * 35 : 0) +
         (hasTamanhoKw ? tamanhoResult.score * 25 : 0)) / totalWeight,
      );

  // Summary textual determinístico
  const parts: string[] = [];
  if (cargoResult.score >= 50) parts.push(`${cargoResult.score}% da audiência está em cargos do ICP`);
  if (setorResult.score >= 50) parts.push(`${setorResult.score}% nos setores-alvo`);
  if (tamanhoResult.score >= 50) parts.push(`${tamanhoResult.score}% em empresas do porte desejado`);

  let summary: string;
  if (overall >= 70) {
    summary = `Audiência bem alinhada com o ICP. ${parts.join(', ')}. Score calculado com base no match direto entre os dados demográficos do LinkedIn e as keywords extraídas do ICP.`;
  } else if (overall >= 45) {
    summary = `Fit moderado com o ICP. ${parts.length > 0 ? parts.join(', ') + '.' : 'Parte da audiência está no perfil desejado, mas há espaço para melhora.'} Revise os pilares de conteúdo para atrair mais do público-alvo.`;
  } else {
    summary = `Audiência ainda distante do ICP definido. A maioria dos seguidores está fora dos cargos, setores ou portes de empresa desejados. Considere reavaliar a estratégia de conteúdo.`;
  }

  return {
    overall,
    categories: [cargoResult, setorResult, tamanhoResult],
    summary,
    computedAt: new Date().toISOString(),
    method: 'deterministic',
  };
}

/**
 * Calcula o ICP-Fit Score para um TL com base nos dados demográficos do snapshot
 * e no targetAudience definido no Brand Context da empresa.
 *
 * ARQUITETURA DE DUAS CAMADAS:
 * 1. IA extrai o dicionário de match (keywords por categoria) do targetAudience textual.
 *    Resultado salvo na empresa e reutilizado enquanto o targetAudience não mudar.
 * 2. Matemática pura: soma as porcentagens dos labels do XLSX que fazem match com as keywords.
 *    Score é 100% determinístico — mesmo XLSX sempre gera mesmo score.
 *
 * Cache: score já calculado é lido do snapshot (não recalcula na abertura da página).
 * Recálculo manual: forceRefresh=true força descarte do cache e novo cálculo.
 */
export async function getIcpFitScore(
  idToken: string,
  userId: string,
  mesAno: string,
  forceRefresh = false,
): Promise<{ score?: IcpFitScore | null; noTargetAudience?: boolean; error?: string }> {
  try {
    await requireSnapshotAccess(idToken, userId);

    // 1. Buscar snapshot mensal do período especificado
    const snapDoc = await adminDb
      .collection('users')
      .doc(userId)
      .collection('linkedinSnapshots')
      .doc(mesAno)
      .get();

    if (!snapDoc.exists) {
      return { score: null };
    }

    const snapshot = snapDoc.data() as LinkedInSnapshot;

    // 2. Retornar score em cache se já calculado (e não forçar recálculo)
    if (!forceRefresh && snapshot.icpFitScore) {
      return { score: snapshot.icpFitScore };
    }

    // 3. Buscar companyId e brandContext.targetAudience do usuário
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) return { error: 'Usuário não encontrado.' };

    const companyId = userDoc.data()?.companyId;
    if (!companyId) return { score: null };

    const compDoc = await adminDb.collection('companies').doc(companyId).get();
    if (!compDoc.exists) return { score: null };

    const brandContext = compDoc.data()?.brandContext || compDoc.data()?.branding || {};
    const targetAudience: string = brandContext.targetAudience || '';

    if (!targetAudience.trim()) {
      return { score: null, noTargetAudience: true };
    }

    // 4. CAMADA 1 — IA extrai (ou reutiliza) o dicionário de match do ICP
    const definition = await getOrExtractIcpDefinition(companyId, targetAudience);
    if (!definition) {
      return { error: 'Erro ao extrair definição do ICP. Tente novamente.' };
    }

    // 5. CAMADA 2 — Score determinístico com matemática pura
    const demographics = snapshot.demographics ?? [];
    const score = computeDeterministicScore(demographics, definition);

    // 6. Persistir o score no snapshot
    await snapDoc.ref.update({ icpFitScore: score }).catch(() => {});

    return { score };
  } catch (err) {
    console.error('[linkedin-analytics] getIcpFitScore error:', err);
    return { error: 'Erro ao calcular ICP-Fit Score.' };
  }
}
