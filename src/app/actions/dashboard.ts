// src/app/actions/dashboard.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAdmin, requireMaster } from '@/lib/auth-guard';
import { LINKEDIN_CPM_BRL } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────────────────

export type TopCollaborator = {
  id: string;
  name: string;
  avatarUrl?: string;
  points: number;
  missionsCompleted: number;
};

export type TopCollaboratorByIcp = {
  id: string;
  name: string;
  avatarUrl?: string;
  icpScore: number;   // 0-100
  mesAno: string;     // snapshot mais recente
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
  topCollaboratorsByIcp: TopCollaboratorByIcp[];
  estimatedImpressions: number;
  estimatedValue: number;
  // Dados reais do LinkedIn (snapshots do mês corrente)
  realImpressions: number;
  realEarnedMedia: number;
  // Funil de engajamento
  funnelInvited: number;      // total de licenças usadas (colaboradores cadastrados)
  funnelActivated: number;    // ativaram conta (criaram login = activeCollaborators)
  funnelLinkedIn: number;     // conectaram o LinkedIn (têm accessToken válido)
  funnelPosted: number;       // publicaram pelo menos 1 conteúdo histórico
  funnelWatchedTrail: number; // assistiram pelo menos 1 trilha
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
    // Busca colaboradores E todos os usuários da empresa (TLs + colaboradores) para LinkedIn
    const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

    const [companyDoc, collabSnap, allUsersSnap, missionsSnap, submissionsSnap, trailsSnap, rewardsSnap, rescuesSnap] = await Promise.all([
      adminDb.collection('companies').doc(companyId).get(),
      adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'colaborador')
        .get(),
      adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', 'in', ['colaborador', 'thoughtleader'])
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
    let funnelLinkedIn = 0;
    const collabMap = new Map<string, {
      name: string;
      avatarUrl?: string;
      points: number;
      missionsCompleted: number;
    }>();

    collabSnap.docs.forEach(d => {
      const data = d.data();
      const points = data.points || 0;
      if (points > 0) collaboratorsWithActivity++;
      // LinkedIn conectado: tem accessToken na linkedinConnection
      const conn = data.linkedinConnection as Record<string, unknown> | undefined;
      if (conn?.accessToken) funnelLinkedIn++;
      collabMap.set(d.id, {
        name: data.name || data.profile?.name || 'Sem nome',
        avatarUrl: data.profile?.avatarUrl || data.avatarUrl,
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

    // ─── 5. Trail progress + Points history + Posts (subcoleções, paralelas) ──
    let trailsStarted = 0;
    let trailsCompleted = 0;
    let totalPointsDistributed = 0;
    let prevPointsDistributed = 0;
    let funnelPosted = 0;
    let funnelWatchedTrail = 0;

    const subcollectionPromises = collabSnap.docs.map(async (collabDoc) => {
      const uid = collabDoc.id;
      const [progressSnap, histSnap, pipelineSnap, scheduledSnap] = await Promise.all([
        adminDb.collection('users').doc(uid).collection('trailProgress').get(),
        adminDb.collection('users').doc(uid).collection('pointsHistory').get(),
        // Posts via contentPipeline (status=postado)
        adminDb.collection('users').doc(uid).collection('contentPipeline')
          .where('status', '==', 'postado').limit(1).get(),
        // Posts via scheduledPosts (status=published)
        adminDb.collection('users').doc(uid).collection('scheduledPosts')
          .where('status', '==', 'published').limit(1).get(),
      ]);

      // Trail progress
      let userStarted = 0;
      let userCompleted = 0;
      progressSnap.docs.forEach(pd => {
        const pData = pd.data();
        if (pData.concluida || pData.status === 'completed') userCompleted++;
        else userStarted++;
      });
      trailsCompleted += userCompleted;
      trailsStarted += userStarted;
      if (userStarted + userCompleted > 0) funnelWatchedTrail++;

      // Points history
      histSnap.docs.forEach(hd => {
        const hData = hd.data();
        if (hData.type === 'gain') {
          if (isInRange(hData.date, start, end)) totalPointsDistributed += hData.points || 0;
          if (isInRange(hData.date, prevStart, prevEnd)) prevPointsDistributed += hData.points || 0;
        }
      });

      // Postou pelo menos 1 conteúdo histórico
      if (!pipelineSnap.empty || !scheduledSnap.empty) funnelPosted++;
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

    // ─── 7. Top 5 por pontos ──────────────────────────────────
    const topCollaborators = Array.from(collabMap.entries())
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // ─── 8. Impressões reais do mês corrente (todos os usuários da empresa) ──
    // Soma snapshots LinkedIn do mês atual de TLs + colaboradores
    let realImpressions = 0;

    const linkedinSnapshotPromises = allUsersSnap.docs.map(async (userDoc) => {
      const snapDoc = await adminDb
        .collection('users').doc(userDoc.id)
        .collection('linkedinSnapshots').doc(currentMonth)
        .get();
      if (snapDoc.exists) {
        const snapData = snapDoc.data();
        realImpressions += (snapData?.totalImpressions as number) || 0;
      }
    });
    await Promise.all(linkedinSnapshotPromises);

    const realEarnedMedia = (realImpressions / 1000) * LINKEDIN_CPM_BRL;

    // ─── 9. Top 5 por ICP-Fit ─────────────────────────────────
    // Busca o snapshot mais recente de cada usuário (TL + colaborador) e extrai o ICP score se existir
    // O ICP score não é calculado aqui (seria muito caro); em vez disso buscamos scores já
    // persistidos em snapshots. Se não tiver, o card aparece vazio (será calculado quando o admin
    // acessar a página de analytics individual).
    const icpEntries: Array<{ id: string; name: string; avatarUrl?: string; icpScore: number; mesAno: string }> = [];

    const icpPromises = allUsersSnap.docs.map(async (userDoc) => {
      const d = userDoc.data();
      // Buscar o snapshot do mês corrente ou o mais recente disponível
      const snapshotsRef = adminDb.collection('users').doc(userDoc.id).collection('linkedinSnapshots');
      const latestSnap = await snapshotsRef.orderBy('__name__', 'desc').limit(1).get();
      if (latestSnap.empty) return;

      const snapData = latestSnap.docs[0].data();
      const icpScore = snapData?.icpFitScore?.overall as number | undefined;
      if (typeof icpScore !== 'number') return;

      icpEntries.push({
        id: userDoc.id,
        name: d.name || d.profile?.name || 'Sem nome',
        avatarUrl: d.profile?.avatarUrl || d.avatarUrl,
        icpScore,
        mesAno: latestSnap.docs[0].id,
      });
    });
    await Promise.all(icpPromises);

    const topCollaboratorsByIcp = icpEntries
      .sort((a, b) => b.icpScore - a.icpScore)
      .slice(0, 5);

    // ─── 10. Estimated impressions (fallback se não tiver snapshots) ──
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
        topCollaboratorsByIcp,
        estimatedImpressions,
        estimatedValue,
        realImpressions,
        realEarnedMedia,
        funnelInvited: companyData?.licenses || activeCollaborators,
        funnelActivated: activeCollaborators,
        funnelLinkedIn,
        funnelPosted,
        funnelWatchedTrail,
      },
    };
  } catch (error) {
    console.error('Error in getAdminDashboardData:', error);
    return { error: 'Erro ao carregar dados do dashboard.' };
  }
}

// ─── Master Dashboard Server Action ─────────────────────────────

export type MasterDashboardData = {
  activeCompanies: number;
  totalCollaborators: number;
  globalTrails: number;
  activeCollaborators: number;
  recentCompanies: {
    id: string;
    companyName: string;
    status: string;
    licenses: number;
    adminEmail: string;
    activeSeats: number;
    createdAt: string | null;
  }[];
};

export async function getMasterDashboardData(
  idToken: string,
): Promise<{ data?: MasterDashboardData; error?: string }> {
  try {
    await requireMaster(idToken);

    // Parallel top-level fetches (server-side Admin SDK — no Firestore rules)
    const [allCompaniesSnap, collabSnap, sessionsSnap] = await Promise.all([
      adminDb.collection('companies').get(),
      adminDb.collection('users').where('role', '==', 'colaborador').get(),
      adminDb.collection('globalSessions').get(),
    ]);

    const allCompanies = allCompaniesSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        companyName: data.companyName as string | undefined,
        status: data.status as string | undefined,
        licenses: data.licenses as number | undefined,
        adminProfile: data.adminProfile as { email?: string } | undefined,
        createdAt: data.createdAt as unknown,
      };
    });

    // Per-company seat counts
    const seatCounts: Record<string, number> = {};
    collabSnap.docs.forEach(d => {
      const cId = d.data().companyId as string;
      if (cId) seatCounts[cId] = (seatCounts[cId] || 0) + 1;
    });

    // Active collaborators
    const activeCollabCount = collabSnap.docs.filter(d => d.data().status === 'Ativo').length;

    // Global trails — parallel batch
    const trailSnaps = await Promise.all(
      sessionsSnap.docs.map(s =>
        adminDb.collection(`globalSessions/${s.id}/trails`).get()
      )
    );
    const totalGlobalTrails = trailSnaps.reduce((sum, snap) => sum + snap.size, 0);

    // Sort companies by createdAt desc, take top 5
    const sorted = [...allCompanies].sort((a, b) => {
      const da = toDate(a.createdAt) || new Date(0);
      const db2 = toDate(b.createdAt) || new Date(0);
      return db2.getTime() - da.getTime();
    });

    const recentCompanies = sorted.slice(0, 5).map(c => ({
      id: c.id,
      companyName: c.companyName || '',
      status: c.status || 'Inativa',
      licenses: c.licenses || 0,
      adminEmail: c.adminProfile?.email || '',
      activeSeats: seatCounts[c.id] || 0,
      createdAt: toDate(c.createdAt)?.toISOString() || null,
    }));

    return {
      data: {
        activeCompanies: allCompanies.filter(c => c.status === 'Ativa' || c.status === 'Trial').length,
        totalCollaborators: collabSnap.size,
        globalTrails: totalGlobalTrails,
        activeCollaborators: activeCollabCount,
        recentCompanies,
      },
    };
  } catch (error) {
    console.error('Error in getMasterDashboardData:', error);
    return { error: 'Erro ao carregar dados do painel master.' };
  }
}
