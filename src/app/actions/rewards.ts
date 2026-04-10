// src/app/actions/rewards.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSelf, requireAdmin } from '@/lib/auth-guard';

// ---- Reward Redemption ----

export async function redeemReward(
  idToken: string,
  userId: string,
  rewardId: string,
  companyId: string,
  userName: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const authUser = await requireSelf(idToken, userId);

    // Validate user belongs to the company they're redeeming from
    if (authUser.companyId !== companyId) {
      return { error: 'Acesso negado: você não pertence a esta empresa.' };
    }

    const rewardDoc = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('rewards')
      .doc(rewardId)
      .get();

    if (!rewardDoc.exists) {
      return { error: 'Recompensa não encontrada.' };
    }

    const reward = rewardDoc.data();
    if (!reward) {
      return { error: 'Dados da recompensa inválidos.' };
    }

    if (reward.status !== 'Disponível') {
      return { error: 'Esta recompensa não está mais disponível.' };
    }

    if (typeof reward.stock === 'number' && reward.stock <= 0) {
      return { error: 'Estoque esgotado para esta recompensa.' };
    }

    // Use cached points from user document (kept in sync by completeMissionSelf,
    // reviewMissionProof, trail completion, and recalculatePoints)
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const currentPoints = userDoc.exists ? (userDoc.data()?.points || 0) : 0;

    if (currentPoints < reward.points) {
      return { error: `Pontos insuficientes. Você tem ${currentPoints} pontos, mas precisa de ${reward.points}.` };
    }

    const batch = adminDb.batch();
    const now = FieldValue.serverTimestamp();

    const userRescueRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('rescues')
      .doc();

    batch.set(userRescueRef, {
      rewardName: reward.name,
      rewardId,
      date: now,
      status: 'Pendente',
      points: reward.points,
    });

    const companyRescueRef = adminDb
      .collection('companies')
      .doc(companyId)
      .collection('rescues')
      .doc(userRescueRef.id);

    batch.set(companyRescueRef, {
      userId,
      userName,
      rewardName: reward.name,
      rewardId,
      date: now,
      status: 'Pendente',
      points: reward.points,
    });

    const historyRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('pointsHistory')
      .doc();

    batch.set(historyRef, {
      description: `Resgate: ${reward.name}`,
      date: now,
      points: reward.points,
      type: 'spend',
      source: 'resgate',
    });

    if (typeof reward.stock === 'number') {
      batch.update(rewardDoc.ref, {
        stock: reward.stock - 1,
        ...(reward.stock - 1 === 0 && { status: 'Desativada' }),
      });
    }

    const userUpdateData: Record<string, unknown> = {
      points: Math.max(0, currentPoints - reward.points),
    };

    // If this is an AI credits reward, add bonus credits to the user
    if (reward.type === 'ai_credits' && typeof reward.creditsAmount === 'number' && reward.creditsAmount > 0) {
      userUpdateData['aiCredits.bonusCredits'] = FieldValue.increment(reward.creditsAmount);
    }

    batch.update(adminDb.collection('users').doc(userId), userUpdateData);

    await batch.commit();

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in redeemReward:', errorMessage);
    return { error: `Erro ao resgatar recompensa: ${errorMessage}` };
  }
}

// ---- Mark Rescue as Paid ----

export async function markRescueAsPaid(
  idToken: string,
  rescueId: string,
  companyId: string,
  userId?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdmin(idToken, companyId);

    const batch = adminDb.batch();

    const companyRescueRef = adminDb
      .collection('companies')
      .doc(companyId)
      .collection('rescues')
      .doc(rescueId);

    const companyRescueDoc = await companyRescueRef.get();
    if (!companyRescueDoc.exists) {
      return { error: 'Resgate não encontrado.' };
    }

    batch.update(companyRescueRef, { status: 'Pago' });

    const rescueData = companyRescueDoc.data();
    if (!rescueData) {
      return { error: 'Dados do resgate inválidos.' };
    }
    const rescueUserId = userId || rescueData.userId;

    if (rescueUserId) {
      const userRescueRef = adminDb
        .collection('users')
        .doc(rescueUserId)
        .collection('rescues')
        .doc(rescueId);

      batch.update(userRescueRef, { status: 'Pago' });
    }

    await batch.commit();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in markRescueAsPaid:', errorMessage);
    return { error: `Erro ao marcar como pago: ${errorMessage}` };
  }
}
