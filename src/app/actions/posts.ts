// src/app/actions/posts.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSelf, requireAuth } from '@/lib/auth-guard';
import { requireActiveModuleByRole } from '@/lib/billing/module-gate';
import { isDefaultFormat } from '@/lib/post-formats';

export type ScheduledPost = {
  id: string;
  userId: string;
  caption: string;
  // Media singular (legado pre-galeria). Sempre primeira midia da galeria
  // ou o unico arquivo quando e video/PDF/GIF/single image.
  mediaUrl?: string;
  mediaType?: string;
  // Multi-image gallery (rodada 6 do feedback): arrays paralelos pra galerias
  // de ate 10 imagens JPG/PNG/WEBP. Quando preenchidos, sobrescrevem
  // mediaUrl/mediaType na hora de publicar. PDF/video/GIF nunca usam
  // estes campos — sempre single em mediaUrl/mediaType.
  mediaUrls?: string[];
  mediaTypes?: string[];
  // ISO date string. Null/ausente em drafts criados pelo auto-save
  // antes de o user definir uma data.
  scheduledFor: string | null;
  status: 'draft' | 'scheduled' | 'in_progress' | 'published' | 'failed';
  linkedinPostId?: string;
  linkedinPostUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  // PR 3 + rodada 4 do feedback: pilar e tipo de midia do post.
  //   contentPillar — guarda o ID do pilar (users/{uid}.personalBrand.strategy.pillars).
  //   formato       — tipo de midia/formato pretendido. Texto livre.
  //                   Defaults sugeridos: "Só texto", "Foto", "Infografico",
  //                   "Carrossel", "Meme". User pode adicionar customs via
  //                   users/{uid}.customPostFormats.
  // Ambos opcionais — posts antigos continuam validos sem esses campos.
  // OBS retrocompat: posts criados antes da rodada 4 podem ter
  // `formato` = 'linkedin' | 'text-heavy' | 'hybrid' (estilo de escrita).
  // O calendario continua mostrando o valor literal — esses ficam
  // esquisitos ate o user editar. Sem migration automatica.
  contentPillar?: string;
  formato?: string;
};

