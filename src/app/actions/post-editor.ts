// src/app/actions/post-editor.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAuth } from '@/lib/auth-guard';
import type { PostComment, PostVersion } from '@/lib/post-editor-types';
import type { PipelinePost } from '@/app/actions/content-pipeline';

// ---- Auth Helper: shared access for strategist + TL ----

async function requirePostAccess(idToken: string, tlUserId: string) {
  const user = await requireAuth(idToken);

  if (user.role === 'master') {
    return { ...user, canEdit: true };
  }

  // TL can only access their own posts (read-only)
  if (user.uid === tlUserId && (user.role === 'thoughtleader' || user.role === 'colaborador')) {
    return { ...user, canEdit: false };
  }

  // Strategist must be assigned to TL's company
  if (user.role === 'strategist') {
    const tlDoc = await adminDb.collection('users').doc(tlUserId).get();
    if (!tlDoc.exists) throw new Error('Thought Leader não encontrado.');

    const tlCompanyId = tlDoc.data()?.companyId;
    if (!tlCompanyId) throw new Error('Thought Leader sem empresa vinculada.');

    const strategistDoc = await adminDb.collection('users').doc(user.uid).get();
    const assignedCompanies = strategistDoc.data()?.assignedCompanies as string[] | undefined;
    if (!assignedCompanies?.includes(tlCompanyId)) {
      throw new Error('Acesso negado: você não está atribuído à empresa deste Thought Leader.');
    }

    return { ...user, canEdit: true };
  }

  throw new Error('Acesso negado.');
}

// ---- Get Post with Access ----

export async function getPostWithAccess(
  idToken: string,
  tlUserId: string,
  postId: string
): Promise<{
  post?: PipelinePost;
  canEdit?: boolean;
  userName?: string;
  companyName?: string;
  tlName?: string;
  error?: string;
}> {
  try {
    const user = await requirePostAccess(idToken, tlUserId);

    // Fetch post and TL user doc in parallel
    const [postDoc, tlDoc] = await Promise.all([
      adminDb.collection('users').doc(tlUserId).collection('contentPipeline').doc(postId).get(),
      adminDb.collection('users').doc(tlUserId).get(),
    ]);

    if (!postDoc.exists) {
      return { error: 'Post não encontrado.' };
    }

    // Resolve TL name and company name for breadcrumb
    const tlData = tlDoc.data();
    const tlName = tlData?.name || tlData?.displayName || 'Thought Leader';
    const tlCompanyId = tlData?.companyId as string | undefined;
    let companyName = 'Empresa';
    if (tlCompanyId) {
      const companyDoc = await adminDb.collection('companies').doc(tlCompanyId).get();
      companyName = companyDoc.data()?.companyName || companyName;
    }

    const data = postDoc.data()!;
    const post: PipelinePost = {
      id: postDoc.id,
      title: data.title || '',
      caption: data.caption || '',
      scheduledFor: data.scheduledFor || null,
      status: data.status || 'backlog',
      editorial: data.editorial || '',
      etapa: data.etapa || '',
      formato: data.formato || '',
      leadMagnet: data.leadMagnet || false,
      contentPillar: data.contentPillar,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      tlFeedback: data.tlFeedback,
      tlApprovedAt: data.tlApprovedAt,
      linkedinPostId: data.linkedinPostId,
      linkedinPostUrl: data.linkedinPostUrl,
      publishedAt: data.publishedAt,
      createdBy: data.createdBy || '',
      createdAt: data.createdAt || '',
      updatedAt: data.updatedAt || '',
    };

    return { post, canEdit: user.canEdit, userName: user.name || 'Usuário', companyName, tlName };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao carregar post.';
    return { error: msg };
  }
}

// ---- Save Post with Version Snapshot ----

export async function savePostWithVersion(
  idToken: string,
  tlUserId: string,
  postId: string,
  data: { title: string; caption: string }
): Promise<{ success?: boolean; error?: string; versionId?: string }> {
  try {
    const user = await requirePostAccess(idToken, tlUserId);
    if (!user.canEdit) return { error: 'Sem permissão para editar.' };

    const postRef = adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .doc(postId);

    // Check current content — only create version if changed
    const currentDoc = await postRef.get();
    if (!currentDoc.exists) return { error: 'Post não encontrado.' };

    const current = currentDoc.data()!;
    const titleChanged = current.title !== data.title;
    const captionChanged = current.caption !== data.caption;

    if (!titleChanged && !captionChanged) {
      return { success: true }; // Nothing to save
    }

    const now = new Date().toISOString();

    // Create version snapshot of PREVIOUS state
    const versionRef = postRef.collection('versions').doc();
    const version: Omit<PostVersion, 'id'> = {
      title: current.title || '',
      caption: current.caption || '',
      savedBy: user.uid,
      savedByName: user.name || 'Estrategista',
      createdAt: now,
    };

    // Batch: update post + create version
    const batch = adminDb.batch();
    batch.update(postRef, {
      title: data.title,
      caption: data.caption,
      updatedAt: now,
    });
    batch.set(versionRef, version);
    await batch.commit();

    return { success: true, versionId: versionRef.id };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao salvar post.';
    return { error: msg };
  }
}

// ---- Get Post Versions ----

export async function getPostVersions(
  idToken: string,
  tlUserId: string,
  postId: string
): Promise<{ versions?: PostVersion[]; error?: string }> {
  try {
    await requirePostAccess(idToken, tlUserId);

    const snap = await adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .doc(postId)
      .collection('versions')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const versions: PostVersion[] = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PostVersion[];

    return { versions };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao carregar versões.';
    return { error: msg };
  }
}

