// src/app/actions/dashboard.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/auth-guard';

// ─── Types ──────────────────────────────────────────────────────

export type TopCollaborator = {
  id: string;
  name: string;
  points: number;
  missionsCompleted: number;
};

export type DashboardData = {
  totalLicenses: number;
  activeCollaborators: number;
  collaboratorsWithActivity: number;
  missionsApproved: number;
  missionsPending: number;
  totalMissionsAvailable: number;
  prevMissionsApproved: number;
  trailsStarted: number;
  trailsCompleted: number;
  totalTrails: number;
  totalPointsDistributed: number;
  prevPointsDistributed: number;
  rewardsRedeemed: number;
  totalPointsRedeemed: number;
  topCollaborators: TopCollaborator[];
  estimatedImpressions: number;
  estimatedValue: number;
};

type PeriodRange = {
  start: string; // ISO
  end: string;
  prevStart: string;
  prevEnd: string;
};

// ─── Helpers ────────────────────────────────────────────────────

function toDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts === 'object' && ts !== null && 'seconds' in (ts as Record<string, unknown>)) {
    return new Date(((ts as Record<string, number>).seconds) * 1000);
  }
  if (ts instanceof Date) return ts;
  return null;
}

function isInRange(ts: unknown, start: Date, end: Date): boolean {
  const d = toDate(ts);
  if (!d) return false;
  return d >= start && d <= end;
}

const CPM_UNIT = 0.30;

// ─── Server Action ──────────────────────────────────────────────

export async function getAdminDashboardData(
  idToken: string,
  companyId: string,
  periodRange: PeriodRange,
): Promise<{ data?: DashboardData; error?: string }> {
  try {
    await requireAdmin(idToken, companyId);

    const start = new Date(periodRange.start);
    const end = new Date(periodRange.end);
    const prevStart = new Date(periodRange.prevStart);
    const prevEnd = new Date(periodRange.prevEnd);

    // ─── 1. Parallel top-level fetches ────────────────────────
    const [companyDoc, collabSnap, missionsSnap, submissionsSnap, trailsSnap, rewardsSnap, rescuesSnap] = await Promise.all([
      adminDb.collection('companies').doc(companyId).get(),
      adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'colaborador')
        .get(),
      adminDb.collection('companies').doc(companyId).collection('missions').get(),
      adminDb.collection('companies').doc(companyId).collection('missionSubmissions').get(),
      adminDb.collection('companies').doc(companyId).collection('trails').get(),
      adminDb.collection('companies').doc(companyId).collection('rewards').get(),
      adminDb.collection('companies').doc(companyId).collection('rescues').get(),
    ]);

    const companyData = companyDoc.data();

    // ─── 2. Collaborators ─────────────────────────────────────
    const activeCollaborators = collabSnap.size;
    let collaboratorsWithActivity = 0;
    const collabMap = new Map<string, { name: string; points: number; missionsCompleted: number }>();

    collabSnap.docs.forEach(d => {
      const data = d.data();
      const points = data.points || 0;
      if (points > 0) collaboratorsWithActivity++;
      collabMap.set(d.id, {
        name: data.name || data.profile?.name || 'Sem nome',
        points,
        missionsCompleted: 0,
      });
    });

    // ─── 3. Missions ──────────────────────────────────────────
    let totalMissionsAvailable = 0;
    missionsSnap.docs.forEach(d => {
      const status = d.data().status;
      if (status === 'Ativa' || status === 'Fixa' || status === 'Agendada') totalMissionsAvailable++;
    });

    let missionsApproved = 0;
    let missionsPending = 0;
    let prevMissionsApproved = 0;

    submissionsSnap.docs.forEach(d => {
      const data = d.data();
      const submittedAt = data.submittedAt || data.reviewedAt;

      if (data.status === 'approved' && isInRange(submittedAt, start, end)) {
        missionsApproved++;
        const c = collabMap.get(data.userId);
        if (c) c.missionsCompleted++;
      }
      if (data.status === 'pending') missionsPending++;
      if (data.status === 'approved' && isInRange(submittedAt, prevStart, prevEnd)) {
        prevMissionsApproved++;
      }
    });

    // ─── 4. Trails ────────────────────────────────────────────
    const totalTrails = trailsSnap.docs.filter(d => {
      const data = d.data();
      return data.active === true || data.ativa === true;
    }).length;

    // ─── 5. Trail progress + Points history (N+1 → parallel with Admin SDK) ──
    // Admin SDK bypasses Firestore rules, so no permission issues
    let trailsStarted = 0;
    let trailsCompleted = 0;
    let totalPointsDistributed = 0;
    let prevPointsDistributed = 0;

    const subcollectionPromises = collabSnap.docs.map(async (collabDoc) => {
      // Fetch both subcollections in parallel per user
      const [progressSnap, histSnap] = await Promise.all([
        adminDb.collection('users').doc(collabDoc.id).collection('trailProgress').get(),
        adminDb.collection('users').doc(collabDoc.id).collection('pointsHistory').get(),
      ]);

      // Trail progress
      progressSnap.docs.forEach(pd => {
        const pData = pd.data();
        if (pData.concluida || pData.status === 'completed') trailsCompleted++;
        else trailsStarted++;
      });

      // Points history
      histSnap.docs.forEach(hd => {
        const hData = hd.data();
        if (hData.type === 'gain') {
          if (isInRange(hData.date, start, end)) totalPointsDistributed += hData.points || 0;
          if (isInRange(hData.date, prevStart, prevEnd)) prevPointsDistributed += hData.points || 0;
        }
      });
    });

    await Promise.all(subcollectionPromises);

    // ─── 6. Rewards/Rescues ───────────────────────────────────
    let rewardsRedeemed = 0;
    let totalPointsRedeemed = 0;

    rescuesSnap.docs.forEach(d => {
      const data = d.data();
      if (isInRange(data.createdAt || data.date, start, end)) {
        rewardsRedeemed++;
        totalPointsRedeemed += data.pointsCost || data.points || 0;
      }
    });

    // ─── 7. Top 5 ─────────────────────────────────────────────
    const topCollaborators = Array.from(collabMap.entries())
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // ─── 8. Estimated impressions ─────────────────────────────
    const estimatedImpressions = activeCollaborators * 3000;
    const estimatedValue = estimatedImpressions * CPM_UNIT;

    return {
      data: {
        totalLicenses: companyData?.licenses || 0,
        activeCollaborators,
        collaboratorsWithActivity,
        missionsApproved,
        missionsPending,
        totalMissionsAvailable,
        prevMissionsApproved,
        trailsStarted,
        trailsCompleted,
        totalTrails,
        totalPointsDistributed,
        prevPointsDistributed,
        rewardsRedeemed,
        totalPointsRedeemed,
        topCollaborators,
        estimatedImpressions,
        estimatedValue,
      },
    };
  } catch (error) {
    console.error('Error in getAdminDashboardData:', error);
    return { error: 'Erro ao carregar dados do dashboard.' };
  }
}
