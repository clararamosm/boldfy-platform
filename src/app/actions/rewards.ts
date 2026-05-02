// src/app/actions/rewards.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { requireSelf, requireAdmin } from '@/lib/auth-guard';
import { notifyRewardRedeemed, notifyLowStock, notifyCodeRedeemed } from '@/lib/notifications';

// ─── Types ────────────────────────────────────────────────────────

type MaskedCode = {
  id: string;
  maskedCode: string;
  status: 'available' | 'used';
  usedByName?: string;
  usedAt?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────

function maskCode(code: string): string {
  if (code.length <= 3) return '***';
  return code.slice(0, -3).replace(/./g, '*') + code.slice(-3);
}

/**
 * Check remaining available codes after a redemption.
 * If ≤2 → email alert to admins. If 0 → auto-disable reward.
 */
async function checkLowStock(
  companyId: string,
  rewardId: string,
  rewardName: string,
): Promise<void> {
  try {
    const codesRef = adminDb
      .collection('companies').doc(companyId)
      .collection('rewards').doc(rewardId)
      .collection('codes');

    const available = await codesRef.where('status', '==', 'available').get();
    const remaining = available.size;

    if (remaining === 0) {
      // Auto-disable reward
      await adminDb
        .collection('companies').doc(companyId)
        .collection('rewards').doc(rewardId)
        .update({ status: 'Desativada', stock: 0 });
    }

    if (remaining <= 2) {
      notifyLowStock({ companyId, rewardName, remainingCodes: remaining })
        .catch((err) => console.error('[Notification] notifyLowStock failed:', err));
    }
  } catch (err) {
    console.error('[Gamification] checkLowStock failed:', err);
  }
}

// ─── Reward Redemption ────────────────────────────────────────────

export async function redeemReward(
  idToken: string,
  userId: string,
  rewardId: string,
  companyId: string,
  userName: string,
): Promise<{ success?: boolean; code?: string; error?: string }> {
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

    // ── Code delivery: pick next available code ──
    let redeemedCode: string | null = null;
    let codeDocRef: DocumentReference | null = null;

    if (reward.deliveryMethod === 'code') {
      const codesRef = adminDb
        .collection('companies').doc(companyId)
        .collection('rewards').doc(rewardId)
        .collection('codes');

      const availableCodes = await codesRef
        .where('status', '==', 'available')
        .orderBy('addedAt', 'asc')
        .limit(1)
        .get();

      if (availableCodes.empty) {
        return { error: 'Nenhum código disponível para esta recompensa.' };
      }

      const codeDoc = availableCodes.docs[0];
      redeemedCode = codeDoc.data().code;
      codeDocRef = codeDoc.ref;
    }

    const batch = adminDb.batch();
    const now = FieldValue.serverTimestamp();

    // Mark code as used in the same batch (if code delivery)
    if (codeDocRef && redeemedCode) {
      batch.update(codeDocRef, {
        status: 'used',
        usedAt: now,
        usedBy: userId,
        usedByName: userName,
      });
    }

    // Auto-paid: code delivery (code is instant) or AI credits (system delivers instantly)
    const isAutoPaid = !!redeemedCode || reward.type === 'ai_credits';
    const rescueStatus = isAutoPaid ? 'Pago' : 'Pendente';

    // User rescue doc
    const userRescueRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('rescues')
      .doc();

    batch.set(userRescueRef, {
      rewardName: reward.name,
      rewardId,
      date: now,
      status: rescueStatus,
      points: reward.points,
      deliveryMethod: reward.deliveryMethod || 'manual',
      ...(redeemedCode && { code: redeemedCode }),
    });

    // Company rescue doc
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
      status: rescueStatus,
      points: reward.points,
      deliveryMethod: reward.deliveryMethod || 'manual',
      ...(redeemedCode && { code: redeemedCode }),
    });

    // Points history
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

    // Stock decrement (for non-code rewards with numeric stock)
    if (reward.deliveryMethod !== 'code' && typeof reward.stock === 'number') {
      batch.update(rewardDoc.ref, {
        stock: reward.stock - 1,
        ...(reward.stock - 1 === 0 && { status: 'Desativada' }),
      });
    }

    // User points update
    const userUpdateData: Record<string, unknown> = {
      points: Math.max(0, currentPoints - reward.points),
    };

    // If this is an AI credits reward, add bonus credits to the user
    if (reward.type === 'ai_credits' && typeof reward.creditsAmount === 'number' && reward.creditsAmount > 0) {
      userUpdateData['aiCredits.bonusCredits'] = FieldValue.increment(reward.creditsAmount);
    }

    batch.update(adminDb.collection('users').doc(userId), userUpdateData);

    await batch.commit();

    // Fire-and-forget notifications
    notifyRewardRedeemed({
      companyId,
      collaboratorName: userName,
      rewardName: reward.name,
      pointsSpent: reward.points,
    }).catch((err) => console.error('[Notification] notifyRewardRedeemed failed:', err));

    // Code-specific: send code email to collaborator + check low stock
    if (reward.deliveryMethod === 'code' && redeemedCode) {
      notifyCodeRedeemed({
        userId,
        rewardName: reward.name,
        code: redeemedCode,
      }).catch((err) => console.error('[Notification] notifyCodeRedeemed failed:', err));

      checkLowStock(companyId, rewardId, reward.name)
        .catch((err) => console.error('[Gamification] checkLowStock failed:', err));
    }

    return { success: true, ...(redeemedCode && { code: redeemedCode }) };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in redeemReward:', errorMessage);
    return { error: `Erro ao resgatar recompensa: ${errorMessage}` };
  }
}