// ---- Restore Post Version ----

export async function restorePostVersion(
  idToken: string,
  tlUserId: string,
  postId: string,
  versionId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requirePostAccess(idToken, tlUserId);
    if (!user.canEdit) return { error: 'Sem permissão para editar.' };

    const postRef = adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .doc(postId);

    // Get the version to restore
    const versionDoc = await postRef.collection('versions').doc(versionId).get();
    if (!versionDoc.exists) return { error: 'Versão não encontrada.' };
    const versionData = versionDoc.data()!;

    // Get current state to save as version before overwriting
    const currentDoc = await postRef.get();
    if (!currentDoc.exists) return { error: 'Post não encontrado.' };
    const current = currentDoc.data()!;

    const now = new Date().toISOString();

    // Save current state as a new version (so nothing is lost)
    const backupVersionRef = postRef.collection('versions').doc();
    const backupVersion: Omit<PostVersion, 'id'> = {
      title: current.title || '',
      caption: current.caption || '',
      savedBy: user.uid,
      savedByName: user.name || 'Estrategista',
      createdAt: now,
    };

    // Batch: save current as version + restore old content
    const batch = adminDb.batch();
    batch.set(backupVersionRef, backupVersion);
    batch.update(postRef, {
      title: versionData.title,
      caption: versionData.caption,
      updatedAt: now,
    });
    await batch.commit();

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao restaurar versão.';
    return { error: msg };
  }
}

// ---- Add Comment ----

export async function addPostComment(
  idToken: string,
  tlUserId: string,
  postId: string,
  content: string,
  anchor?: PostComment['anchor']
): Promise<{ success?: boolean; error?: string; comment?: PostComment }> {
  try {
    const user = await requirePostAccess(idToken, tlUserId);

    if (!content.trim()) return { error: 'Comentário não pode ser vazio.' };

    const postRef = adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .doc(postId);

    // Verify post exists
    const postDoc = await postRef.get();
    if (!postDoc.exists) return { error: 'Post não encontrado.' };

    const now = new Date().toISOString();
    const commentRef = postRef.collection('comments').doc();

    const commentData: Omit<PostComment, 'id'> = {
      authorId: user.uid,
      authorName: user.name || 'Usuário',
      authorRole: (user.role === 'thoughtleader' || user.role === 'colaborador') ? 'thoughtleader' : 'strategist',
      content: content.trim(),
      resolved: false,
      createdAt: now,
      updatedAt: now,
      anchor: anchor || null,
    };

    await commentRef.set(commentData);

    const comment: PostComment = { id: commentRef.id, ...commentData };
    return { success: true, comment };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao adicionar comentário.';
    return { error: msg };
  }
}

// ---- Get Comments ----

export async function getPostComments(
  idToken: string,
  tlUserId: string,
  postId: string
): Promise<{ comments?: PostComment[]; error?: string }> {
  try {
    await requirePostAccess(idToken, tlUserId);

    const snap = await adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .doc(postId)
      .collection('comments')
      .orderBy('createdAt', 'asc')
      .get();

    const comments: PostComment[] = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PostComment[];

    return { comments };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao carregar comentários.';
    return { error: msg };
  }
}

// ---- Resolve Comment ----

export async function resolvePostComment(
  idToken: string,
  tlUserId: string,
  postId: string,
  commentId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requirePostAccess(idToken, tlUserId);

    const commentRef = adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .doc(postId)
      .collection('comments')
      .doc(commentId);

    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) return { error: 'Comentário não encontrado.' };

    const now = new Date().toISOString();
    await commentRef.update({
      resolved: true,
      resolvedBy: user.uid,
      resolvedAt: now,
      updatedAt: now,
    });

    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao resolver comentário.';
    return { error: msg };
  }
}

// ---- Delete Comment (author only) ----

export async function deletePostComment(
  idToken: string,
  tlUserId: string,
  postId: string,
  commentId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requirePostAccess(idToken, tlUserId);

    const commentRef = adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .doc(postId)
      .collection('comments')
      .doc(commentId);

    const commentDoc = await commentRef.get();
    if (!commentDoc.exists) return { error: 'Comentário não encontrado.' };

    const commentData = commentDoc.data()!;
    if (commentData.authorId !== user.uid && user.role !== 'master') {
      return { error: 'Você só pode deletar seus próprios comentários.' };
    }

    await commentRef.delete();
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao deletar comentário.';
    return { error: msg };
  }
}

// ---- Add Bot Comment (system-generated) ----

export async function addBotComment(
  idToken: string,
  tlUserId: string,
  postId: string,
  content: string
): Promise<{ success?: boolean; error?: string; comment?: PostComment }> {
  try {
    await requirePostAccess(idToken, tlUserId);

    const postRef = adminDb
      .collection('users')
      .doc(tlUserId)
      .collection('contentPipeline')
      .doc(postId);

    const postDoc = await postRef.get();
    if (!postDoc.exists) return { error: 'Post não encontrado.' };

    const now = new Date().toISOString();
    const commentRef = postRef.collection('comments').doc();

    const commentData: Omit<PostComment, 'id'> = {
      authorId: 'system',
      authorName: '🤖 Boldfy Bot',
      authorRole: 'strategist',
      content: content.trim(),
      resolved: false,
      createdAt: now,
      updatedAt: now,
      anchor: null,
    };

    await commentRef.set(commentData);

    const comment: PostComment = { id: commentRef.id, ...commentData };
    return { success: true, comment };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro ao adicionar comentário do bot.';
    return { error: msg };
  }
}
