'use server';

// Server actions for hot topics — all require authentication.
// The internal generation logic is in @/lib/hot-topics.ts (not a server action).

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAuth } from '@/lib/auth-guard';
import { generateHotTopicsForCompany } from '@/lib/hot-topics';
import type { HotTopic, HotTopicsData } from '@/lib/hot-topics';

// Re-export types for consumers
export type { HotTopic, HotTopicsData };

// ─── Get hot topics for a company ─────────────────────────────

export async function getHotTopics(
  idToken: string,
): Promise<{ data?: HotTopicsData; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);
    if (!authUser.companyId) return { error: 'Empresa não encontrada.' };

    const companyDoc = await adminDb.collection('companies').doc(authUser.companyId).get();
    if (!companyDoc.exists) return { error: 'Empresa não encontrada.' };

    const data = companyDoc.data();
    const hotTopics = data?.hotTopics as HotTopicsData | undefined;

    if (!hotTopics || !hotTopics.topics?.length) {
      return { data: { topics: [], geradoEm: '', semana: '' } };
    }

    return { data: hotTopics };
  } catch (err) {
    console.error('Error fetching hot topics:', err);
    return { error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

// ─── Admin trigger: regenerate hot topics ─────────────────────

export async function regenerateHotTopics(
  idToken: string,
): Promise<{ topics?: HotTopic[]; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);
    if (!authUser.companyId) return { error: 'Empresa não encontrada.' };
    if (authUser.role !== 'admin' && authUser.role !== 'master') {
      return { error: 'Apenas admins podem regenerar tópicos.' };
    }

    const result = await generateHotTopicsForCompany(authUser.companyId);
    return result;
  } catch (err) {
    console.error('Error regenerating hot topics:', err);
    return { error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}
