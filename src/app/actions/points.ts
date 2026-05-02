// src/app/actions/points.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireSelf } from '@/lib/auth-guard';
import { CONQUEST_LADDERS } from '@/lib/gamification-constants';

// ---- Server-Side Company Ranking ----

export type RankedUser = {
  id: string;
  name: string;
  points: number;
  avatarUrl?: string;
  level?: number;
};

// ---- Ranking Page Types ----

export type MonthlyPublisher = {
  id: string;
  name: string;
  avatarUrl?: string;
  postCount: number;
};

export type MonthlyConquest = {
  userId: string;
  userName: string;
  avatarUrl?: string;
  conquestId: string;
  conquestLabel: string;
  conquestDate: number;
  congratulatedByMe: boolean;
};

export type ConquestProgress = {
  conquestId: string;
  category: string;
  target: number;
  current: number;
  completed: boolean;
};

export type RankingPageData = {
  ranking: RankedUser[];
  monthlyPrizeName: string | null;
  currentUserRank: number | null;
  monthlyPublishers: MonthlyPublisher[];
  monthlyConquests: MonthlyConquest[];
  myConquests: ConquestProgress[];
  error?: string;
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
      .orderBy('points', 'desc')
      .limit(10)
      .get();

    const ranking: RankedUser[] = usersSnap.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.profile?.name || data.name || 'Sem nome',
          points: data.points || 0,
          avatarUrl: data.profile?.avatarUrl || data.photoURL || data.linkedinConnection?.picture || data.avatarUrl || undefined,
          level: (data.level?.current as number) || 1,
        };
      });

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

    // 3. Sum points earned from publications (pointsHistory with source='publicacao')
    const pubHistorySnap = await userRef
      .collection('pointsHistory')
      .where('type', '==', 'gain')
      .where('source', '==', 'publicacao')
      .get();

    let pubPoints = 0;
    pubHistorySnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.points && typeof data.points === 'number') {
        pubPoints += data.points;
      }
    });

    // 4. Sum points earned from other gamification sources (streak, conquest, extract)
    const otherSources = ['streak', 'conquest', 'extract'] as const;
    let otherGamificationPoints = 0;
    for (const source of otherSources) {
      const snap = await userRef
        .collection('pointsHistory')
        .where('type', '==', 'gain')
        .where('source', '==', source)
        .get();
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.points && typeof data.points === 'number') {
          otherGamificationPoints += data.points;
        }
      });
    }

    // 5. Sum points spent on rescues
    const rescuesSnap = await userRef.collection('rescues').get();

    let spentPoints = 0;
    rescuesSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.points && typeof data.points === 'number') {
        spentPoints += data.points;
      }
    });

    // 6. Final: (trails + missions + publications + other gamification) - spent
    const totalEarned = trailPoints + missionPoints + pubPoints + otherGamificationPoints;
    const finalPoints = Math.max(0, totalEarned - spentPoints);

    await userRef.update({ points: finalPoints });

    return { points: finalPoints };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in recalculatePoints:', errorMessage);
    return { points: 0, error: errorMessage };
  }
}

// ---- Consolidated Ranking Page Data ----

function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function extractUserFields(data: FirebaseFirestore.DocumentData) {
  return {
    name: (data.profile?.name as string) || (data.name as string) || 'Sem nome',
    avatarUrl: (data.profile?.avatarUrl as string) || (data.photoURL as string) || (data.linkedinConnection?.picture as string) || (data.avatarUrl as string) || undefined,
  };
}

