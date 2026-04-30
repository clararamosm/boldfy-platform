'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAuth, requireStrategistForTL } from '@/lib/auth-guard';
import { ai } from '@/ai/genkit';
import { normalizeLinkedInUrl } from '@/lib/linkedin-xlsx-parser';
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
    };

    // Mapa primário: ID numérico do LinkedIn (via linkedinPostUrl) → enrichment
    const urlMap: Record<string, EnrichmentEntry> = {};

    // Mapa secundário: posts do mesmo mês sem linkedinPostUrl (fallback por data)
    const dateMap: Record<string, EnrichmentEntry[]> = {};

    for (const doc of pipelineSnap.docs) {
      const d = doc.data();
      const entry: EnrichmentEntry = {
        postId: doc.id,
        caption: (d.caption as string | undefined) ?? (d.title as string | undefined),
        mediaUrl: d.mediaUrl as string | undefined,
        format: d.formato as string | undefined,
        pillar: d.contentPillar as string | undefined,
      };

      const url = d.linkedinPostUrl as string | undefined;
      if (url) {
        // Match preciso via ID numérico do LinkedIn — compatível com urn:li:share e urn:li:activity
        const key = normalizeLinkedInUrl(url);
        console.log(`[enrich] pipeline doc=${doc.id} linkedinPostUrl="${url}" normalized="${key}"`);
        if (key) urlMap[key] = entry;
      } else {
        console.log(`[enrich] pipeline doc=${doc.id} sem linkedinPostUrl`);
      }

      // Sempre indexa por data também — fallback quando urn:li:activity (XLSX) ≠ urn:li:share (API)
      // Os dois tipos têm IDs numéricos diferentes para o mesmo post, então o URL match pode falhar.
      // O fallback por data é o único mecanismo confiável nesses casos.
      const publishedAt = d.publishedAt as string | undefined;
      if (publishedAt && publishedAt.startsWith(mesAno)) {
        const dayKey = publishedAt.substring(0, 10);
        console.log(`[enrich] pipeline doc=${doc.id} publishedAt=${publishedAt} → dateMap[${dayKey}]`);
        if (!dateMap[dayKey]) dateMap[dayKey] = [];
        dateMap[dayKey].push(entry);
      } else {
        console.log(`[enrich] pipeline doc=${doc.id} publishedAt="${publishedAt}" fora do mesAno=${mesAno}`);
      }
    }

    const topUrls = [
      ...(data.topPostsByEngagement ?? []),
      ...(data.topPostsByImpressions ?? []),
    ].map(p => normalizeLinkedInUrl(p.url));
    console.log(`[enrich] top post keys (normalized): ${JSON.stringify([...new Set(topUrls)])}`);
    console.log(`[enrich] urlMap keys: ${JSON.stringify(Object.keys(urlMap))}`);

    // Enriquecer cada top post — prioridade: match por URL > match por data.
    // Sempre tenta enriquecer (mesmo que já tenha caption) para garantir que
    // format e pillar sejam preenchidos quando disponíveis no pipeline.
    function enrichList(posts: typeof data.topPostsByEngagement) {
      return (posts ?? []).map(post => {
        // 1. Match exato por ID numérico do LinkedIn
        const key = normalizeLinkedInUrl(post.url);
        const byUrl = key ? urlMap[key] : undefined;
        if (byUrl) {
          console.log(`[enrich] ✓ URL match: post.url="${post.url}" → postId=${byUrl.postId}`);
          return { ...post, ...byUrl };
        }

        // 2. Fallback por data — quando urn:li:activity (XLSX) ≠ urn:li:share (API)
        // esses dois tipos têm IDs numéricos distintos, impossibilitando URL match.
        // Roda sempre que não temos postId (independente de caption/mediaUrl),
        // pois o objetivo é garantir que format e pillar sejam sempre preenchidos.
        if (!post.postId && post.date) {
          const candidates = dateMap[post.date];
          if (candidates?.length === 1) {
            console.log(`[enrich] ✓ date match (único): post.date="${post.date}" → postId=${candidates[0].postId}`);
            return { ...post, ...candidates[0] };
          }
          if (candidates && candidates.length > 1) {
            // Múltiplos posts no mesmo dia — pega o primeiro (melhor esforço)
            console.log(`[enrich] ~ date match (ambíguo, pegando primeiro): post.date="${post.date}" tem ${candidates.length} candidatos → postId=${candidates[0].postId}`);
            return { ...post, ...candidates[0] };
          }
          console.log(`[enrich] ✗ sem match: post.url="${post.url}" date="${post.date}" — nenhum candidato`);
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

IMPORTANTE: Faça uma leitura CONTEXTUAL CRUZADA entre as categorias — não avalie cada uma de forma isolada.

Exemplos de leitura contextual:
- "Fundador" + empresa de "1-10 funcionários" = decisor solo de alta influência → peso elevado se o ICP busca PMEs
- "Analista" ou "Especialista" + empresa grande = influenciador, não decisor final → relevante se o ICP inclui influenciadores
- "Diretor" + setor fora do ICP = cargo ideal mas mercado errado → score médio
- "Gerente" + senioridade "Sênior" = mais poder decisório do que "Gerente Júnior" mesmo com mesmo cargo
- Volume alto de um setor não-alvo pode diluir o fit mesmo com cargos corretos

Avalie:
1. **Cargo × Senioridade** — o nível hierárquico real bate com os decisores e influenciadores do ICP? (Senioridade diferencia o poder de decisão mesmo para o mesmo título)
2. **Setor** — os setores presentes são os que a empresa quer atingir?
3. **Tamanho da empresa × Cargo** — o porte das empresas corresponde ao mercado-alvo? Um fundador em startup é diferente de um gerente em enterprise.
4. **Leitura integrada** — considerando tudo junto, a audiência tende a ser decisores, influenciadores ou ruído para o ICP?

Responda EXATAMENTE neste formato JSON (sem markdown, sem explicações extras):
{
  "overall": <número 0-100>,
  "categories": [
    { "category": "Cargo & Senioridade", "score": <0-100>, "insight": "<uma frase curta em português cruzando cargo e nível de experiência>" },
    { "category": "Setor", "score": <0-100>, "insight": "<uma frase curta em português>" },
    { "category": "Tamanho da empresa", "score": <0-100>, "insight": "<uma frase curta em português>" }
  ],
  "summary": "<2-3 frases em português com a leitura contextual integrada: quem domina a audiência, se são decisores/influenciadores do ICP, e o principal gap ou acerto>"
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

    // Persistir o score no snapshot para que o dashboard possa ler sem recalcular
    await snapDoc.ref.update({ icpFitScore: score }).catch(() => {
      // Falha silenciosa — o score ainda é retornado corretamente
    });

    return { score };
  } catch (err) {
    console.error('[linkedin-analytics] getIcpFitScore error:', err);
    return { error: 'Erro ao calcular ICP-Fit Score.' };
  }
}
