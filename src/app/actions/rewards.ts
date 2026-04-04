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
    await requireSelf(idToken, userId);
    const rewardDoc = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('rewards')
      .doc(rewardId)
      .get();

    if (!rewardDoc.exists) {
      return { error: 'Recompensa não encontrada.' };
    }

    const reward = rewardDoc.data()!;

    if (reward.status !== 'Disponível') {
      return { error: 'Esta recompensa não está mais disponível.' };
    }

    if (typeof reward.stock === 'number' && reward.stock <= 0) {
      return { error: 'Estoque esgotado para esta recompensa.' };
    }

    // Recalculate current points to get authoritative balance
    const progressSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('trailProgress')
      .get();

    let earnedPoints = 0;
    progressSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.pontosGanhos && typeof data.pontosGanhos === 'number') {
        earnedPoints += data.pontosGanhos;
      }
    });

    const rescuesSnap = await adminDb
      .collection('users')
      .doc(userId)
      .collection('rescues')
      .get();

    let spentPoints = 0;
    rescuesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.points && typeof data.points === 'number') {
        spentPoints += data.points;
      }
    });

    const currentPoints = Math.max(0, earnedPoints - spentPoints);

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

    const newPoints = currentPoints - reward.points;
    batch.update(adminDb.collection('users').doc(userId), {
      points: Math.max(0, newPoints),
    });

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
  companyId: string,
  rescueId: string,
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

    const rescueData = companyRescueDoc.data()!;
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
