// src/app/actions/content-pipeline.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, requireStrategistForTL, requireAdminOrStrategist, requireAdminForTL, type AuthUser } from '@/lib/auth-guard';
import { requireActiveModule, requireActiveModuleForCompany } from '@/lib/billing/module-gate';
import { triggerSlackNotification } from '@/lib/slack-notifications';
import { generateSlug } from '@/lib/slugify';
import { notifyPostReadyForReview } from '@/lib/notifications';

// ---- Helper: resolver companyId de um TL (1 round trip) ----

async function getCompanyIdOfTL(tlUserId: string): Promise<string | null> {
  const doc = await adminDb.collection('users').doc(tlUserId).get();
  if (!doc.exists) return null;
  const cid = doc.data()?.companyId;
  return typeof cid === 'string' && cid ? cid : null;
}

// ---- Types ----

export type PipelineStatus =
  | 'backlog'
  | 'aprovar_ideia'
  | 'em_producao'
  | 'aprovar_post'
  | 'post_aprovado'
  | 'pronto_pra_postar'
  | 'agendado'
  | 'postado'
  | 'ajuste'
  | 'arquivado';

export type PipelinePost = {
  id: string;
  title: string;
  caption: string;
  scheduledFor: string | null;
  status: PipelineStatus;
  editorial: string;
  etapa: string;
  formato: string;
  leadMagnet: boolean;
  contentPillar?: string;
  // Media singular (legado / primeira midia da galeria)
  mediaUrl?: string;
  mediaType?: string;
  // Multi-image gallery (rodada 6): arrays paralelos pra galerias de
  // ate 10 imagens. Quando preenchidos, sobrescrevem mediaUrl/mediaType
  // na hora de publicar. PDF/video/GIF sempre singular em mediaUrl/mediaType.
  mediaUrls?: string[];
  mediaTypes?: string[];
  // Título customizado do PDF/carrossel — só faz sentido quando mediaType ===
  // 'application/pdf'. Vai como content.media.title no payload do LinkedIn e
  // aparece como nome visível do carrossel na timeline. Ausente/vazio cai no
  // fallback 'Documento'.
  documentTitle?: string;
  // Capa do PDF (página 1 renderizada em PNG no upload, client-side). Usada
  // como preview do carrossel no calendário. Só faz sentido quando a mídia
  // é PDF — cascade no update apaga junto com o documentTitle. PDFs anexados
  // antes desse campo existirem não têm capa (fallback: ícone no card).
  pdfThumbUrl?: string;
  tlFeedback?: string;
  tlApprovedAt?: string;
  // Auditoria: quem destravou a última transição de aprovação/ajuste.
  // Quando o próprio TL aprova, actorRole === 'thoughtleader'. Quando o admin
  // da empresa aprova no lugar do líder, actorRole === 'admin' (etc).
  approvedById?: string;
  approvedByName?: string;
  approvedByRole?: 'thoughtleader' | 'admin' | 'strategist' | 'master';
  linkedinPostId?: string;
  linkedinPostUrl?: string;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Métricas do LinkedIn Analytics (preenchidas pelo enrichment do XLSX)
  analyticsImpressions?: number;
  analyticsReactions?: number;
  analyticsEngagement?: number;
  analyticsUpdatedAt?: string; // ISO timestamp da última vez que as métricas foram atualizadas
};

type ActionResult = {
  success?: boolean;
  error?: string;
  postId?: string;
};

// ---- Helper: get pipeline collection path ----

function getPipelinePath(tlUserId: string) {
  return `users/${tlUserId}/contentPipeline`;
}

// ---- Create Pipeline Post (Strategist only) ----