export async function createScheduledPost(
  idToken: string,
  userId: string,
  data: {
    caption: string;
    mediaUrl?: string;
    mediaType?: string;
    // null/omitido = post salvo como draft (auto-save antes da decisao final).
    scheduledFor?: string | null;
    contentPillar?: string;
    formato?: string;
    mediaUrls?: string[];
    mediaTypes?: string[];
    // Status inicial. Default 'in_progress' quando ha data, 'draft' quando nao.
    // Caller pode forçar 'scheduled' (botão Agendar) ou outros explicitamente.
    // Auto-save NUNCA cria como 'scheduled' — só o gesto explícito de agendar
    // promove pra scheduled, pra não acionar o cron de publicação antes da
    // hora se o user ainda estiver editando.
    status?: 'draft' | 'scheduled' | 'in_progress';
  }
): Promise<{ success?: boolean; postId?: string; error?: string }> {
  try {
    const user = await requireSelf(idToken, userId);
    // requireActiveModuleByRole ja cobre billing.* (modular). Legacy subscription
    // foi removida do gate para evitar dupla checagem em fluxos diferentes.
    await requireActiveModuleByRole(user);
    if (!data.caption.trim()) return { error: 'A legenda não pode estar vazia.' };

    // Status: explicit > inferido pela presença de data.
    // Sem status explícito + com data = 'in_progress' (em construção com data
    // marcada). Sem data = 'draft'. NUNCA inferir 'scheduled' aqui — só o
    // caller passando status='scheduled' (botão Agendar) confirma o
    // agendamento real e habilita o cron de publicação.
    const inferredStatus = data.status ?? (data.scheduledFor ? 'in_progress' : 'draft');

    const now = new Date().toISOString();
    // Multi-image: quando ha array com 2+ imagens, salva mediaUrls/mediaTypes
    // e usa o primeiro como mediaUrl/mediaType pra retrocompat de leitura.
    const hasGallery = Array.isArray(data.mediaUrls) && data.mediaUrls.length > 0;
    const firstUrl = hasGallery ? data.mediaUrls![0] : (data.mediaUrl || null);
    const firstType = hasGallery ? (data.mediaTypes?.[0] ?? null) : (data.mediaType || null);

    const postRef = await adminDb.collection('users').doc(userId).collection('scheduledPosts').add({
      userId,
      caption: data.caption,
      mediaUrl: firstUrl,
      mediaType: firstType,
      ...(hasGallery && { mediaUrls: data.mediaUrls, mediaTypes: data.mediaTypes ?? [] }),
      scheduledFor: data.scheduledFor ?? null,
      status: inferredStatus,
      linkedinPostId: null,
      linkedinPostUrl: null,
      ...(data.contentPillar && { contentPillar: data.contentPillar }),
      ...(data.formato && { formato: data.formato }),
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
  idToken: string,
  userId: string,
  postId: string,
  data: {
    caption?: string;
    mediaUrl?: string;
    mediaType?: string;
    scheduledFor?: string | null;
    status?: 'draft' | 'scheduled' | 'in_progress';
    contentPillar?: string;
    formato?: string;
    mediaUrls?: string[];
    mediaTypes?: string[];
  }
): Promise<{ success?: boolean; error?: string }> {
  try {
    const user = await requireSelf(idToken, userId);
    await requireActiveModuleByRole(user);
    if (!postId) return { error: 'Dados insuficientes.' };

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (data.caption !== undefined) updateData.caption = data.caption;
    if (data.scheduledFor !== undefined) updateData.scheduledFor = data.scheduledFor;
    if (data.status !== undefined) updateData.status = data.status;
    // NÃO fazer auto-bump silencioso de status. Antes: se caller passava
    // scheduledFor sem status, o servidor promovia pra 'scheduled' — o que
    // fazia o auto-save do editor virar agendamento real e o cron de
    // publicação pegar posts ainda em construção. Agora status só muda
    // quando o caller manda explícito (auto-save → in_progress/draft,
    // botão "Agendar" → scheduled).
    // contentPillar/formato podem ser '' pra remover o campo do post.
    if (data.contentPillar !== undefined) {
      updateData.contentPillar = data.contentPillar || FieldValue.delete();
    }
    if (data.formato !== undefined) updateData.formato = data.formato;

    // Media: se vier mediaUrls (galeria), prevalece. Senao, usa mediaUrl singular.
    // Importante manter mediaUrl/mediaType como primeira midia pra retrocompat
    // com leitores antigos (calendario, feed) que ainda consultam o singular.
    const hasGalleryUpdate = Array.isArray(data.mediaUrls);
    if (hasGalleryUpdate) {
      const urls = data.mediaUrls ?? [];
      const types = data.mediaTypes ?? [];
      if (urls.length === 0) {
        // Limpar tudo
        updateData.mediaUrl = null;
        updateData.mediaType = null;
        updateData.mediaUrls = FieldValue.delete();
        updateData.mediaTypes = FieldValue.delete();
      } else if (urls.length === 1) {
        // Single — guarda no campo legado e apaga o array (mantem consistencia)
        updateData.mediaUrl = urls[0];
        updateData.mediaType = types[0] ?? null;
        updateData.mediaUrls = FieldValue.delete();
        updateData.mediaTypes = FieldValue.delete();
      } else {
        // Galeria
        updateData.mediaUrl = urls[0];
        updateData.mediaType = types[0] ?? null;
        updateData.mediaUrls = urls;
        updateData.mediaTypes = types;
      }
    } else {
      // Sem novo array — caller usou a forma singular antiga.
      if (data.mediaUrl !== undefined) updateData.mediaUrl = data.mediaUrl || null;
      if (data.mediaType !== undefined) updateData.mediaType = data.mediaType || null;
    }

    await adminDb.collection('users').doc(userId).collection('scheduledPosts').doc(postId).update(updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating scheduled post:', error);
    return { error: 'Erro ao atualizar post.' };
  }
}

export async function deleteScheduledPost(
  idToken: string,
  userId: string,
  postId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireSelf(idToken, userId);
    if (!postId) return { error: 'Dados insuficientes.' };
    await adminDb.collection('users').doc(userId).collection('scheduledPosts').doc(postId).delete();
    return { success: true };
  } catch (error) {
    console.error('Error deleting scheduled post:', error);
    return { error: 'Erro ao remover post.' };
  }
}

export async function getScheduledPosts(
  idToken: string,
  userId: string
): Promise<{ posts?: ScheduledPost[]; error?: string }> {
  try {
    await requireSelf(idToken, userId);

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

export async function getScheduledPost(
  idToken: string,
  userId: string,
  postId: string
): Promise<{ post?: ScheduledPost; error?: string }> {
  try {
    await requireSelf(idToken, userId);
    if (!postId) return { error: 'Post ID obrigatório.' };

    const docSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('scheduledPosts')
      .doc(postId)
      .get();

    if (!docSnap.exists) return { error: 'Post não encontrado.' };

    return {
      post: {
        id: docSnap.id,
        ...docSnap.data(),
      } as ScheduledPost,
    };
  } catch (error) {
    console.error('Error fetching scheduled post:', error);
    return { error: 'Erro ao buscar post.' };
  }
}

// ─── Company Feed ────────────────────────────────────────────────

export type FeedPost = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  authorPosition?: string;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
  linkedinPostId?: string;
  linkedinPostUrl?: string;
  publishedAt: string;
};

export async function getCompanyFeed(
  idToken: string,
): Promise<{ posts?: FeedPost[]; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);
    if (!authUser.companyId) return { error: 'Empresa nao encontrada.' };
    if (authUser.role !== 'colaborador' && authUser.role !== 'admin' && authUser.role !== 'thoughtleader') {
      return { error: 'Acesso nao autorizado.' };
    }

    // 1. Get collaborators AND thought leaders in the company
    const [colabSnap, tlSnap] = await Promise.all([
      adminDb.collection('users')
        .where('companyId', '==', authUser.companyId)
        .where('role', '==', 'colaborador')
        .get(),
      adminDb.collection('users')
        .where('companyId', '==', authUser.companyId)
        .where('role', '==', 'thoughtleader')
        .get(),
    ]);

    // 2. Build user info map for all content creators
    const userMap = new Map<string, { name: string; avatar?: string; position?: string; role: string }>();
    for (const userDoc of colabSnap.docs) {
      const data = userDoc.data();
      userMap.set(userDoc.id, {
        name: data.profile?.name || data.name || 'Colaborador',
        avatar: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture,
        position: data.linkedinConnection?.position || data.profile?.position || '',
        role: 'colaborador',
      });
    }
    for (const userDoc of tlSnap.docs) {
      const data = userDoc.data();
      userMap.set(userDoc.id, {
        name: data.profile?.name || data.name || 'Thought Leader',
        avatar: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture,
        position: data.linkedinConnection?.position || data.profile?.position || '',
        role: 'thoughtleader',
      });
    }

    if (userMap.size === 0) return { posts: [] };

    const allPosts: FeedPost[] = [];

    // Helper: fetch com orderBy, com fallback sem orderBy caso o índice ainda não exista
    async function fetchPostsWithFallback(
      collection: FirebaseFirestore.CollectionReference,
      statusValue: string,
    ): Promise<FirebaseFirestore.QuerySnapshot> {
      try {
        return await collection
          .where('status', '==', statusValue)
          .orderBy('publishedAt', 'desc')
          .limit(50)
          .get();
      } catch {
        // Índice composto ainda não deployado — fallback sem orderBy
        // O sort final por publishedAt no allPosts ainda garante a ordem correta
        console.warn('[Feed] publishedAt index not ready, falling back to unordered query');
        return collection
          .where('status', '==', statusValue)
          .limit(50)
          .get();
      }
    }

    // 3a. Fetch published scheduledPosts from collaborators (parallel)
    const colabPromises = colabSnap.docs.map(async (userDoc) => {
      try {
        const postsSnap = await fetchPostsWithFallback(
          adminDb.collection('users').doc(userDoc.id).collection('scheduledPosts'),
          'published',
        );

        const userInfo = userMap.get(userDoc.id);

        for (const postDoc of postsSnap.docs) {
          const data = postDoc.data();
          allPosts.push({
            id: postDoc.id,
            userId: userDoc.id,
            authorName: userInfo?.name || 'Colaborador',
            authorAvatar: userInfo?.avatar,
            authorPosition: userInfo?.position,
            caption: data.caption || '',
            mediaUrl: data.mediaUrl || undefined,
            mediaType: data.mediaType || undefined,
            linkedinPostId: data.linkedinPostId || undefined,
            linkedinPostUrl: data.linkedinPostUrl || undefined,
            publishedAt: data.publishedAt || data.updatedAt || data.createdAt || '',
          });
        }
      } catch (e) {
        console.error(`[Feed] Error fetching posts for colab ${userDoc.id}:`, e);
      }
    });

    // 3b. Fetch published pipeline posts from TLs (status === 'postado')
    const tlPromises = tlSnap.docs.map(async (userDoc) => {
      try {
        const postsSnap = await fetchPostsWithFallback(
          adminDb.collection('users').doc(userDoc.id).collection('contentPipeline'),
          'postado',
        );

        const userInfo = userMap.get(userDoc.id);

        for (const postDoc of postsSnap.docs) {
          const data = postDoc.data();
          allPosts.push({
            id: postDoc.id,
            userId: userDoc.id,
            authorName: userInfo?.name || 'Thought Leader',
            authorAvatar: userInfo?.avatar,
            authorPosition: userInfo?.position,
            caption: data.caption || '',
            mediaUrl: data.mediaUrl || undefined,
            mediaType: data.mediaType || undefined,
            linkedinPostId: data.linkedinPostId || undefined,
            linkedinPostUrl: data.linkedinPostUrl || undefined,
            publishedAt: data.publishedAt || data.updatedAt || data.createdAt || '',
          });
        }
      } catch (e) {
        console.error(`[Feed] Error fetching pipeline posts for TL ${userDoc.id}:`, e);
      }
    });

    await Promise.all([...colabPromises, ...tlPromises]);

    // 4. Sort all posts by publishedAt descending
    allPosts.sort((a, b) => {
      const dateA = new Date(a.publishedAt).getTime() || 0;
      const dateB = new Date(b.publishedAt).getTime() || 0;
      return dateB - dateA;
    });

    // 5. Return top 50 most recent
    return { posts: allPosts.slice(0, 50) };
  } catch (error) {
    console.error('Error fetching company feed:', error);
    return { error: 'Erro ao carregar feed.' };
  }
}

// ─── Unread Feed Count ──────────────────────────────────────────
export async function getUnreadFeedCount(
  idToken: string,
): Promise<{ count: number; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);
    if (!authUser.companyId) return { count: 0, error: 'Empresa não encontrada.' };

    // Get last read timestamp from user doc
    const userDoc = await adminDb.collection('users').doc(authUser.uid).get();
    const userData = userDoc.data();
    const lastReadAt = userData?.lastFeedReadAt;
    // Convert Firestore Timestamp or string to Date
    const lastReadDate = lastReadAt
      ? (lastReadAt.toDate ? lastReadAt.toDate() : new Date(lastReadAt))
      : new Date(0); // epoch = never read

    // Get all collaborators in company
    const usersSnap = await adminDb.collection('users')
      .where('companyId', '==', authUser.companyId)
      .where('role', '==', 'colaborador')
      .get();

    if (usersSnap.empty) return { count: 0 };

    // Count published posts newer than lastReadDate
    let unreadCount = 0;

    const countPromises = usersSnap.docs.map(async (uDoc) => {
      try {
        const postsSnap = await adminDb
          .collection('users')
          .doc(uDoc.id)
          .collection('scheduledPosts')
          .where('status', '==', 'published')
          .limit(20)
          .get();

        for (const postDoc of postsSnap.docs) {
          const data = postDoc.data();
          const publishedAt = data.publishedAt || data.updatedAt || data.createdAt;
          if (!publishedAt) continue;
          const postDate = publishedAt.toDate ? publishedAt.toDate() : new Date(publishedAt);
          if (postDate > lastReadDate) {
            unreadCount++;
          }
        }
      } catch (e) {
        console.error(`[UnreadFeed] Error counting for user ${uDoc.id}:`, e);
      }
    });

    await Promise.all(countPromises);

    return { count: unreadCount };
  } catch (error) {
    console.error('Error counting unread feed:', error);
    return { count: 0, error: 'Erro ao contar posts não lidos.' };
  }
}

