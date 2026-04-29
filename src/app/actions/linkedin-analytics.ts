'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAuth, requireStrategistForTL } from '@/lib/auth-guard';
import type {
  LinkedInSnapshot,
  ParsedLinkedInData,
  AnalyticsUser,
  ActionPlanItem,
} from '@/lib/linkedin-analytics-types';

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
    const allTopPosts = [
      ...(data.topPostsByEngagement ?? []),
      ...(data.topPostsByImpressions ?? []),
    ];

    // Buscar todos os posts do contentPipeline com linkedinPostUrl
    const pipelineSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('contentPipeline')
      .where('status', '==', 'postado')
      .get();

    const pipelineMap: Record<string, {
      postId: string;
      caption?: string;
      mediaUrl?: string;
      format?: string;
      pillar?: string;
    }> = {};

    for (const doc of pipelineSnap.docs) {
      const d = doc.data();
      const url = d.linkedinPostUrl as string | undefined;
      if (!url) continue;
      // Extrair urn:li:activity:XXXXX para normalização
      const match = url.match(/urn:li:activity:\d+/);
      const key = match ? match[0] : url.trim();
      pipelineMap[key] = {
        postId: doc.id,
        caption: d.caption ?? d.title,
        mediaUrl: d.mediaUrl,
        format: d.format,
        pillar: d.pillar,
      };
    }

    if (Object.keys(pipelineMap).length === 0) return;

    // Enriquecer cada top post
    function enrichList(posts: typeof data.topPostsByEngagement) {
      return posts.map(post => {
        const match = post.url.match(/urn:li:activity:\d+/);
        const key = match ? match[0] : post.url.trim();
        const enrichment = pipelineMap[key];
        if (!enrichment) return post;
        return { ...post, ...enrichment };
      });
    }

    await snapshotRef.update({
      topPostsByEngagement: enrichList(data.topPostsByEngagement ?? []),
      topPostsByImpressions: enrichList(data.topPostsByImpressions ?? []),
    });
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

    // Apenas o próprio usuário pode fazer upload
    if (caller.uid !== userId && caller.role !== 'master') {
      return { error: 'Acesso negado: apenas o próprio usuário pode fazer upload.' };
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

    // Enriquecimento assíncrono — não bloqueia o retorno
    enrichSnapshotWithPostData(userId, mesAno).catch(() => {});

    return { success: true, mesAno };
  } catch (err) {
    console.error('[linkedin-analytics] uploadLinkedInSnapshot error:', err);
    return { error: 'Erro ao salvar snapshot. Tente novamente.' };
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

    return { snapshot: doc.data() as LinkedInSnapshot };
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
 * Retorna todos os usuários da empresa que publicam no LinkedIn (para filtro do /admin/analytics).
 */
export async function getCompanyAnalyticsUsers(
  idToken: string,
): Promise<{ users?: AnalyticsUser[]; error?: string }> {
  try {
    const caller = await requireAuth(idToken);

    if (caller.role !== 'admin' && caller.role !== 'master') {
      return { error: 'Acesso negado.' };
    }

    const companyId = caller.companyId;
    if (!companyId) return { error: 'Admin sem empresa associada.' };

    const snap = await adminDb
      .collection('users')
      .where('companyId', '==', companyId)
      .where('role', 'in', ['thoughtleader', 'colaborador'])
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

    // Ordenar: TLs primeiro, depois colaboradores; dentro de cada grupo, alfabético
    users.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'thoughtleader' ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    return { users };
  } catch (err) {
    console.error('[linkedin-analytics] getCompanyAnalyticsUsers error:', err);
    return { error: 'Erro ao buscar usuários.' };
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
