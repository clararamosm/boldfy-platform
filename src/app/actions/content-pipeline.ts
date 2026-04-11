// src/app/actions/content-pipeline.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, requireStrategistForTL, requireAdminOrStrategist } from '@/lib/auth-guard';

// ---- Types ----

export type PipelineStatus =
  | 'backlog'
  | 'aprovar_ideia'
  | 'em_producao'
  | 'aprovar_post'
  | 'post_aprovado'
  | 'pronto_pra_postar'
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
  mediaUrl?: string;
  mediaType?: string;
  tlFeedback?: string;
  tlApprovedAt?: string;
  linkedinPostId?: string;
  linkedinPostUrl?: string;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  }>
): Promise<ActionResult> {
  try {
    await requireStrategistForTL(idToken, tlUserId);

    const docRef = adminDb.collection(getPipelinePath(tlUserId)).doc(postId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return { error: 'Post nao encontrado.' };
    }

    await docRef.update({
      ...data,
      updatedAt: new Date().toISOString(),
    });

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
      return { error: 'Post nao encontrado.' };
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

// ---- TL Actions: Approve Idea ----

export async function approvePipelineIdea(
  idToken: string,
  postId: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth(idToken);

    if (user.role !== 'thoughtleader' && user.role !== 'master') {
      return { error: 'Apenas o Thought Leader pode aprovar ideias.' };
    }

    const collPath = getPipelinePath(user.uid);
    const docRef = adminDb.collection(collPath).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post nao encontrado.' };
    }

    const currentStatus = docSnap.data()?.status;
    if (currentStatus !== 'aprovar_ideia') {
      return { error: 'Este post nao esta aguardando aprovacao de ideia.' };
    }

    await docRef.update({
      status: 'em_producao',
      tlApprovedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

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
  postId: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth(idToken);

    if (user.role !== 'thoughtleader' && user.role !== 'master') {
      return { error: 'Apenas o Thought Leader pode aprovar posts.' };
    }

    const collPath = getPipelinePath(user.uid);
    const docRef = adminDb.collection(collPath).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post nao encontrado.' };
    }

    const currentStatus = docSnap.data()?.status;
    if (currentStatus !== 'aprovar_post') {
      return { error: 'Este post nao esta aguardando aprovacao.' };
    }

    // Approve post → auto-advance to pronto_pra_postar
    await docRef.update({
      status: 'pronto_pra_postar',
      tlApprovedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

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
  feedback: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth(idToken);

    if (user.role !== 'thoughtleader' && user.role !== 'master') {
      return { error: 'Apenas o Thought Leader pode solicitar ajustes.' };
    }

    const collPath = getPipelinePath(user.uid);
    const docRef = adminDb.collection(collPath).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post nao encontrado.' };
    }

    const currentStatus = docSnap.data()?.status;
    if (currentStatus !== 'aprovar_ideia' && currentStatus !== 'aprovar_post') {
      return { error: 'Este post nao esta em etapa de aprovacao.' };
    }

    await docRef.update({
      status: 'ajuste',
      tlFeedback: feedback,
      updatedAt: new Date().toISOString(),
    });

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
      return { error: 'Post nao encontrado.' };
    }

    const currentStatus = docSnap.data()?.status;
    if (currentStatus !== 'ajuste') {
      return { error: 'Este post nao esta com status de ajuste.' };
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

    const docRef = adminDb.collection(getPipelinePath(tlUserId)).doc(postId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return { error: 'Post nao encontrado.' };
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
  name: string;
  tls: { id: string; name: string }[];
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

    const result: StrategistSidebarCompany[] = [];

    for (const companyId of assignedCompanies) {
      const compDoc = await adminDb.collection('companies').doc(companyId).get();
      if (!compDoc.exists) continue;
      const companyName = compDoc.data()?.companyName || 'Empresa';

      const tlSnap = await adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'thoughtleader')
        .get();

      const tls = tlSnap.docs.map(d => ({
        id: d.id,
        name: d.data().profile?.name || d.data().name || 'TL',
      }));
      tls.sort((a, b) => a.name.localeCompare(b.name));

      result.push({ id: companyId, name: companyName, tls });
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    return { companies: result };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getStrategistSidebarData:', msg);
    return { error: msg };
  }
}

// ---- Calendar-oriented: Get ALL pipeline posts for a Strategist ----

export type CalendarPipelinePost = PipelinePost & {
  tlUserId: string;
  tlName: string;
  companyName: string;
  companyId: string;
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

    const allPosts: CalendarPipelinePost[] = [];

    for (const companyId of assignedCompanies) {
      // Get company name
      const compDoc = await adminDb.collection('companies').doc(companyId).get();
      const companyName = compDoc.data()?.companyName || '';

      // Get TLs in this company
      const tlSnap = await adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'thoughtleader')
        .get();

      for (const tlDoc of tlSnap.docs) {
        const tlData = tlDoc.data();
        const tlName = tlData.profile?.name || tlData.name || '';

        // Get pipeline posts for this TL
        const postsSnap = await adminDb
          .collection(getPipelinePath(tlDoc.id))
          .orderBy('createdAt', 'desc')
          .get();

        for (const postDoc of postsSnap.docs) {
          allPosts.push({
            id: postDoc.id,
            ...(postDoc.data() as Omit<PipelinePost, 'id'>),
            tlUserId: tlDoc.id,
            tlName,
            companyName,
            companyId,
          });
        }
      }
    }

    return { posts: allPosts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getAllPipelinePostsForStrategist:', msg);
    return { error: msg };
  }
}
