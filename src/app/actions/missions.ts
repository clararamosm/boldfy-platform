// src/app/actions/missions.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireSelf, requireAdmin } from '@/lib/auth-guard';
import { notifyMissionSubmitted, notifyMissionReviewed } from '@/lib/notifications';
import { checkAndAwardConquests } from '@/app/actions/gamification';

// ---- Create Mission from Trail Module (missao_conteudo) ----
//
// Disparado quando o colaborador clica "desbloquear missão" num módulo
// `missao_conteudo` da trilha. Antes era addDoc direto do client, mas as
// Firestore rules bloqueiam (colaborador só tem `allow read` em missions).
// Server action usa Admin SDK pra criar a missão atribuída só pra esse user.
export async function createTrailContentMission(
  idToken: string,
  userId: string,
  companyId: string,
  data: {
    name: string;
    description: string;
    points: number;
    trailId: string;
    moduleId: string;
    deadlineDays?: number;
  }
): Promise<{ success?: boolean; missionId?: string; error?: string }> {
  try {
    const authUser = await requireSelf(idToken, userId);

    if (authUser.companyId !== companyId) {
      return { error: 'Acesso negado: você não pertence a esta empresa.' };
    }

    // Evita duplicar a missão se o usuário já desbloqueou esse módulo antes.
    const existingSnap = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missions')
      .where('type', '==', 'trail_content')
      .where('moduleId', '==', data.moduleId)
      .where('assignedTo', '==', userId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return { success: true, missionId: existingSnap.docs[0].id };
    }

    const deadlineDays = data.deadlineDays ?? 14;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + deadlineDays);

    const missionRef = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missions')
      .add({
        name: data.name || 'Missão de Trilha',
        description: data.description || '',
        points: data.points || 0,
        type: 'trail_content',
        status: 'active',
        tag: 'Missao de Trilha',
        trailId: data.trailId,
        moduleId: data.moduleId,
        assignedTo: userId,
        completionMode: 'proof',
        startDate: FieldValue.serverTimestamp(),
        endDate,
        deadlineDays,
        createdAt: FieldValue.serverTimestamp(),
      });

    return { success: true, missionId: missionRef.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in createTrailContentMission:', msg);
    return { error: msg };
  }
}

// ---- Create Trigger Mission from Trail Completion ----
//
// Disparado dentro de `completeModule` quando a trilha inteira é concluída
// e ela tem `missaoGatilho`. Mesma justificativa do createTrailContentMission:
// Firestore rules bloqueiam escrita em companies/X/missions pelo colaborador.
export async function createTrailTriggerMission(
  idToken: string,
  userId: string,
  companyId: string,
  data: {
    name: string;
    description: string;
    points: number;
    trailId: string;
    requiresProof?: boolean;
    deadlineDays?: number;
  }
): Promise<{ success?: boolean; missionId?: string; error?: string }> {
  try {
    const authUser = await requireSelf(idToken, userId);

    if (authUser.companyId !== companyId) {
      return { error: 'Acesso negado: você não pertence a esta empresa.' };
    }

    // Evita duplicar a missão se o usuário já completou a trilha antes.
    const existingSnap = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missions')
      .where('type', '==', 'trail_trigger')
      .where('trailId', '==', data.trailId)
      .where('assignedTo', '==', userId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return { success: true, missionId: existingSnap.docs[0].id };
    }

    const deadlineDays = data.deadlineDays ?? 14;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + deadlineDays);

    const missionRef = await adminDb
      .collection('companies')
      .doc(companyId)
      .collection('missions')
      .add({
        name: data.name || 'Missão de Trilha',
        description: data.description || '',
        points: data.points || 0,
        type: 'trail_trigger',
        status: 'active',
        tag: 'Missao de Trilha',
        trailId: data.trailId,
        assignedTo: userId,
        requiresProof: data.requiresProof || false,
        completionMode: data.requiresProof ? 'proof' : 'auto',
        startDate: FieldValue.serverTimestamp(),
        endDate,
        deadlineDays,
        createdAt: FieldValue.serverTimestamp(),
      });

    return { success: true, missionId: missionRef.id };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in createTrailTriggerMission:', msg);
    return { error: msg };
  }
}

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

    // Notify admin(s) — fire and forget
    const missionData = missionDoc.data();
    notifyMissionSubmitted({
      companyId,
      collaboratorName: userName,
      missionName: missionData?.name || 'Missão',
    }).catch((err) => console.error('[Notification] notifyMissionSubmitted failed:', err));

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

    const missionData = missionDoc.data();
    if (!missionData) {
      return { error: 'Dados da missão inválidos.' };
    }
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

    // Toast notification for mission points
    if (missionPoints > 0) {
      batch.update(userRef, {
        pendingNotifications: FieldValue.arrayUnion({
          type: 'points',
          source: 'missao',
          points: missionPoints,
          description: `Missão concluída: ${missionData.name || 'Missão'}`,
          createdAt: Date.now(),
          onboardingItemId: 'complete-mission',
        }),
      });
    }

    await batch.commit();

    // Check mission conquests (fire-and-forget)
    checkAndAwardConquests(userId, 'mission')
      .catch(err => console.error(`[Gamification] Conquest check failed after mission self-complete for user ${userId}:`, err));

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

    const subData = subDoc.data();
    if (!subData) {
      return { error: 'Dados da submissão inválidos.' };
    }
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
      const missionPoints = missionDoc.exists ? (missionDoc.data()?.points || 0) : 0;
      const batch = adminDb.batch();

      batch.update(subRef, {
        status: 'approved',
        reviewedAt: FieldValue.serverTimestamp(),
        adminFeedback: adminFeedback || null,
      });

      const missionName = missionDoc.exists ? (missionDoc.data()?.name || 'Missão') : 'Missão';
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
        description: `Missão concluída: ${missionName}`,
        date: FieldValue.serverTimestamp(),
        points: missionPoints,
        type: 'gain',
        source: 'missao',
      });

      // Toast notification for mission points
      if (missionPoints > 0) {
        batch.update(userRef, {
          pendingNotifications: FieldValue.arrayUnion({
            type: 'points',
            source: 'missao',
            points: missionPoints,
            description: `Missão concluída: ${missionName}`,
            createdAt: Date.now(),
            onboardingItemId: 'complete-mission',
          }),
        });
      }

      await batch.commit();

      // Check mission conquests (fire-and-forget)
      checkAndAwardConquests(subData.userId, 'mission')
        .catch(err => console.error(`[Gamification] Conquest check failed after mission approval for user ${subData.userId}:`, err));
    } else {
      await subRef.update({
        status: 'rejected',
        reviewedAt: FieldValue.serverTimestamp(),
        adminFeedback: adminFeedback || null,
      });
    }

    // Notify collaborator — fire and forget
    const missionData = missionDoc.exists ? missionDoc.data() : null;
    const missionPoints = missionData?.points || 0;
    notifyMissionReviewed({
      collaboratorId: subData.userId,
      missionName: missionData?.name || 'Missão',
      action,
      feedback: adminFeedback,
      pointsAwarded: action === 'approve' ? missionPoints : undefined,
    }).catch((err) => console.error('[Notification] notifyMissionReviewed failed:', err));

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in reviewMissionProof:', msg);
    return { error: msg };
  }
}