// ─── Mark Rescue as Paid ──────────────────────────────────────────

export async function markRescueAsPaid(
  idToken: string,
  rescueId: string,
  companyId: string,
  userId?: string,
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

// ─── Add Voucher Codes (Admin) ────────────────────────────────────

export async function addVoucherCodes(
  idToken: string,
  companyId: string,
  rewardId: string,
  codes: string[],
): Promise<{ success?: boolean; added?: number; error?: string }> {
  try {
    await requireAdmin(idToken, companyId);

    // Validate
    const cleanCodes = codes.map((c) => c.trim()).filter((c) => c.length > 0);
    if (cleanCodes.length === 0) {
      return { error: 'Nenhum código válido fornecido.' };
    }

    // Remove duplicates
    const uniqueCodes = [...new Set(cleanCodes)];

    // Verify reward exists
    const rewardRef = adminDb
      .collection('companies').doc(companyId)
      .collection('rewards').doc(rewardId);

    const rewardDoc = await rewardRef.get();
    if (!rewardDoc.exists) {
      return { error: 'Recompensa não encontrada.' };
    }

    const codesRef = rewardRef.collection('codes');
    const now = FieldValue.serverTimestamp();

    // Batch max is 500 — split if necessary
    const BATCH_SIZE = 450; // leave room for reward update
    let totalAdded = 0;

    for (let i = 0; i < uniqueCodes.length; i += BATCH_SIZE) {
      const chunk = uniqueCodes.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      for (const code of chunk) {
        const codeRef = codesRef.doc();
        batch.set(codeRef, {
          code,
          status: 'available',
          addedAt: now,
        });
      }

      await batch.commit();
      totalAdded += chunk.length;
    }

    // Count available codes to update stock
    const availableSnap = await codesRef.where('status', '==', 'available').get();
    const newStock = availableSnap.size;

    // Update reward stock and re-enable if was disabled
    const rewardData = rewardDoc.data();
    const updateData: Record<string, unknown> = { stock: newStock };
    if (rewardData?.status === 'Desativada' && newStock > 0) {
      updateData.status = 'Disponível';
    }
    // Ensure deliveryMethod is 'code'
    if (rewardData?.deliveryMethod !== 'code') {
      updateData.deliveryMethod = 'code';
    }

    await rewardRef.update(updateData);

    return { success: true, added: totalAdded };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in addVoucherCodes:', errorMessage);
    return { error: `Erro ao adicionar códigos: ${errorMessage}` };
  }
}

// ─── Get Code Stats (Admin) ──────────────────────────────────────

export async function getCodeStats(
  idToken: string,
  companyId: string,
  rewardId: string,
): Promise<{ available: number; used: number; error?: string }> {
  try {
    await requireAdmin(idToken, companyId);

    const codesRef = adminDb
      .collection('companies').doc(companyId)
      .collection('rewards').doc(rewardId)
      .collection('codes');

    const allCodes = await codesRef.get();

    let available = 0;
    let used = 0;
    for (const doc of allCodes.docs) {
      const status = doc.data().status;
      if (status === 'available') available++;
      else if (status === 'used') used++;
    }

    return { available, used };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getCodeStats:', errorMessage);
    return { available: 0, used: 0, error: `Erro ao buscar estatísticas: ${errorMessage}` };
  }
}

// ─── Get Code History (Admin — masked) ───────────────────────────

export async function getCodeHistory(
  idToken: string,
  companyId: string,
  rewardId: string,
): Promise<{ codes: MaskedCode[]; error?: string }> {
  try {
    await requireAdmin(idToken, companyId);

    const codesRef = adminDb
      .collection('companies').doc(companyId)
      .collection('rewards').doc(rewardId)
      .collection('codes');

    const allCodes = await codesRef.orderBy('addedAt', 'desc').get();

    const maskedCodes: MaskedCode[] = allCodes.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        maskedCode: maskCode(data.code || ''),
        status: data.status || 'available',
        usedByName: data.usedByName,
        usedAt: data.usedAt?.toDate?.()?.toISOString(),
      };
    });

    // Sort: used first (most recent), then available
    maskedCodes.sort((a, b) => {
      if (a.status === 'used' && b.status !== 'used') return -1;
      if (a.status !== 'used' && b.status === 'used') return 1;
      return 0;
    });

    return { codes: maskedCodes };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getCodeHistory:', errorMessage);
    return { codes: [], error: `Erro ao buscar histórico: ${errorMessage}` };
  }
}