export async function createPipelinePost(
  idToken: string,
  tlUserId: string,
  data: {
    title: string;
    caption?: string;
    scheduledFor?: string | null;
    status?: PipelineStatus;
    editorial?: string;
    etapa?: string;
    formato?: string;
    leadMagnet?: boolean;
    contentPillar?: string;
  }
): Promise<ActionResult> {
  try {
    const user = await requireStrategistForTL(idToken, tlUserId);

    // Gate granular: empresa do TL precisa ter modulo TL ativo (ou estar em beta/legacy).
    // requireActiveModuleForCompany ja cobre billing.tl; legacy gate foi removido.
    const tlCompanyId = await getCompanyIdOfTL(tlUserId);
    if (tlCompanyId) {
      await requireActiveModuleForCompany(tlCompanyId, 'tl');
    }

    const now = new Date().toISOString();
    const postData = {
      title: data.title || '',
      caption: data.caption || '',
      scheduledFor: data.scheduledFor || null,
      status: data.status || 'backlog',
      editorial: data.editorial || '',
      etapa: data.etapa || '',
      formato: data.formato || '',
      leadMagnet: data.leadMagnet || false,
      contentPillar: data.contentPillar || '',
      mediaUrl: null,
      mediaType: null,
      tlFeedback: null,
      tlApprovedAt: null,
      linkedinPostId: null,
      linkedinPostUrl: null,
      publishedAt: null,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection(getPipelinePath(tlUserId)).add(postData);

    return { success: true, postId: docRef.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in createPipelinePost:', msg);
    return { error: msg };
  }
}

// ---- Create Pipeline Idea (Thought Leader only) ----

export async function createPipelineIdea(
  idToken: string,
  title: string,
): Promise<ActionResult> {
  try {
    const user = await requireAuth(idToken);
    if (user.role !== 'thoughtleader') {
      return { error: 'Apenas Thought Leaders podem adicionar ideias.' };
    }
    // requireActiveModule cobre billing.tl; legacy gate foi removido.
    await requireActiveModule(user, 'tl');

    const now = new Date().toISOString();
    const postData = {
      title: title.trim() || 'Ideia sem titulo',
      caption: '',
      scheduledFor: null,
      status: 'backlog' as PipelineStatus,
      editorial: '',
      etapa: '',
      formato: '',
      leadMagnet: false,
      contentPillar: '',
      mediaUrl: null,
      mediaType: null,
      tlFeedback: null,
      tlApprovedAt: null,
      linkedinPostId: null,
      linkedinPostUrl: null,
      publishedAt: null,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await adminDb.collection(getPipelinePath(user.uid)).add(postData);

    return { success: true, postId: docRef.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in createPipelineIdea:', msg);
    return { error: msg };
  }
}

// ---- Update Pipeline Post (Strategist only) ----

export async function updatePipelinePost(
  idToken: string,
  tlUserId: string,
  postId: string,
  data: Partial<{
    title: string;
    caption: string;
    scheduledFor: string | null;
    status: PipelineStatus;
    editorial: string;
    etapa: string;
    formato: string;
    leadMagnet: boolean;
    contentPillar: string;
    mediaUrl: string | null;
    mediaType: string | null;
    mediaUrls: string[] | null;
    mediaTypes: string[] | null;
    documentTitle: string | null;
    pdfThumbUrl: string | null;
  }>
): Promise<ActionResult> {
  try {
    await requireStrategistForTL(idToken, tlUserId);

    // Gate modulo TL no tenant do TL.
    const tlCompanyId = await getCompanyIdOfTL(tlUserId);
    if (tlCompanyId) {
      await requireActiveModuleForCompany(tlCompanyId, 'tl');
    }

    const docRef = adminDb.collection(getPipelinePath(tlUserId)).doc(postId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return { error: 'Post não encontrado.' };
    }

    // Multi-image: quando mediaUrls vem no payload, sincroniza mediaUrl/
    // mediaType pra apontar pra primeira midia (retrocompat com leitores).
    // Quando array tem so 1 item, prefere singular e apaga o array — mantem
    // shape consistente.
    const updatePayload: Record<string, unknown> = { ...data };
    // Primeira mídia depois desse update — usado pra decidir se o documentTitle
    // continua fazendo sentido (só vale pra PDF).
    let firstTypeAfterUpdate: string | null | undefined;
    if (Array.isArray(data.mediaUrls)) {
      const urls = data.mediaUrls;
      const types = Array.isArray(data.mediaTypes) ? data.mediaTypes : [];
      if (urls.length === 0) {
        updatePayload.mediaUrl = null;
        updatePayload.mediaType = null;
        updatePayload.mediaUrls = FieldValue.delete();
        updatePayload.mediaTypes = FieldValue.delete();
        firstTypeAfterUpdate = null;
      } else if (urls.length === 1) {
        updatePayload.mediaUrl = urls[0];
        updatePayload.mediaType = types[0] ?? null;
        updatePayload.mediaUrls = FieldValue.delete();
        updatePayload.mediaTypes = FieldValue.delete();
        firstTypeAfterUpdate = types[0] ?? null;
      } else {
        updatePayload.mediaUrl = urls[0];
        updatePayload.mediaType = types[0] ?? null;
        updatePayload.mediaUrls = urls;
        updatePayload.mediaTypes = types;
        firstTypeAfterUpdate = types[0] ?? null;
      }
    } else if (data.mediaType !== undefined) {
      firstTypeAfterUpdate = data.mediaType;
    }

    // documentTitle: só faz sentido com PDF.
    //  - Caller mandou string vazia → apaga (FieldValue.delete).
    //  - Caller mandou com conteúdo → trim + grava.
    //  - Caller passou null explícito → apaga.
    //  - Caller não passou + mídia atual não é PDF → apaga título residual.
    if (data.documentTitle !== undefined) {
      if (data.documentTitle === null) {
        updatePayload.documentTitle = FieldValue.delete();
      } else {
        const trimmed = data.documentTitle.trim();
        updatePayload.documentTitle = trimmed ? trimmed : FieldValue.delete();
      }
    } else if (firstTypeAfterUpdate !== undefined && firstTypeAfterUpdate !== 'application/pdf') {
      updatePayload.documentTitle = FieldValue.delete();
    }

    // pdfThumbUrl: mesma regra em cascata do documentTitle — só existe
    // enquanto a mídia for PDF.
    if (data.pdfThumbUrl !== undefined) {
      updatePayload.pdfThumbUrl = data.pdfThumbUrl === null
        ? FieldValue.delete()
        : data.pdfThumbUrl;
    } else if (firstTypeAfterUpdate !== undefined && firstTypeAfterUpdate !== 'application/pdf') {
      updatePayload.pdfThumbUrl = FieldValue.delete();
    }
    updatePayload.updatedAt = new Date().toISOString();

    await docRef.update(updatePayload);

    // Fire-and-forget: Slack notification when status changes to pronto_pra_postar
    if (data.status === 'pronto_pra_postar') {
      const postTitle = data.title || docSnap.data()?.title || '';
      triggerSlackNotification('post_pronto', {
        tlUserId,
        postId,
        postTitle,
      }).catch(err => console.error('Slack post_pronto notification failed:', err));
    }

    // Notify TL by email when post moves to aprovar_post (ready for TL review)
    if (data.status === 'aprovar_post') {
      const postTitle = data.title || docSnap.data()?.title || '';
      notifyPostReadyForReview({
        tlUserId,
        postTitle,
      }).catch(err => console.error('[Notification] notifyPostReadyForReview failed:', err));
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in updatePipelinePost:', msg);
    return { error: msg };
  }
}

// ---- Delete Pipeline Post (Strategist only) ----

export async function deletePipelinePost(
  idToken: string,
  tlUserId: string,
  postId: string
): Promise<ActionResult> {
  try {
    await requireStrategistForTL(idToken, tlUserId);

    const docRef = adminDb.collection(getPipelinePath(tlUserId)).doc(postId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return { error: 'Post não encontrado.' };
    }

    await docRef.delete();
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in deletePipelinePost:', msg);
    return { error: msg };
  }
}

// ---- Get Pipeline Posts for a TL (Strategist, Admin, or TL themselves) ----

export async function getPipelinePosts(
  idToken: string,
  tlUserId: string,
  statusFilter?: PipelineStatus | null
): Promise<{ posts?: PipelinePost[]; error?: string }> {
  try {
    const user = await requireAuth(idToken);

    // Access check: TL can see their own, admin of same company, strategist assigned, master
    if (user.role === 'master') {
      // OK
    } else if (user.uid === tlUserId) {
      // TL viewing their own pipeline — OK
    } else if (user.role === 'strategist') {
      await requireStrategistForTL(idToken, tlUserId);
    } else if (user.role === 'admin') {
      // Admin can see TLs of their own company
      const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
      if (!tlDoc.exists || tlDoc.data()?.companyId !== user.companyId) {
        return { error: 'Acesso negado.' };
      }
    } else {
      return { error: 'Acesso negado.' };
    }

    let queryRef: FirebaseFirestore.Query = adminDb.collection(getPipelinePath(tlUserId));
    if (statusFilter) {
      queryRef = queryRef.where('status', '==', statusFilter);
    }
    queryRef = queryRef.orderBy('createdAt', 'desc');

    const snap = await queryRef.get();
    const posts: PipelinePost[] = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PipelinePost[];

    return { posts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getPipelinePosts:', msg);
    return { error: msg };
  }
}

// ---- Helper: resolver o ator de uma ação de aprovação/ajuste ----
// Define em qual pipeline (tlUserId) a ação acontece e quem é o ator.
//  - thoughtleader: age só no próprio pipeline (tlUserId = uid).
//  - admin: age sobre TLs da PRÓPRIA empresa (requireAdminForTL valida).
//  - master: age sobre qualquer TL.
// Strategist NÃO aprova (mantém o comportamento atual — ele move via update).
async function resolvePostActor(
  idToken: string,
  tlUserId?: string
): Promise<{ user: AuthUser; tlUserId: string }> {
  const user = await requireAuth(idToken);

  if (user.role === 'thoughtleader') {
    if (tlUserId && tlUserId !== user.uid) {
      throw new Error('Acesso negado.');
    }
    return { user, tlUserId: user.uid };
  }

  if (user.role === 'master') {
    return { user, tlUserId: tlUserId || user.uid };
  }

  if (user.role === 'admin') {
    if (!tlUserId) throw new Error('Thought Leader não especificado.');
    await requireAdminForTL(idToken, tlUserId);
    return { user, tlUserId };
  }

  throw new Error('Acesso negado: permissão para aprovar/ajustar necessária.');
}

// authorRole de auditoria a partir do role do ator.
function auditRole(role?: string): 'thoughtleader' | 'admin' | 'strategist' | 'master' {
  if (role === 'admin') return 'admin';
  if (role === 'master') return 'master';
  if (role === 'strategist') return 'strategist';
  return 'thoughtleader';
}

// Grava um comentário de sistema ("Boldfy Bot") registrando a ação.
// Fire-and-forget: falha aqui não deve quebrar a transição de status.
async function writeBotAuditComment(tlUserId: string, postId: string, content: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await adminDb
      .collection(getPipelinePath(tlUserId))
      .doc(postId)
      .collection('comments')
      .doc()
      .set({
        authorId: 'system',
        authorName: 'Boldfy Bot',
        authorRole: 'strategist',
        content,
        resolved: false,
        createdAt: now,
        updatedAt: now,
        anchor: null,
      });
  } catch (err) {
    console.error('writeBotAuditComment failed:', err);
  }
}

// Sufixo da mensagem do bot — destaca quando NÃO foi o próprio líder.
function actorSuffix(role?: string, name?: string): string {
  const who = name || 'Usuário';
  if (role === 'admin') return ` por ${who} (admin, no lugar do líder)`;
  if (role === 'master') return ` por ${who} (Boldfy)`;
  return ` por ${who}`;
}

// ---- TL/Admin Actions: Approve Idea ----

export async function approvePipelineIdea(
  idToken: string,
  postId: string,
  tlUserId?: string
): Promise<ActionResult> {
  try {
    const { user, tlUserId: tlId } = await resolvePostActor(idToken, tlUserId);

    const tlCompanyId = await getCompanyIdOfTL(tlId);
    if (tlCompanyId) {
      await requireActiveModuleForCompany(tlCompanyId, 'tl');
    }

    const collPath = getPipelinePath(tlId);
    const docRef = adminDb.collection(collPath).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post não encontrado.' };
    }

    const currentStatus = docSnap.data()?.status;
    if (currentStatus !== 'aprovar_ideia') {
      return { error: 'Este post não está aguardando aprovação de ideia.' };
    }

    const now = new Date().toISOString();
    await docRef.update({
      status: 'em_producao',
      tlApprovedAt: now,
      approvedById: user.uid,
      approvedByName: user.name || 'Usuário',
      approvedByRole: auditRole(user.role),
      updatedAt: now,
    });

    await writeBotAuditComment(tlId, postId, `Ideia aprovada${actorSuffix(user.role, user.name)}.`);

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in approvePipelineIdea:', msg);
    return { error: msg };
  }
}

// ---- TL Actions: Approve Post ----

export async function approvePipelinePost(
  idToken: string,
  postId: string,
  tlUserId?: string
): Promise<ActionResult> {
  try {
    const { user, tlUserId: tlId } = await resolvePostActor(idToken, tlUserId);

    const tlCompanyId = await getCompanyIdOfTL(tlId);
    if (tlCompanyId) {
      await requireActiveModuleForCompany(tlCompanyId, 'tl');
    }

    const collPath = getPipelinePath(tlId);
    const docRef = adminDb.collection(collPath).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post não encontrado.' };
    }

    const currentStatus = docSnap.data()?.status;
    if (currentStatus !== 'aprovar_post') {
      return { error: 'Este post não está aguardando aprovação.' };
    }

    // Approve post → auto-advance to pronto_pra_postar
    const now = new Date().toISOString();
    await docRef.update({
      status: 'pronto_pra_postar',
      tlApprovedAt: now,
      approvedById: user.uid,
      approvedByName: user.name || 'Usuário',
      approvedByRole: auditRole(user.role),
      updatedAt: now,
    });

    await writeBotAuditComment(tlId, postId, `Post aprovado${actorSuffix(user.role, user.name)}.`);

    // Fire-and-forget: Slack notification for post ready
    const postTitle = docSnap.data()?.title || '';
    triggerSlackNotification('post_pronto', {
      tlUserId: tlId,
      postId,
      postTitle,
    }).catch(err => console.error('Slack post_pronto notification failed:', err));

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in approvePipelinePost:', msg);
    return { error: msg };
  }
}

// ---- TL Actions: Request Adjustment ----

export async function requestPipelineAdjustment(
  idToken: string,
  postId: string,
  feedback: string,
  tlUserId?: string
): Promise<ActionResult> {
  try {
    const { user, tlUserId: tlId } = await resolvePostActor(idToken, tlUserId);

    const collPath = getPipelinePath(tlId);
    const docRef = adminDb.collection(collPath).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post não encontrado.' };
    }

    const currentStatus = docSnap.data()?.status;
    if (currentStatus !== 'aprovar_ideia' && currentStatus !== 'aprovar_post') {
      return { error: 'Este post não está em etapa de aprovação.' };
    }

    await docRef.update({
      status: 'ajuste',
      tlFeedback: feedback,
      updatedAt: new Date().toISOString(),
    });

    await writeBotAuditComment(tlId, postId, `Ajuste solicitado${actorSuffix(user.role, user.name)}.`);

    // Fire-and-forget: Slack notification for feedback received
    const postTitle = docSnap.data()?.title || '';
    triggerSlackNotification('feedback_recebido', {
      tlUserId: tlId,
      postId,
      postTitle,
      feedbackText: feedback,
    }).catch(err => console.error('Slack feedback_recebido notification failed:', err));

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in requestPipelineAdjustment:', msg);
    return { error: msg };
  }
}

// ---- Strategist: Move post back from ajuste ----

export async function resolvePipelineAdjustment(
  idToken: string,
  tlUserId: string,
  postId: string,
  newStatus: 'aprovar_ideia' | 'aprovar_post'
): Promise<ActionResult> {
  try {
    await requireStrategistForTL(idToken, tlUserId);

    const docRef = adminDb.collection(getPipelinePath(tlUserId)).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post não encontrado.' };
    }

    const currentStatus = docSnap.data()?.status;
    if (currentStatus !== 'ajuste') {
      return { error: 'Este post não está com status de ajuste.' };
    }

    await docRef.update({
      status: newStatus,
      tlFeedback: null,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in resolvePipelineAdjustment:', msg);
    return { error: msg };
  }
}

// ---- Strategist: Mark post as Published ----

export async function markPipelinePostPublished(
  idToken: string,
  tlUserId: string,
  postId: string,
  linkedinData?: { linkedinPostId?: string; linkedinPostUrl?: string }
): Promise<ActionResult> {
  try {
    await requireStrategistForTL(idToken, tlUserId);

    const tlCompanyId = await getCompanyIdOfTL(tlUserId);
    if (tlCompanyId) {
      await requireActiveModuleForCompany(tlCompanyId, 'tl');
    }

    const docRef = adminDb.collection(getPipelinePath(tlUserId)).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post não encontrado.' };
    }

    await docRef.update({
      status: 'postado',
      publishedAt: new Date().toISOString(),
      linkedinPostId: linkedinData?.linkedinPostId || null,
      linkedinPostUrl: linkedinData?.linkedinPostUrl || null,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in markPipelinePostPublished:', msg);
    return { error: msg };
  }
}

// ---- Sidebar data for Strategist (server-side, bypasses rules) ----

export type StrategistSidebarCompany = {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  tls: { id: string; slug: string; name: string; photoUrl?: string; linkedinConnected?: boolean }[];
};

export async function getStrategistSidebarData(
  idToken: string
): Promise<{ companies?: StrategistSidebarCompany[]; error?: string }> {
  try {
    const user = await requireAuth(idToken);
    if (user.role !== 'strategist' && user.role !== 'master') {
      return { error: 'Acesso negado.' };
    }

    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const assignedCompanies = (userDoc.data()?.assignedCompanies as string[]) || [];

    if (assignedCompanies.length === 0) return { companies: [] };

    // Parallel fetch: all companies + all TLs for those companies at once
    const [companyDocs, allTlSnap] = await Promise.all([
      Promise.all(assignedCompanies.map(cId => adminDb.collection('companies').doc(cId).get())),
      // Single query for all TLs across assigned companies (avoids N+1)
      adminDb.collection('users')
        .where('companyId', 'in', assignedCompanies.slice(0, 30)) // Firestore 'in' limit: 30
        .where('role', '==', 'thoughtleader')
        .get(),
    ]);

    // Group TLs by companyId
    const tlsByCompany = new Map<string, { id: string; slug: string; name: string; photoUrl?: string; linkedinConnected?: boolean }[]>();
    allTlSnap.docs.forEach(d => {
      const tlData = d.data();
      const cId = tlData.companyId as string;
      const tlName = tlData.profile?.name || tlData.name || 'TL';
      const tlSlug = (tlData.slug as string) || generateSlug(tlName, d.id);
      const photoUrl = (tlData.photoURL as string) || (tlData.profile?.avatarUrl as string) || undefined;
      const linkedinConnected = !!(tlData.linkedinConnection as Record<string, unknown>)?.accessToken;
      if (!tlsByCompany.has(cId)) tlsByCompany.set(cId, []);
      tlsByCompany.get(cId)!.push({ id: d.id, slug: tlSlug, name: tlName, photoUrl, linkedinConnected });
    });

    const result: StrategistSidebarCompany[] = [];

    for (const compDoc of companyDocs) {
      if (!compDoc.exists) continue;
      const compData = compDoc.data();
      const companyName = compData?.companyName || 'Empresa';
      const logoUrl = compData?.logoUrl as string | undefined;
      const companySlug = (compData?.slug as string) || generateSlug(companyName, compDoc.id);

      const tls = tlsByCompany.get(compDoc.id) || [];
      tls.sort((a, b) => a.name.localeCompare(b.name));

      result.push({ id: compDoc.id, slug: companySlug, name: companyName, logoUrl, tls });
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return { companies: result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getStrategistSidebarData:', msg);
    return { error: msg };
  }
}

// ---- Resolve slugs to Firestore IDs ----

export async function resolveSlugs(
  idToken: string,
  companySlug: string,
  tlSlug?: string
): Promise<{ companyId?: string; tlId?: string; tlName?: string; error?: string }> {
  try {
    const user = await requireAuth(idToken);

    // TL/colaborador can only resolve slugs for their own company
    if (user.role === 'thoughtleader' || user.role === 'colaborador') {
      // They can only access their own company's slugs — validated below after resolving
    } else if (user.role !== 'strategist' && user.role !== 'master' && user.role !== 'admin') {
      return { error: 'Acesso negado.' };
    }

    // Resolve company slug
    let companyId: string | undefined;
    const companySnap = await adminDb.collection('companies')
      .where('slug', '==', companySlug)
      .limit(1)
      .get();

    if (!companySnap.empty) {
      companyId = companySnap.docs[0].id;
    } else {
      // Fallback: check if slug is actually a raw ID
      const directDoc = await adminDb.collection('companies').doc(companySlug).get();
      if (directDoc.exists) {
        companyId = companySlug;
      }
    }

    if (!companyId) return { error: 'Empresa não encontrada.' };

    // TL/colaborador can only resolve their own company
    if ((user.role === 'thoughtleader' || user.role === 'colaborador') && user.companyId !== companyId) {
      return { error: 'Acesso negado.' };
    }

    // Resolve TL slug (if provided)
    let tlId: string | undefined;
    let tlName: string | undefined;
    if (tlSlug) {
      const tlSnap = await adminDb.collection('users')
        .where('slug', '==', tlSlug)
        .where('companyId', '==', companyId)
        .where('role', 'in', ['thoughtleader', 'colaborador'])
        .limit(1)
        .get();

      if (!tlSnap.empty) {
        tlId = tlSnap.docs[0].id;
        tlName = tlSnap.docs[0].data().profile?.name || tlSnap.docs[0].data().name || '';
      } else {
        // Fallback: check if slug is actually a raw ID
        const directDoc = await adminDb.collection('users').doc(tlSlug).get();
        const directRole = directDoc.data()?.role;
        if (directDoc.exists && (directRole === 'thoughtleader' || directRole === 'colaborador')) {
          tlId = tlSlug;
          tlName = directDoc.data()?.profile?.name || directDoc.data()?.name || '';
        }
      }

      if (!tlId) return { companyId, error: 'Thought Leader não encontrado.' };
    }

    return { companyId, tlId, tlName };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    return { error: msg };
  }
}

// ---- Calendar-oriented: Get ALL pipeline posts for a Strategist ----

export type CalendarPipelinePost = PipelinePost & {
  tlUserId: string;
  tlSlug: string;
  tlName: string;
  tlPhotoUrl?: string;
  tlLinkedinConnected?: boolean;
  companyName: string;
  companyId: string;
  companySlug: string;
};

export async function getAllPipelinePostsForStrategist(
  idToken: string
): Promise<{ posts?: CalendarPipelinePost[]; error?: string }> {
  try {
    const user = await requireAuth(idToken);
    if (user.role !== 'strategist' && user.role !== 'master') {
      return { error: 'Acesso negado.' };
    }

    // Get assigned companies
    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const assignedCompanies = (userDoc.data()?.assignedCompanies as string[]) || [];

    if (assignedCompanies.length === 0) return { posts: [] };

    // Step 1: Parallel fetch companies + all TLs in one batch (avoids N+1)
    const [companyDocs, allTlSnap] = await Promise.all([
      Promise.all(assignedCompanies.map(cId => adminDb.collection('companies').doc(cId).get())),
      adminDb.collection('users')
        .where('companyId', 'in', assignedCompanies.slice(0, 30))
        .where('role', '==', 'thoughtleader')
        .get(),
    ]);

    // Build company info map
    const companyMap = new Map<string, { name: string; slug: string }>();
    for (const compDoc of companyDocs) {
      if (!compDoc.exists) continue;
      const compData = compDoc.data();
      const name = compData?.companyName || '';
      companyMap.set(compDoc.id, {
        name,
        slug: (compData?.slug as string) || generateSlug(name, compDoc.id),
      });
    }

    // Step 2: Parallel fetch pipeline posts for ALL TLs at once
    const tlInfoList = allTlSnap.docs.map(d => {
      const tlData = d.data();
      const tlName = tlData.profile?.name || tlData.name || '';
      return {
        id: d.id,
        name: tlName,
        slug: (tlData.slug as string) || generateSlug(tlName, d.id),
        companyId: tlData.companyId as string,
        photoUrl: (tlData.photoURL as string) || (tlData.profile?.avatarUrl as string) || undefined,
        linkedinConnected: !!(tlData.linkedinConnection as Record<string, unknown>)?.accessToken,
      };
    });

    const pipelineSnapshots = await Promise.all(
      tlInfoList.map(tl =>
        adminDb.collection(getPipelinePath(tl.id))
          .orderBy('createdAt', 'desc')
          .get()
          .then(snap => ({ tl, snap }))
      )
    );

    // Step 3: Assemble results
    const allPosts: CalendarPipelinePost[] = [];

    for (const { tl, snap } of pipelineSnapshots) {
      const company = companyMap.get(tl.companyId);
      if (!company) continue;

      for (const postDoc of snap.docs) {
        allPosts.push({
          id: postDoc.id,
          ...(postDoc.data() as Omit<PipelinePost, 'id'>),
          tlUserId: tl.id,
          tlSlug: tl.slug,
          tlName: tl.name,
          tlPhotoUrl: tl.photoUrl,
          tlLinkedinConnected: tl.linkedinConnected,
          companyName: company.name,
          companyId: tl.companyId,
          companySlug: company.slug,
        });
      }
    }

    return { posts: allPosts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getAllPipelinePostsForStrategist:', msg);
    return { error: msg };
  }
}

// ---- Dashboard: Recent activities for a Strategist ----

export type Activity = {
  type: 'comment' | 'status_change' | 'approval' | 'published';
  authorName: string;
  authorRole: 'strategist' | 'thoughtleader' | 'admin' | 'master';
  content: string;
  postTitle: string;
  postId: string;
  tlUserId: string;
  companySlug: string;
  tlSlug: string;
  createdAt: string;
  /** For status_change activities */
  status?: string;
};

export async function getRecentActivitiesForStrategist(
  idToken: string
): Promise<{ activities?: Activity[]; error?: string }> {
  try {
    const user = await requireAuth(idToken);
    if (user.role !== 'strategist' && user.role !== 'master') {
      return { error: 'Acesso negado.' };
    }

    const userDoc = await adminDb.collection('users').doc(user.uid).get();
    const assignedCompanies = (userDoc.data()?.assignedCompanies as string[]) || [];

    if (assignedCompanies.length === 0) return { activities: [] };

    // Parallel fetch companies + TLs
    const [companyDocs, allTlSnap] = await Promise.all([
      Promise.all(assignedCompanies.map(cId => adminDb.collection('companies').doc(cId).get())),
      adminDb.collection('users')
        .where('companyId', 'in', assignedCompanies.slice(0, 30))
        .where('role', '==', 'thoughtleader')
        .get(),
    ]);

    // Build company info map
    const companyMap = new Map<string, { name: string; slug: string }>();
    for (const compDoc of companyDocs) {
      if (!compDoc.exists) continue;
      const compData = compDoc.data();
      const name = compData?.companyName || '';
      companyMap.set(compDoc.id, {
        name,
        slug: (compData?.slug as string) || generateSlug(name, compDoc.id),
      });
    }

    const tlInfoList = allTlSnap.docs.map(d => {
      const tlData = d.data();
      const tlName = tlData.profile?.name || tlData.name || '';
      return {
        id: d.id,
        name: tlName,
        slug: (tlData.slug as string) || generateSlug(tlName, d.id),
        companyId: tlData.companyId as string,
      };
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const allActivities: Activity[] = [];

    // Fetch recent posts for each TL
    const postSnapshots = await Promise.all(
      tlInfoList.map(tl =>
        adminDb.collection(getPipelinePath(tl.id))
          .orderBy('updatedAt', 'desc')
          .limit(20)
          .get()
          .then(snap => ({ tl, snap }))
      )
    );

    // Status labels for activity descriptions
    const statusLabels: Record<string, string> = {
      aprovar_ideia: 'Aprovar Ideia',
      em_producao: 'Em Produção',
      aprovar_post: 'Aprovar Post',
      post_aprovado: 'Aprovado',
      pronto_pra_postar: 'Pronto pra Postar',
      agendado: 'Agendado',
      postado: 'Postado',
      ajuste: 'Ajuste',
    };

    // For each TL's posts, fetch comments + track status changes
    const commentFetches: Promise<void>[] = [];

    for (const { tl, snap } of postSnapshots) {
      const company = companyMap.get(tl.companyId);
      if (!company) continue;

      for (const postDoc of snap.docs) {
        const postData = postDoc.data();
        const postTitle = postData.title || (postData.caption?.slice(0, 40) as string) || 'Sem titulo';
        const updatedAt = (postData.updatedAt as string) || '';
        const status = (postData.status as string) || '';

        // Track notable status changes as activities (updated in last 7 days)
        if (updatedAt >= sevenDaysAgo && status !== 'backlog' && status !== 'arquivado') {
          // Post approved by TL
          if (postData.tlApprovedAt && (postData.tlApprovedAt as string) >= sevenDaysAgo) {
            allActivities.push({
              type: 'approval',
              authorName: tl.name,
              authorRole: 'thoughtleader',
              content: `Aprovou o post`,
              postTitle,
              postId: postDoc.id,
              tlUserId: tl.id,
              companySlug: company.slug,
              tlSlug: tl.slug,
              createdAt: postData.tlApprovedAt as string,
              status,
            });
          }

          // Post published
          if (status === 'postado' && postData.publishedAt && (postData.publishedAt as string) >= sevenDaysAgo) {
            allActivities.push({
              type: 'published',
              authorName: tl.name,
              authorRole: 'thoughtleader',
              content: `Post publicado no LinkedIn`,
              postTitle,
              postId: postDoc.id,
              tlUserId: tl.id,
              companySlug: company.slug,
              tlSlug: tl.slug,
              createdAt: postData.publishedAt as string,
              status,
            });
          }

          // Status changes (agendado, pronto_pra_postar, em_producao, etc)
          if (!postData.tlApprovedAt && !postData.publishedAt && ['agendado', 'pronto_pra_postar', 'em_producao', 'aprovar_post', 'aprovar_ideia', 'ajuste'].includes(status)) {
            allActivities.push({
              type: 'status_change',
              authorName: tl.name,
              authorRole: 'strategist',
              content: `Status: ${statusLabels[status] || status}`,
              postTitle,
              postId: postDoc.id,
              tlUserId: tl.id,
              companySlug: company.slug,
              tlSlug: tl.slug,
              createdAt: updatedAt,
              status,
            });
          }
        }

        // Fetch comments
        commentFetches.push(
          adminDb.collection(getPipelinePath(tl.id))
            .doc(postDoc.id)
            .collection('comments')
            .where('createdAt', '>=', sevenDaysAgo)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get()
            .then(commentSnap => {
              for (const commentDoc of commentSnap.docs) {
                const c = commentDoc.data();
                allActivities.push({
                  type: 'comment',
                  authorName: (c.authorName as string) || 'Usuario',
                  authorRole: (c.authorRole as 'strategist' | 'thoughtleader') || 'strategist',
                  content: (c.content as string) || '',
                  postTitle,
                  postId: postDoc.id,
                  tlUserId: tl.id,
                  companySlug: company.slug,
                  tlSlug: tl.slug,
                  createdAt: (c.createdAt as string) || '',
                });
              }
            })
        );
      }
    }

    await Promise.all(commentFetches);

    // Sort by createdAt desc, limit 15
    allActivities.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { activities: allActivities.slice(0, 15) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getRecentActivitiesForStrategist:', msg);
    return { error: msg };
  }
}

// ============================================================================
// MODO EXECUTIVO (ADMIN) — leituras escopadas à própria empresa do admin
// O admin enxerga só os Thought Leaders onde tl.companyId === admin.companyId.
// ============================================================================

export type AdminExecutiveTL = {
  id: string;
  slug: string;
  name: string;
  photoUrl?: string;
  linkedinConnected?: boolean;
};

// Helper interno: resolve a empresa do admin e lista os TLs dela.
async function getAdminCompanyAndTLs(
  user: AuthUser
): Promise<{ companyId: string; companyName: string; companySlug: string; tls: AdminExecutiveTL[] } | null> {
  if (!user.companyId) return null;

  const [companyDoc, tlSnap] = await Promise.all([
    adminDb.collection('companies').doc(user.companyId).get(),
    adminDb.collection('users')
      .where('companyId', '==', user.companyId)
      .where('role', '==', 'thoughtleader')
      .get(),
  ]);

  const compData = companyDoc.exists ? companyDoc.data() : undefined;
  const companyName = compData?.companyName || 'Empresa';
  const companySlug = (compData?.slug as string) || generateSlug(companyName, user.companyId);

  const tls: AdminExecutiveTL[] = tlSnap.docs.map(d => {
    const tlData = d.data();
    const tlName = tlData.profile?.name || tlData.name || 'TL';
    return {
      id: d.id,
      slug: (tlData.slug as string) || generateSlug(tlName, d.id),
      name: tlName,
      photoUrl: (tlData.photoURL as string) || (tlData.profile?.avatarUrl as string) || undefined,
      linkedinConnected: !!(tlData.linkedinConnection as Record<string, unknown>)?.accessToken,
    };
  });

  tls.sort((a, b) => a.name.localeCompare(b.name));

  return { companyId: user.companyId, companyName, companySlug, tls };
}

// Sidebar do Modo Executivo do admin: lista dos executivos da própria empresa.
export async function getAdminExecutiveData(
  idToken: string
): Promise<{ companyName?: string; companySlug?: string; tls?: AdminExecutiveTL[]; error?: string }> {
  try {
    const user = await requireAuth(idToken);
    if (user.role !== 'admin' && user.role !== 'master') {
      return { error: 'Acesso negado.' };
    }

    const info = await getAdminCompanyAndTLs(user);
    if (!info) return { tls: [] };

    return { companyName: info.companyName, companySlug: info.companySlug, tls: info.tls };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getAdminExecutiveData:', msg);
    return { error: msg };
  }
}

// Calendário/Backlog consolidado: todos os posts de todos os TLs da empresa do admin.
export async function getAllPipelinePostsForAdmin(
  idToken: string
): Promise<{ posts?: CalendarPipelinePost[]; error?: string }> {
  try {
    const user = await requireAuth(idToken);
    if (user.role !== 'admin' && user.role !== 'master') {
      return { error: 'Acesso negado.' };
    }

    const info = await getAdminCompanyAndTLs(user);
    if (!info || info.tls.length === 0) return { posts: [] };

    const pipelineSnapshots = await Promise.all(
      info.tls.map(tl =>
        adminDb.collection(getPipelinePath(tl.id))
          .orderBy('createdAt', 'desc')
          .get()
          .then(snap => ({ tl, snap }))
      )
    );

    const allPosts: CalendarPipelinePost[] = [];
    for (const { tl, snap } of pipelineSnapshots) {
      for (const postDoc of snap.docs) {
        allPosts.push({
          id: postDoc.id,
          ...(postDoc.data() as Omit<PipelinePost, 'id'>),
          tlUserId: tl.id,
          tlSlug: tl.slug,
          tlName: tl.name,
          tlPhotoUrl: tl.photoUrl,
          tlLinkedinConnected: tl.linkedinConnected,
          companyName: info.companyName,
          companyId: info.companyId,
          companySlug: info.companySlug,
        });
      }
    }

    return { posts: allPosts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getAllPipelinePostsForAdmin:', msg);
    return { error: msg };
  }
}
