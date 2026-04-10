// src/app/actions/points.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireSelf } from '@/lib/auth-guard';

// ---- Server-Side Company Ranking ----

export type RankedUser = {
  id: string;
  name: string;
  points: number;
  avatarUrl?: string;
};

export async function getCompanyRanking(idToken: string, userId: string): Promise<{
  ranking: RankedUser[];
  monthlyPrizeName: string | null;
  error?: string;
}> {
  try {
    await requireSelf(idToken, userId);

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { ranking: [], monthlyPrizeName: null, error: 'Usuário não encontrado.' };
    }

    const companyId = userDoc.data()?.companyId;
    if (!companyId) {
      return { ranking: [], monthlyPrizeName: null, error: 'Empresa não associada ao usuário.' };
    }

    const usersSnap = await adminDb
      .collection('users')
      .where('companyId', '==', companyId)
      .get();

    const ranking: RankedUser[] = usersSnap.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.profile?.name || data.name || 'Sem nome',
          points: data.points || 0,
          avatarUrl: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture || data.avatarUrl || undefined,
        };
      })
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

    let monthlyPrizeName: string | null = null;
    const companyDoc = await adminDb.collection('companies').doc(companyId).get();

    if (companyDoc.exists) {
      const monthlyPrizeId = companyDoc.data()?.monthlyPrize;
      if (monthlyPrizeId) {
        const rewardDoc = await adminDb
          .collection('companies')
          .doc(companyId)
          .collection('rewards')
          .doc(monthlyPrizeId)
          .get();

        if (rewardDoc.exists) {
          monthlyPrizeName = rewardDoc.data()?.name || null;
        }
      }
    }

    return { ranking, monthlyPrizeName };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getCompanyRanking:', errorMessage);
    return { ranking: [], monthlyPrizeName: null, error: errorMessage };
  }
}

// ---- Server-Side Points Recalculation ----

export async function recalculatePoints(idToken: string, userId: string): Promise<{ points: number; error?: string }> {
  try {
    await requireSelf(idToken, userId);

    const userRef = adminDb.collection('users').doc(userId);

    // 1. Sum points earned from trails (trailProgress)
    const progressSnap = await userRef.collection('trailProgress').get();

    let trailPoints = 0;
    progressSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.pontosGanhos && typeof data.pontosGanhos === 'number') {
        trailPoints += data.pontosGanhos;
      }
    });

    // 2. Sum points earned from missions (pointsHistory with source='missao')
    const missionHistorySnap = await userRef
      .collection('pointsHistory')
      .where('type', '==', 'gain')
      .where('source', '==', 'missao')
      .get();

    let missionPoints = 0;
    missionHistorySnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.points && typeof data.points === 'number') {
        missionPoints += data.points;
      }
    });

    // 3. Sum points spent on rescues
    const rescuesSnap = await userRef.collection('rescues').get();

    let spentPoints = 0;
    rescuesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.points && typeof data.points === 'number') {
        spentPoints += data.points;
      }
    });

    // 4. Final: (trails + missions) - spent
    const totalEarned = trailPoints + missionPoints;
    const finalPoints = Math.max(0, totalEarned - spentPoints);

    await userRef.update({ points: finalPoints });

    return { points: finalPoints };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in recalculatePoints:', errorMessage);
    return { points: 0, error: errorMessage };
  }
}
