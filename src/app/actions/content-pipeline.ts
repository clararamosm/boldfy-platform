// src/app/actions/content-pipeline.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth, requireStrategistForTL, requireAdminOrStrategist } from '@/lib/auth-guard';
import { triggerSlackNotification } from '@/lib/slack-notifications';
import { generateSlug } from '@/lib/slugify';

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

    // Fire-and-forget: Slack notification when status changes to pronto_pra_postar
    if (data.status === 'pronto_pra_postar') {
      const postTitle = data.title || docSnap.data()?.title || '';
      triggerSlackNotification('post_pronto', {
        tlUserId,
        postId,
        postTitle,
      }).catch(err => console.error('Slack post_pronto notification failed:', err));
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

    // Fire-and-forget: Slack notification for post ready
    const postTitle = docSnap.data()?.title || '';
    triggerSlackNotification('post_pronto', {
      tlUserId: user.uid,
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

    // Fire-and-forget: Slack notification for feedback received
    const postTitle = docSnap.data()?.title || '';
    triggerSlackNotification('feedback_recebido', {
      tlUserId: user.uid,
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
  slug: string;
  name: string;
  logoUrl?: string;
  tls: { id: string; slug: string; name: string }[];
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
      const compData = compDoc.data();
      const companyName = compData?.companyName || 'Empresa';
      const logoUrl = compData?.logoUrl as string | undefined;
      const companySlug = (compData?.slug as string) || generateSlug(companyName, companyId);

      const tlSnap = await adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'thoughtleader')
        .get();

      const tls = tlSnap.docs.map(d => {
        const tlData = d.data();
        const tlName = tlData.profile?.name || tlData.name || 'TL';
        const tlSlug = (tlData.slug as string) || generateSlug(tlName, d.id);
        return { id: d.id, slug: tlSlug, name: tlName };
      });
      tls.sort((a, b) => a.name.localeCompare(b.name));

      result.push({ id: companyId, slug: companySlug, name: companyName, logoUrl, tls });
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
    await requireAuth(idToken);

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

    // Resolve TL slug (if provided)
    let tlId: string | undefined;
    let tlName: string | undefined;
    if (tlSlug) {
      const tlSnap = await adminDb.collection('users')
        .where('slug', '==', tlSlug)
        .where('companyId', '==', companyId)
        .where('role', '==', 'thoughtleader')
        .limit(1)
        .get();

      if (!tlSnap.empty) {
        tlId = tlSnap.docs[0].id;
        tlName = tlSnap.docs[0].data().profile?.name || tlSnap.docs[0].data().name || '';
      } else {
        // Fallback: check if slug is actually a raw ID
        const directDoc = await adminDb.collection('users').doc(tlSlug).get();
        if (directDoc.exists && directDoc.data()?.role === 'thoughtleader') {
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

    const allPosts: CalendarPipelinePost[] = [];

    for (const companyId of assignedCompanies) {
      // Get company info
      const compDoc = await adminDb.collection('companies').doc(companyId).get();
      const compData = compDoc.data();
      const companyName = compData?.companyName || '';
      const companySlug = (compData?.slug as string) || generateSlug(companyName, companyId);

      // Get TLs in this company
      const tlSnap = await adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'thoughtleader')
        .get();

      for (const tlDoc of tlSnap.docs) {
        const tlData = tlDoc.data();
        const tlName = tlData.profile?.name || tlData.name || '';
        const tlSlug = (tlData.slug as string) || generateSlug(tlName, tlDoc.id);

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
            tlSlug,
            tlName,
            companyName,
            companyId,
            companySlug,
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
