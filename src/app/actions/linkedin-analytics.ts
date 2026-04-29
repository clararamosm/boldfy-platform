'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAuth, requireStrategistForTL } from '@/lib/auth-guard';
import { ai } from '@/ai/genkit';
import type {
  LinkedInSnapshot,
  ParsedLinkedInData,
  AnalyticsUser,
  ActionPlanItem,
  IcpFitScore,
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

/**
 * Calcula o ICP-Fit Score para um TL com base nos dados demográficos do snapshot
 * e no targetAudience definido no Brand Context da empresa.
 *
 * Retorna null para `score` se:
 * - O TL não tem snapshots mensais
 * - O Brand Context não tem targetAudience preenchido
 */
export async function getIcpFitScore(
  idToken: string,
  userId: string,
  mesAno: string,
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

    // 2. Buscar companyId e brandContext.targetAudience do usuário
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

    // 3. Preparar dados demográficos para o prompt
    const demographics = snapshot.demographics ?? [];

    // Agrupar por categoria
    const byCategory: Record<string, Array<{ label: string; percentage: number }>> = {};
    for (const d of demographics) {
      if (!byCategory[d.category]) byCategory[d.category] = [];
      byCategory[d.category].push({ label: d.label, percentage: d.percentage });
    }

    // Ordenar cada categoria por percentual desc, pegar top 8
    const demoSummary = Object.entries(byCategory)
      .map(([cat, items]) => {
        const top = items
          .sort((a, b) => b.percentage - a.percentage)
          .slice(0, 8)
          .map(i => `  ${i.label}: ${i.percentage}%`)
          .join('\n');
        return `${cat}:\n${top}`;
      })
      .join('\n\n');

    // 4. Chamar IA para calcular score
    const prompt = `Você é um especialista em estratégia de conteúdo B2B no LinkedIn.

Analise o fit entre a audiência real de um perfil no LinkedIn e o ICP (Ideal Customer Profile) da empresa.

## ICP da empresa (definido pelo time de estratégia):
${targetAudience}

## Audiência real do perfil (dados demográficos LinkedIn Analytics — mês ${mesAno}):
${demoSummary || 'Dados demográficos não disponíveis.'}

## Tarefa:
Calcule um ICP-Fit Score de 0 a 100 avaliando o quanto a audiência real bate com o ICP definido.

Considere:
- Cargo/função: os cargos mais presentes batem com os decisores e influenciadores do ICP?
- Setor: os setores presentes são os que a empresa quer atingir?
- Tamanho da empresa: os tamanhos de empresa correspondem ao mercado-alvo?
- Outros dados presentes (senioridade, localização etc.)

Responda EXATAMENTE neste formato JSON (sem markdown, sem explicações extras):
{
  "overall": <número 0-100>,
  "categories": [
    { "category": "Cargo", "score": <0-100>, "insight": "<uma frase curta em português>" },
    { "category": "Setor", "score": <0-100>, "insight": "<uma frase curta em português>" },
    { "category": "Tamanho da empresa", "score": <0-100>, "insight": "<uma frase curta em português>" }
  ],
  "summary": "<2-3 frases em português descrevendo o fit geral e principais gaps/acertos>"
}

Seja realista e preciso. Use os dados reais disponíveis. Se uma categoria não tiver dados, score = 0 com insight explicando.`;

    const { text } = await ai.generate(prompt);

    // 5. Parse da resposta JSON
    let parsed: { overall: number; categories: IcpFitScore['categories']; summary: string };
    try {
      // Remover possível markdown code fence
      const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error('[linkedin-analytics] getIcpFitScore JSON parse error. Response:', text);
      return { error: 'Erro ao interpretar resposta da IA.' };
    }

    // Validar estrutura básica
    if (typeof parsed.overall !== 'number' || !Array.isArray(parsed.categories)) {
      return { error: 'Resposta da IA em formato inesperado.' };
    }

    const score: IcpFitScore = {
      overall: Math.max(0, Math.min(100, Math.round(parsed.overall))),
      categories: parsed.categories.map(c => ({
        category: c.category,
        score: Math.max(0, Math.min(100, Math.round(c.score))),
        insight: c.insight,
      })),
      summary: parsed.summary,
      computedAt: new Date().toISOString(),
    };

    return { score };
  } catch (err) {
    console.error('[linkedin-analytics] getIcpFitScore error:', err);
    return { error: 'Erro ao calcular ICP-Fit Score.' };
  }
}
