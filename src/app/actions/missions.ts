// src/app/actions/missions.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSelf, requireAdmin } from '@/lib/auth-guard';

// ---- Mission Proof Submission ----

export async function submitMissionProof(
  idToken: string,
  userId: string,
  missionId: string,
  companyId: string,
  userName: string,
  proofUrl: string,
  proofFileName: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const authUser = await requireSelf(idToken, userId);

    // Validate user belongs to the company
    if (authUser.companyId !== companyId) {
      return { error: 'Acesso negado: você não pertence a esta empresa.' };
    }

    const missionDoc = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missions')
      .doc(missionId)
      .get();

    if (!missionDoc.exists) {
      return { error: 'Missão não encontrada.' };
    }

    const existingSnap = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missionSubmissions')
      .where('missionId', '==', missionId)
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'approved'])
      .get();

    if (!existingSnap.empty) {
      return { error: 'Você já enviou uma comprovação para esta missão.' };
    }

    await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missionSubmissions')
      .add({
        missionId,
        userId,
        userName,
        proofUrl,
        proofFileName,
        status: 'pending',
        submittedAt: FieldValue.serverTimestamp(),
      });

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in submitMissionProof:', msg);
    return { error: msg };
  }
}

// ---- Auto-Complete Mission (no proof required) ----

export async function completeMissionSelf(
  idToken: string,
  userId: string,
  missionId: string,
  companyId: string,
  userName: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const authUser = await requireSelf(idToken, userId);

    // Validate user belongs to the company
    if (authUser.companyId !== companyId) {
      return { error: 'Acesso negado: você não pertence a esta empresa.' };
    }

    const missionDoc = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missions')
      .doc(missionId)
      .get();

    if (!missionDoc.exists) {
      return { error: 'Missão não encontrada.' };
    }

    const missionData = missionDoc.data()!;
    if (missionData.completionMode !== 'auto') {
      return { error: 'Esta missão requer comprovação.' };
    }

    const existingSnap = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missionSubmissions')
      .where('missionId', '==', missionId)
      .where('userId', '==', userId)
      .where('status', 'in', ['pending', 'approved'])
      .get();

    if (!existingSnap.empty) {
      return { error: 'Você já concluiu esta missão.' };
    }

    const missionPoints = missionData.points || 0;
    const batch = adminDb.batch();

    const subRef = adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missionSubmissions')
      .doc();

    batch.set(subRef, {
      missionId,
      userId,
      userName,
      proofUrl: null,
      proofFileName: null,
      status: 'approved',
      submittedAt: FieldValue.serverTimestamp(),
      reviewedAt: FieldValue.serverTimestamp(),
      adminFeedback: null,
      autoCompleted: true,
    });

    const userRef = adminDb.collection('users').doc(userId);
    batch.update(userRef, {
      points: FieldValue.increment(missionPoints),
    });

    const historyRef = adminDb
      .collection('users')
      .doc(userId)
      .collection('pointsHistory')
      .doc();
    batch.set(historyRef, {
      description: `Missão concluída: ${missionData.name || 'Missão'}`,
      date: FieldValue.serverTimestamp(),
      points: missionPoints,
      type: 'gain',
      source: 'missao',
    });

    await batch.commit();
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in completeMissionSelf:', msg);
    return { error: msg };
  }
}

// ---- Admin Review Mission Proof ----

export async function reviewMissionProof(
  idToken: string,
  submissionId: string,
  companyId: string,
  action: 'approve' | 'reject',
  adminFeedback?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdmin(idToken, companyId);

    const subRef = adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missionSubmissions')
      .doc(submissionId);

    const subDoc = await subRef.get();
    if (!subDoc.exists) {
      return { error: 'Submissão não encontrada.' };
    }

    const subData = subDoc.data()!;
    if (subData.status !== 'pending') {
      return { error: 'Esta submissão já foi avaliada.' };
    }

    const missionDoc = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missions')
      .doc(subData.missionId)
      .get();

    if (action === 'approve') {
      const missionPoints = missionDoc.exists ? missionDoc.data()!.points || 0 : 0;
      const batch = adminDb.batch();

      batch.update(subRef, {
        status: 'approved',
        reviewedAt: FieldValue.serverTimestamp(),
        adminFeedback: adminFeedback || null,
      });

      const userRef = adminDb.collection('users').doc(subData.userId);
      batch.update(userRef, {
        points: FieldValue.increment(missionPoints),
      });

      const historyRef = adminDb
        .collection('users')
        .doc(subData.userId)
        .collection('pointsHistory')
        .doc();
      batch.set(historyRef, {
        description: `Missão concluída: ${missionDoc.exists ? missionDoc.data()!.name : 'Missão'}`,
        date: FieldValue.serverTimestamp(),
        points: missionPoints,
        type: 'gain',
        source: 'missao',
      });

      await batch.commit();
    } else {
      await subRef.update({
        status: 'rejected',
        reviewedAt: FieldValue.serverTimestamp(),
        adminFeedback: adminFeedback || null,
      });
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in reviewMissionProof:', msg);
    return { error: msg };
  }
}
