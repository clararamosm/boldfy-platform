// src/app/actions/posts.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type ScheduledPost = {
  id: string;
  userId: string;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
  scheduledFor: string; // ISO date string
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  linkedinPostId?: string;
  linkedinPostUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export async function createScheduledPost(
  userId: string,
  data: {
    caption: string;
    mediaUrl?: string;
    mediaType?: string;
    scheduledFor: string;
  }
): Promise<{ success?: boolean; postId?: string; error?: string }> {
  try {
    if (!userId) return { error: 'Usuário não identificado.' };
    if (!data.caption.trim()) return { error: 'A legenda não pode estar vazia.' };
    if (!data.scheduledFor) return { error: 'Data de agendamento é obrigatória.' };

    const now = new Date().toISOString();
    const postRef = await adminDb.collection('users').doc(userId).collection('scheduledPosts').add({
      userId,
      caption: data.caption,
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType || null,
      scheduledFor: data.scheduledFor,
      status: 'scheduled',
      linkedinPostId: null,
      linkedinPostUrl: null,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, postId: postRef.id };
  } catch (error) {
    console.error('Error creating scheduled post:', error);
    return { error: 'Erro ao agendar post.' };
  }
}

export async function updateScheduledPost(
  userId: string,
  postId: string,
  data: {
    caption?: string;
    mediaUrl?: string;
    mediaType?: string;
    scheduledFor?: string;
    status?: 'draft' | 'scheduled';
  }
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!userId || !postId) return { error: 'Dados insuficientes.' };

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.caption !== undefined) updateData.caption = data.caption;
    if (data.mediaUrl !== undefined) updateData.mediaUrl = data.mediaUrl || null;
    if (data.mediaType !== undefined) updateData.mediaType = data.mediaType || null;
    if (data.scheduledFor !== undefined) updateData.scheduledFor = data.scheduledFor;
    if (data.status !== undefined) updateData.status = data.status;

    await adminDb.collection('users').doc(userId).collection('scheduledPosts').doc(postId).update(updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating scheduled post:', error);
    return { error: 'Erro ao atualizar post.' };
  }
}

export async function deleteScheduledPost(
  userId: string,
  postId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!userId || !postId) return { error: 'Dados insuficientes.' };
    await adminDb.collection('users').doc(userId).collection('scheduledPosts').doc(postId).delete();
    return { success: true };
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return { error: 'Erro ao remover post.' };
  }
}

export async function getScheduledPosts(
  userId: string
): Promise<{ posts?: ScheduledPost[]; error?: string }> {
  try {
    if (!userId) return { error: 'Usuário não identificado.' };

    const snapshot = await adminDb
      .collection('users')
      .doc(userId)
      .collection('scheduledPosts')
      .orderBy('scheduledFor', 'asc')
      .get();

    const posts: ScheduledPost[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as ScheduledPost));

    return { posts };
  } catch (error) {
    console.error('Error fetching scheduled posts:', error);
    return { error: 'Erro ao buscar posts agendados.' };
  }
}