export async function getRankingPageData(
  idToken: string,
  userId: string,
): Promise<RankingPageData> {
  try {
    await requireSelf(idToken, userId);

    // 1. Get current user → companyId
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return { ranking: [], monthlyPrizeName: null, currentUserRank: null, monthlyPublishers: [], monthlyConquests: [], myConquests: [], error: 'Usuário não encontrado.' };
    }

    const userData = userDoc.data()!;
    const companyId = userData.companyId as string | undefined;
    if (!companyId) {
      return { ranking: [], monthlyPrizeName: null, currentUserRank: null, monthlyPublishers: [], monthlyConquests: [], myConquests: [], error: 'Empresa não associada.' };
    }

    // 2. Parallel fetches: all company collaborators (no limit) + company doc
    const [allUsersSnap, companyDoc] = await Promise.all([
      adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'collaborator')
        .orderBy('points', 'desc')
        .get(),
      adminDb.collection('companies').doc(companyId).get(),
    ]);

    // Build full ranking
    const ranking: RankedUser[] = allUsersSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        ...extractUserFields(d),
        points: (d.points as number) || 0,
        level: (d.level?.current as number) || 1,
      };
    });

    // Current user rank (1-indexed)
    const currentUserRank = ranking.findIndex(u => u.id === userId) + 1 || null;

    // Monthly prize
    let monthlyPrizeName: string | null = null;
    if (companyDoc.exists) {
      const monthlyPrizeId = companyDoc.data()?.monthlyPrize as string | undefined;
      if (monthlyPrizeId) {
        const rewardDoc = await adminDb
          .collection('companies').doc(companyId)
          .collection('rewards').doc(monthlyPrizeId)
          .get();
        if (rewardDoc.exists) {
          monthlyPrizeName = (rewardDoc.data()?.name as string) || null;
        }
      }
    }

    // 3. Monthly data — start of current month
    const monthStart = getStartOfMonth();

    // For each collaborator, count monthly publications + gather monthly conquests
    const monthlyPubCounts: { id: string; name: string; avatarUrl?: string; count: number }[] = [];
    const rawConquests: { userId: string; userName: string; avatarUrl?: string; conquestId: string; conquestLabel: string; conquestDate: number }[] = [];

    // Process collaborators in batches of 10 to avoid overwhelming Firestore
    const collaborators = allUsersSnap.docs;
    const batchSize = 10;

    for (let i = 0; i < collaborators.length; i += batchSize) {
      const batch = collaborators.slice(i, i + batchSize);
      await Promise.all(batch.map(async (colDoc) => {
        const colData = colDoc.data();
        const colFields = extractUserFields(colData);
        const colRef = adminDb.collection('users').doc(colDoc.id);

        // Monthly publications count
        const pubSnap = await colRef.collection('pointsHistory')
          .where('source', '==', 'publicacao')
          .where('date', '>=', monthStart)
          .get();

        if (pubSnap.size > 0) {
          monthlyPubCounts.push({
            id: colDoc.id,
            name: colFields.name,
            avatarUrl: colFields.avatarUrl,
            count: pubSnap.size,
          });
        }

        // Monthly conquests
        const conquestSnap = await colRef.collection('pointsHistory')
          .where('source', '==', 'conquest')
          .where('date', '>=', monthStart)
          .get();

        conquestSnap.docs.forEach(cDoc => {
          const cData = cDoc.data();
          const ts = cData.date?.toMillis?.() || cData.date?.seconds * 1000 || Date.now();
          rawConquests.push({
            userId: colDoc.id,
            userName: colFields.name,
            avatarUrl: colFields.avatarUrl,
            conquestId: (cData.description as string)?.replace('Conquista: ', '') || '',
            conquestLabel: (cData.description as string) || '',
            conquestDate: ts,
          });
        });
      }));
    }

    // Sort monthly publishers desc by count, take top 5
    const monthlyPublishers: MonthlyPublisher[] = monthlyPubCounts
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(p => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, postCount: p.count }));

    // Sort conquests by date desc, take top 20, check congratulated status
    const sortedConquests = rawConquests.sort((a, b) => b.conquestDate - a.conquestDate).slice(0, 20);

    const monthlyConquests: MonthlyConquest[] = await Promise.all(
      sortedConquests.map(async (c) => {
        let congratulatedByMe = false;
        if (c.userId !== userId) {
          const congratDoc = await adminDb
            .collection('users').doc(c.userId)
            .collection('congratulations').doc(`${userId}_${c.conquestId}`)
            .get();
          congratulatedByMe = congratDoc.exists;
        }
        return { ...c, congratulatedByMe };
      })
    );

    // 4. My conquests — progress for all categories
    const myCompleted: string[] = (userData.conquests?.completed as string[]) || [];
    const myConquests: ConquestProgress[] = [];

    // Count category totals for the current user
    const categoryTotals = await Promise.all(
      Object.keys(CONQUEST_LADDERS).map(async (category) => {
        const userRef = adminDb.collection('users').doc(userId);
        let total = 0;

        switch (category) {
          case 'pub': {
            const snap = await userRef.collection('pointsHistory').where('source', '==', 'publicacao').get();
            total = snap.size;
            break;
          }
          case 'trail': {
            const snap = await userRef.collection('pointsHistory').where('source', '==', 'trilha').get();
            total = snap.size;
            break;
          }
          case 'mission': {
            const snap = await adminDb.collection('companies').doc(companyId)
              .collection('missionSubmissions')
              .where('userId', '==', userId)
              .where('status', '==', 'approved')
              .get();
            total = snap.size;
            break;
          }
          case 'seq': {
            const consecutiveCycles = (userData.streak?.consecutiveCyclesCompleted as number) || 0;
            total = consecutiveCycles * 7;
            break;
          }
        }

        return { category, total };
      })
    );

    const totalsByCategory: Record<string, number> = {};
    for (const ct of categoryTotals) {
      totalsByCategory[ct.category] = ct.total;
    }

    for (const [category, ladder] of Object.entries(CONQUEST_LADDERS)) {
      const currentTotal = totalsByCategory[category] || 0;
      for (const target of ladder) {
        const cId = `${category}_${target}`;
        myConquests.push({
          conquestId: cId,
          category,
          target,
          current: Math.min(currentTotal, target),
          completed: myCompleted.includes(cId),
        });
      }
    }

    return {
      ranking: ranking.slice(0, 10), // Top 10 for display
      monthlyPrizeName,
      currentUserRank,
      monthlyPublishers,
      monthlyConquests,
      myConquests,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    console.error('Error in getRankingPageData:', errorMessage);
    return { ranking: [], monthlyPrizeName: null, currentUserRank: null, monthlyPublishers: [], monthlyConquests: [], myConquests: [], error: errorMessage };
  }
}