// ─── Custom Post Formats ────────────────────────────────────────

/**
 * Salva a lista de formatos customizados do user (rodada 4).
 * Vive em `users/{uid}.customPostFormats: string[]`. Defaults nao
 * entram aqui — sao injetados em runtime via `mergePostFormats`.
 *
 * Filtra automaticamente customs que colidem com defaults (case-insensitive)
 * pra evitar duplicacao na lista renderizada.
 */
export async function saveCustomPostFormats(
  idToken: string,
  userId: string,
  formats: string[],
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireSelf(idToken, userId);
    const cleaned = formats
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 40)
      .filter((s) => !isDefaultFormat(s)) // remove colisao com default
      .slice(0, 20); // cap arbitrario pra evitar lista absurda

    // Dedupe case-insensitive mantendo ordem
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const f of cleaned) {
      const key = f.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(f);
      }
    }

    await adminDb.collection('users').doc(userId).set(
      {
        customPostFormats: deduped,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { success: true };
  } catch (error) {
    console.error('Error saving custom post formats:', error);
    return { error: error instanceof Error ? error.message : 'Erro desconhecido.' };
  }
}

// ─── Mark Feed as Read ──────────────────────────────────────────
export async function markFeedAsRead(
  idToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const authUser = await requireAuth(idToken);

    await adminDb.collection('users').doc(authUser.uid).update({
      lastFeedReadAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Error marking feed as read:', error);
    return { success: false, error: 'Erro ao marcar feed como lido.' };
  }
}
