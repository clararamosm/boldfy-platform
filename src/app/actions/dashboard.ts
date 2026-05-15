// src/app/actions/dashboard.ts
'use server';

import { db as adminDb } from '@/lib/firebase-admin';
import { requireAdmin, requireMaster } from '@/lib/auth-guard';
import { LINKEDIN_CPM_BRL } from '@/lib/constants';
import { notifyReactivation } from '@/lib/notifications';

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

export type TopThoughtLeader = {
  id: string;
  name: string;
  avatarUrl?: string;
  impressions: number;
};

export type PushItem = {
  id: string;
  name: string;
  avatarUrl?: string;
  daysSinceLastPost: number;
  // Nota: email NAO eh exposto ao client. A action sendReactivationEmail
  // recebe apenas userId e busca o email server-side via Firestore.
};

export type AudienceItem = {
  label: string;
  percentage: number;
};

export type MonthlyDataPoint = {
  mesAno: string;       // "YYYY-MM"
  label: string;        // "Dez", "Jan", "Fev"...
  impressions: number;
  earnedMedia: number;
};

export type FunnelSteps = {
  invited: number;        // status='Pendente'
  activated: number;      // Ativo + sem LinkedIn
  linkedin: number;       // Tem LinkedIn + sem brand context
  brandContext: number;   // Brand context + sem trilha concluída
  firstTrail: number;     // Trilha concluída + sem post publicado
  firstPost: number;      // Post publicado + streak < 2 semanas
  consistent: number;     // streak.currentWeeks >= 2
};

export type PipelineCounts = {
  backlog: number;
  em_producao: number;
  aprovar: number;        // aprovar_ideia + aprovar_post
  agendado: number;
  postado: number;        // dentro do período
};

export type AudienceData = {
  cargos: AudienceItem[];          // top 5 por percentual
  industrias: AudienceItem[];      // top 5 (Setor)
  tamanhoEmpresa: AudienceItem[];  // top 5 (Tamanho da empresa)
};

export type DashboardData = {
  // ── Campos legados (mantidos pra retrocompatibilidade) ─────────
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
  realImpressions: number;
  realEarnedMedia: number;
  funnelInvited: number;
  funnelActivated: number;
  funnelLinkedIn: number;
  funnelPosted: number;
  funnelWatchedTrail: number;

  // ── KPIs combinados (Platform + TL) pro banner geral ───────────
  combinedActiveUsers: number;
  combinedTotalUsers: number;
  combinedPostsPublished: number;
  prevCombinedPostsPublished: number;
  combinedImpressionsInPeriod: number;
  prevCombinedImpressionsInPeriod: number;
  combinedEarnedMediaInPeriod: number;
  prevCombinedEarnedMediaInPeriod: number;

  // ── Box Platform (só colaboradores) ────────────────────────────
  platformTotalUsers: number;
  platformPostsPublished: number;
  platformImpressionsInPeriod: number;

  // ── Funil de engajamento (7 steps mutuamente exclusivos) ───────
  funnelSteps: FunnelSteps;

  // ── Precisam de empurrão (ativos 14+ dias sem postar) ──────────
  pushNeeded: PushItem[];

  // ── Box Thought Leader ────────────────────────────────────────
  tlActiveUsers: number;
  tlTotalUsers: number;
  tlPostsPublished: number;
  tlImpressionsInPeriod: number;
  tlEngagement: number;
  tlPipeline: PipelineCounts;
  topThoughtLeaders: TopThoughtLeader[];

  // ── Séries temporais (últimos 6 meses) ────────────────────────
  monthlySeries: MonthlyDataPoint[];

  // ── Audiência agregada da empresa ─────────────────────────────
  audience: AudienceData;

  // ── Metadata ──────────────────────────────────────────────────
  lastSnapshotAt: string | null;  // ISO timestamp do snapshot mais recente
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

// ─── Helpers internos ──────────────────────────────────────────

/** Gera os últimos N meses no formato YYYY-MM (mais antigo → mais recente). */
function lastNMonths(n: number): { mesAno: string; label: string }[] {
  const out: { mesAno: string; label: string }[] = [];
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mesAno = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ mesAno, label: labels[d.getMonth()] });
  }
  return out;
}

/**
 * Detecta se um user preencheu o Manual de Marca Pessoal.
 * Criterio alinhado com o onboarding: precisa ter `basics.position` E
 * `basics.expertise` preenchidos (os 2 campos obrigatorios do formulario).
 * Esse mesmo criterio marca o item `personal-brand` como completo na
 * checklist do colaborador, garantindo coerencia entre o funil do
 * dashboard do admin e o que o colaborador ve no proprio checklist.
 *
 * Suporta tanto a estrutura v2 (basics.{...}) quanto campos antigos no
 * topo do personalBrand pra compat com dados legados.
 */
function hasBrandContext(data: Record<string, unknown>): boolean {
  const pb = data.personalBrand as Record<string, unknown> | undefined;
  if (!pb) return false;
  const basics = pb.basics as Record<string, unknown> | undefined;
  const position = (basics?.position as string | undefined) || (pb.position as string | undefined);
  const expertise = (basics?.expertise as string | undefined) || (pb.expertise as string | undefined);
  return Boolean(
    position && String(position).trim() &&
    expertise && String(expertise).trim(),
  );
}

/** Pega lastPostAt (data ISO) procurando em contentPipeline + scheduledPosts. Retorna null se nunca postou. */
function maxIsoDate(...dates: (string | null | undefined)[]): string | null {
  let max: string | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!max || d > max) max = d;
  }
  return max;
}

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
    const now = new Date();

    const currentMonth = now.toISOString().substring(0, 7);
    const monthsWindow = lastNMonths(6); // [{ mesAno, label }, ...] últimos 6 meses
    const monthsWindowSet = new Set(monthsWindow.map(m => m.mesAno));

    // ─── 1. Buscas de topo (paralelas) ────────────────────────
    const [
      companyDoc,
      colabSnap,
      tlSnap,
      missionsSnap,
      submissionsSnap,
      trailsSnap,
      rescuesSnap,
    ] = await Promise.all([
      adminDb.collection('companies').doc(companyId).get(),
      adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'colaborador')
        .get(),
      adminDb.collection('users')
        .where('companyId', '==', companyId)
        .where('role', '==', 'thoughtleader')
        .get(),
      adminDb.collection('companies').doc(companyId).collection('missions').get(),
      adminDb.collection('companies').doc(companyId).collection('missionSubmissions').get(),
      adminDb.collection('companies').doc(companyId).collection('trails').get(),
      adminDb.collection('companies').doc(companyId).collection('rescues').get(),
    ]);

    const companyData = companyDoc.data();

    // ─── 2. Contagens de usuários (separadas por role) ────────
    const platformTotalUsers = colabSnap.size;
    const tlTotalUsers = tlSnap.size;
    const activeCollaborators = colabSnap.docs.filter(d => d.data().status === 'Ativo').length;
    const tlActiveUsers = tlSnap.docs.filter(d => d.data().status === 'Ativo').length;

    // Mapa de colaboradores pra acumular pontos/missões e funil
    let collaboratorsWithActivity = 0;
    let funnelLinkedIn = 0;
    // Mapa intermediario com TODOS os campos (uso interno, server-side).
    // Pra retorno ao client, apenas campos seguros sao serializados.
    const collabMap = new Map<string, {
      name: string;
      avatarUrl?: string;
      status: string;
      points: number;
      missionsCompleted: number;
      hasLinkedIn: boolean;
      hasBrandCtx: boolean;
      hasCompletedTrail: boolean;
      hasPosted: boolean;
      streakWeeks: number;
      lastPostAt: string | null;
    }>();

    colabSnap.docs.forEach(d => {
      const data = d.data();
      const points = data.points || 0;
      if (points > 0) collaboratorsWithActivity++;
      const conn = data.linkedinConnection as Record<string, unknown> | undefined;
      const hasLinkedIn = Boolean(conn?.accessToken);
      if (hasLinkedIn) funnelLinkedIn++;
      const streak = data.streak as Record<string, unknown> | undefined;
      collabMap.set(d.id, {
        name: data.name || data.profile?.name || 'Sem nome',
        avatarUrl: data.profile?.avatarUrl || data.avatarUrl,
        status: data.status || 'Pendente',
        points,
        missionsCompleted: 0,
        hasLinkedIn,
        hasBrandCtx: hasBrandContext(data),
        hasCompletedTrail: false,
        hasPosted: false,
        streakWeeks: typeof streak?.currentWeeks === 'number' ? (streak.currentWeeks as number) : 0,
        lastPostAt: null,
      });
    });

    // ─── 3. Missões ───────────────────────────────────────────
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

    // ─── 4. Trilhas ───────────────────────────────────────────
    const totalTrails = trailsSnap.docs.filter(d => {
      const data = d.data();
      return data.active === true || data.ativa === true;
    }).length;

    // ─── 5. Por-colaborador: trail progress, points, posts ────
    let trailsStarted = 0;
    let trailsCompleted = 0;
    let totalPointsDistributed = 0;
    let prevPointsDistributed = 0;
    let funnelPosted = 0;
    let funnelWatchedTrail = 0;
    let platformPostsPublished = 0;
    let prevPlatformPostsPublished = 0;

    await Promise.all(colabSnap.docs.map(async (collabDoc) => {
      const uid = collabDoc.id;
      const c = collabMap.get(uid);
      const [progressSnap, histSnap, pipelineSnap, scheduledSnap] = await Promise.all([
        adminDb.collection('users').doc(uid).collection('trailProgress').get(),
        adminDb.collection('users').doc(uid).collection('pointsHistory').get(),
        adminDb.collection('users').doc(uid).collection('contentPipeline').where('status', '==', 'postado').get(),
        adminDb.collection('users').doc(uid).collection('scheduledPosts').where('status', '==', 'published').get(),
      ]);

      // Trilhas
      let userStarted = 0;
      let userCompleted = 0;
      progressSnap.docs.forEach(pd => {
        const pData = pd.data();
        if (pData.concluida || pData.status === 'completed') userCompleted++;
        else userStarted++;
      });
      trailsCompleted += userCompleted;
      trailsStarted += userStarted;
      if (userCompleted > 0 && c) c.hasCompletedTrail = true;
      if (userStarted + userCompleted > 0) funnelWatchedTrail++;

      // Pontos
      histSnap.docs.forEach(hd => {
        const hData = hd.data();
        if (hData.type === 'gain') {
          if (isInRange(hData.date, start, end)) totalPointsDistributed += hData.points || 0;
          if (isInRange(hData.date, prevStart, prevEnd)) prevPointsDistributed += hData.points || 0;
        }
      });

      // Posts (contentPipeline + scheduledPosts publicados)
      const hasAnyPipelinePost = !pipelineSnap.empty;
      const hasAnyScheduledPost = !scheduledSnap.empty;
      if (hasAnyPipelinePost || hasAnyScheduledPost) {
        funnelPosted++;
        if (c) c.hasPosted = true;
      }

      // Contagem de posts no período + lastPostAt
      let lastPipelineAt: string | null = null;
      pipelineSnap.docs.forEach(pd => {
        const data = pd.data();
        const publishedAt = (data.publishedAt as string | undefined) || null;
        if (publishedAt) {
          lastPipelineAt = maxIsoDate(lastPipelineAt, publishedAt);
          if (isInRange(publishedAt, start, end)) platformPostsPublished++;
          if (isInRange(publishedAt, prevStart, prevEnd)) prevPlatformPostsPublished++;
        }
      });
      let lastScheduledAt: string | null = null;
      scheduledSnap.docs.forEach(sd => {
        const data = sd.data();
        const publishedAt = (data.publishedAt as string | undefined) || null;
        if (publishedAt) {
          lastScheduledAt = maxIsoDate(lastScheduledAt, publishedAt);
          if (isInRange(publishedAt, start, end)) platformPostsPublished++;
          if (isInRange(publishedAt, prevStart, prevEnd)) prevPlatformPostsPublished++;
        }
      });
      if (c) c.lastPostAt = maxIsoDate(lastPipelineAt, lastScheduledAt);
    }));

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

    // ─── 7. Top 5 colaboradores por pontos ────────────────────
    const topCollaborators: TopCollaborator[] = Array.from(collabMap.entries())
      .map(([id, c]) => ({ id, name: c.name, avatarUrl: c.avatarUrl, points: c.points, missionsCompleted: c.missionsCompleted }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);

    // ─── 8. Funil de engajamento (7 steps mutuamente exclusivos) ──
    const funnelSteps: FunnelSteps = {
      invited: 0, activated: 0, linkedin: 0, brandContext: 0,
      firstTrail: 0, firstPost: 0, consistent: 0,
    };
    collabMap.forEach(c => {
      if (c.status === 'Pendente') {
        funnelSteps.invited++;
      } else if (c.streakWeeks >= 2) {
        funnelSteps.consistent++;
      } else if (c.hasPosted) {
        funnelSteps.firstPost++;
      } else if (c.hasCompletedTrail) {
        funnelSteps.firstTrail++;
      } else if (c.hasBrandCtx) {
        funnelSteps.brandContext++;
      } else if (c.hasLinkedIn) {
        funnelSteps.linkedin++;
      } else {
        funnelSteps.activated++;
      }
    });

    // ─── 9. Push needed: colaboradores ativos sem postar 14+ dias ──
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const nowMs = now.getTime();
    const pushNeeded: PushItem[] = [];
    collabMap.forEach((c, id) => {
      if (c.status !== 'Ativo') return;
      // Considera "ativos sem postar" os que já postaram alguma vez mas estão silenciosos,
      // OU os que nunca postaram MAS já passaram pelos primeiros marcos (LinkedIn conectado).
      const referenceMs = c.lastPostAt ? new Date(c.lastPostAt).getTime() : null;
      let days: number;
      if (referenceMs) {
        days = Math.floor((nowMs - referenceMs) / (24 * 60 * 60 * 1000));
        if (nowMs - referenceMs < FOURTEEN_DAYS_MS) return;
      } else {
        // Nunca postou: só entra na lista se já tem LinkedIn conectado (pré-condição pra postar)
        if (!c.hasLinkedIn) return;
        days = -1; // sentinel — UI mostra "ainda sem primeiro post"
      }
      pushNeeded.push({
        id,
        name: c.name,
        avatarUrl: c.avatarUrl,
        daysSinceLastPost: days,
      });
    });
    pushNeeded.sort((a, b) => {
      // Quem nunca postou (-1) por último; o resto por dias decrescentes
      if (a.daysSinceLastPost === -1 && b.daysSinceLastPost !== -1) return 1;
      if (b.daysSinceLastPost === -1 && a.daysSinceLastPost !== -1) return -1;
      return b.daysSinceLastPost - a.daysSinceLastPost;
    });

    // ─── 10. Thought Leaders: pipeline + posts + impressões ───
    const tlPipeline: PipelineCounts = {
      backlog: 0, em_producao: 0, aprovar: 0, agendado: 0, postado: 0,
    };
    let tlPostsPublished = 0;
    let prevTlPostsPublished = 0;
    let tlEngagement = 0;
    const tlImpressionsMap = new Map<string, number>(); // userId -> impressões no período
    const tlNameMap = new Map<string, { name: string; avatarUrl?: string }>();

    tlSnap.docs.forEach(d => {
      const data = d.data();
      tlNameMap.set(d.id, {
        name: data.name || data.profile?.name || 'Sem nome',
        avatarUrl: data.profile?.avatarUrl || data.avatarUrl,
      });
    });

    await Promise.all(tlSnap.docs.map(async (tlDoc) => {
      const uid = tlDoc.id;
      const [pipelineSnap, scheduledSnap] = await Promise.all([
        adminDb.collection('users').doc(uid).collection('contentPipeline').get(),
        adminDb.collection('users').doc(uid).collection('scheduledPosts').get(),
      ]);

      // Pipeline counts (todos os posts de TL na pipeline + scheduled)
      pipelineSnap.docs.forEach(pd => {
        const data = pd.data();
        const st = data.status as string | undefined;
        const publishedAt = data.publishedAt as string | undefined;
        if (st === 'backlog') tlPipeline.backlog++;
        else if (st === 'em_producao') tlPipeline.em_producao++;
        else if (st === 'aprovar_ideia' || st === 'aprovar_post') tlPipeline.aprovar++;
        else if (st === 'agendado') tlPipeline.agendado++;
        else if (st === 'postado') {
          if (publishedAt && isInRange(publishedAt, start, end)) {
            tlPipeline.postado++;
            tlPostsPublished++;
          }
          if (publishedAt && isInRange(publishedAt, prevStart, prevEnd)) {
            prevTlPostsPublished++;
          }
        }
        // Engajamento dos posts publicados
        if (st === 'postado') {
          tlEngagement += (data.analyticsEngagement as number) || 0;
        }
      });

      scheduledSnap.docs.forEach(sd => {
        const data = sd.data();
        const st = data.status as string | undefined;
        const publishedAt = data.publishedAt as string | undefined;
        if (st === 'published' && publishedAt) {
          if (isInRange(publishedAt, start, end)) {
            tlPostsPublished++;
          }
          if (isInRange(publishedAt, prevStart, prevEnd)) {
            prevTlPostsPublished++;
          }
        }
      });
    }));

    // ─── 11. Snapshots LinkedIn: impressões por mês (séries) + audiência ──
    // Estratégia eficiente: 1 query por user (all snapshots), filtrar local pelos últimos 6 meses.
    let platformImpressionsInPeriod = 0;
    let tlImpressionsInPeriod = 0;
    let prevPlatformImpressionsInPeriod = 0;
    let prevTlImpressionsInPeriod = 0;
    const monthlyImpressionsByMonth = new Map<string, number>(); // mesAno -> total

    // Audiência: agrega demographics dos snapshots mais recentes
    type AggBucket = { sum: number; count: number };
    const cargosAgg = new Map<string, AggBucket>();
    const setoresAgg = new Map<string, AggBucket>();
    const tamanhosAgg = new Map<string, AggBucket>();

    let latestUploadAt: string | null = null;

    const allUsers = [...colabSnap.docs, ...tlSnap.docs];
    const isTL = (uid: string) => tlNameMap.has(uid);

    await Promise.all(allUsers.map(async (userDoc) => {
      const allSnaps = await adminDb
        .collection('users').doc(userDoc.id)
        .collection('linkedinSnapshots').get();
      if (allSnaps.empty) return;

      // Snapshot mais recente (lex order de YYYY-MM = ordem cronológica)
      const sorted = allSnaps.docs.sort((a, b) => b.id.localeCompare(a.id));
      const latestDoc = sorted[0];
      const latestData = latestDoc.data();

      // Track última atualização
      const uploadedAt = latestData?.uploadedAt as string | undefined;
      if (uploadedAt && (!latestUploadAt || uploadedAt > latestUploadAt)) {
        latestUploadAt = uploadedAt;
      }

      // Agregar demographics do snapshot mais recente
      const demographics = (latestData?.demographics || []) as Array<{ category: string; label: string; percentage: number }>;
      const userImpressionsLatest = (latestData?.totalImpressions as number) || 0;
      demographics.forEach(dem => {
        const cat = (dem.category || '').toLowerCase();
        const item = { sum: dem.percentage, count: 1 };
        const target =
          cat.includes('cargo') ? cargosAgg :
          (cat.includes('setor') || cat.includes('indústria') || cat.includes('industria')) ? setoresAgg :
          (cat.includes('tamanho') || cat.includes('size')) ? tamanhosAgg :
          null;
        if (!target) return;
        const existing = target.get(dem.label);
        if (existing) {
          existing.sum += dem.percentage;
          existing.count += 1;
        } else {
          target.set(dem.label, item);
        }
      });

      // Acumular impressões dos snapshots por mês (últimos 6 meses)
      const userIsTL = isTL(userDoc.id);
      sorted.forEach(snapDoc => {
        const mesAno = snapDoc.id;
        const snapData = snapDoc.data();
        const impr = (snapData?.totalImpressions as number) || 0;

        if (monthsWindowSet.has(mesAno)) {
          monthlyImpressionsByMonth.set(mesAno, (monthlyImpressionsByMonth.get(mesAno) || 0) + impr);
        }

        // Bucket no período atual (assumindo mesAno representa o mês inteiro)
        // Verifica se o mês inteiro cai dentro do range solicitado (heurística simples)
        const [yy, mm] = mesAno.split('-').map(Number);
        if (!yy || !mm) return;
        const snapStart = new Date(yy, mm - 1, 1);
        const snapEnd = new Date(yy, mm, 0);

        if (snapStart >= start && snapEnd <= end) {
          if (userIsTL) tlImpressionsInPeriod += impr;
          else platformImpressionsInPeriod += impr;
        }
        if (snapStart >= prevStart && snapEnd <= prevEnd) {
          if (userIsTL) prevTlImpressionsInPeriod += impr;
          else prevPlatformImpressionsInPeriod += impr;
        }
      });

      // Garde de impressões do mês corrente como fallback (compat com dado legado)
      void userImpressionsLatest;
    }));

    // Caso o usuário ainda não tenha snapshot do período (comum em trial), tentamos snapshot do mês corrente
    if (platformImpressionsInPeriod === 0 && tlImpressionsInPeriod === 0) {
      // Fallback: usa snapshots do mês corrente direto
      const currentMonthPromises = allUsers.map(async (userDoc) => {
        const snapDoc = await adminDb
          .collection('users').doc(userDoc.id)
          .collection('linkedinSnapshots').doc(currentMonth)
          .get();
        if (!snapDoc.exists) return;
        const impr = (snapDoc.data()?.totalImpressions as number) || 0;
        if (isTL(userDoc.id)) tlImpressionsInPeriod += impr;
        else platformImpressionsInPeriod += impr;
      });
      await Promise.all(currentMonthPromises);
    }

    // Top 3 TLs por impressões no período (usa snapshots do mês corrente como proxy)
    await Promise.all(tlSnap.docs.map(async (tlDoc) => {
      const snapDoc = await adminDb
        .collection('users').doc(tlDoc.id)
        .collection('linkedinSnapshots').doc(currentMonth)
        .get();
      if (snapDoc.exists) {
        tlImpressionsMap.set(tlDoc.id, (snapDoc.data()?.totalImpressions as number) || 0);
      }
    }));
    const topThoughtLeaders: TopThoughtLeader[] = Array.from(tlImpressionsMap.entries())
      .map(([id, impressions]) => {
        const info = tlNameMap.get(id);
        return {
          id,
          name: info?.name || 'Sem nome',
          avatarUrl: info?.avatarUrl,
          impressions,
        };
      })
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 3);

    // Séries temporais montadas a partir de monthlyImpressionsByMonth
    const monthlySeries: MonthlyDataPoint[] = monthsWindow.map(({ mesAno, label }) => {
      const impr = monthlyImpressionsByMonth.get(mesAno) || 0;
      return {
        mesAno,
        label,
        impressions: impr,
        earnedMedia: (impr / 1000) * LINKEDIN_CPM_BRL,
      };
    });

    // Top 5 por categoria de demografia
    const toTop5 = (m: Map<string, AggBucket>): AudienceItem[] => {
      return Array.from(m.entries())
        .map(([label, b]) => ({ label, percentage: b.count > 0 ? b.sum / b.count : 0 }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5);
    };

    const audience: AudienceData = {
      cargos: toTop5(cargosAgg),
      industrias: toTop5(setoresAgg),
      tamanhoEmpresa: toTop5(tamanhosAgg),
    };

    // ─── 12. KPIs combinados ──────────────────────────────────
    const realImpressions = platformImpressionsInPeriod + tlImpressionsInPeriod;
    const realEarnedMedia = (realImpressions / 1000) * LINKEDIN_CPM_BRL;
    const combinedActiveUsers = activeCollaborators + tlActiveUsers;
    const combinedTotalUsers = platformTotalUsers + tlTotalUsers;
    const combinedPostsPublished = platformPostsPublished + tlPostsPublished;
    const prevCombinedPostsPublished = prevPlatformPostsPublished + prevTlPostsPublished;
    const combinedImpressionsInPeriod = realImpressions;
    const prevCombinedImpressionsInPeriod = prevPlatformImpressionsInPeriod + prevTlImpressionsInPeriod;
    const combinedEarnedMediaInPeriod = realEarnedMedia;
    const prevCombinedEarnedMediaInPeriod = (prevCombinedImpressionsInPeriod / 1000) * LINKEDIN_CPM_BRL;

    // ─── 13. Estimated impressions (fallback se não tem snapshots) ──
    const estimatedImpressions = combinedActiveUsers * 3000;
    const estimatedValue = estimatedImpressions * CPM_UNIT;

    return {
      data: {
        // Legados
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
        topCollaboratorsByIcp: [], // ICP oculto da UI por enquanto — preservado o cálculo lá em getIcpFitScore
        estimatedImpressions,
        estimatedValue,
        realImpressions,
        realEarnedMedia,
        funnelInvited: platformTotalUsers,
        funnelActivated: activeCollaborators,
        funnelLinkedIn,
        funnelPosted,
        funnelWatchedTrail,

        // Novos campos
        combinedActiveUsers,
        combinedTotalUsers,
        combinedPostsPublished,
        prevCombinedPostsPublished,
        combinedImpressionsInPeriod,
        prevCombinedImpressionsInPeriod,
        combinedEarnedMediaInPeriod,
        prevCombinedEarnedMediaInPeriod,
        platformTotalUsers,
        platformPostsPublished,
        platformImpressionsInPeriod,
        funnelSteps,
        pushNeeded,
        tlActiveUsers,
        tlTotalUsers,
        tlPostsPublished,
        tlImpressionsInPeriod,
        tlEngagement,
        tlPipeline,
        topThoughtLeaders,
        monthlySeries,
        audience,
        lastSnapshotAt: latestUploadAt,
      },
    };
  } catch (error) {
    console.error('Error in getAdminDashboardData:', error);
    return { error: 'Erro ao carregar dados do dashboard.' };
  }
}

// ─── Send Reactivation Email ────────────────────────────────────

/**
 * Disparada pelo botao "Avisar" no card Precisam de Empurrao do dashboard.
 * Envia email com tom FOMO mostrando pontos perdidos da equipe e ranking.
 */
export async function sendReactivationEmail(
  idToken: string,
  companyId: string,
  targetUserId: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    await requireAdmin(idToken, companyId);

    const targetDoc = await adminDb.collection('users').doc(targetUserId).get();
    if (!targetDoc.exists) return { error: 'Colaborador nao encontrado.' };
    const targetData = targetDoc.data();
    if (targetData?.companyId !== companyId) return { error: 'Colaborador de outra empresa.' };
    if (targetData?.role !== 'colaborador') return { error: 'Acao disponivel apenas para colaboradores.' };

    // ── Calcula daysSinceLastPost olhando posts publicados
    const [pipelineSnap, scheduledSnap] = await Promise.all([
      adminDb.collection('users').doc(targetUserId).collection('contentPipeline')
        .where('status', '==', 'postado').get(),
      adminDb.collection('users').doc(targetUserId).collection('scheduledPosts')
        .where('status', '==', 'published').get(),
    ]);
    let lastPostMs: number | null = null;
    pipelineSnap.docs.forEach(d => {
      const at = d.data().publishedAt as string | undefined;
      if (at) {
        const ms = new Date(at).getTime();
        if (!lastPostMs || ms > lastPostMs) lastPostMs = ms;
      }
    });
    scheduledSnap.docs.forEach(d => {
      const at = d.data().publishedAt as string | undefined;
      if (at) {
        const ms = new Date(at).getTime();
        if (!lastPostMs || ms > lastPostMs) lastPostMs = ms;
      }
    });
    const daysSinceLastPost = lastPostMs
      ? Math.floor((Date.now() - lastPostMs) / (24 * 60 * 60 * 1000))
      : -1;

    // ── Calcula pontos do time nos ultimos 30 dias + top colaborador
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const colabSnap = await adminDb.collection('users')
      .where('companyId', '==', companyId)
      .where('role', '==', 'colaborador')
      .get();

    let teamPointsRecent = 0;
    type TeamMember = { name: string; points: number };
    const teamMembers: TeamMember[] = [];

    await Promise.all(colabSnap.docs.map(async (cd) => {
      if (cd.id === targetUserId) return; // ignora o proprio destinatario
      const cData = cd.data();
      const name = cData.name || cData.profile?.name || 'Colaborador';
      teamMembers.push({ name, points: cData.points || 0 });

      const histSnap = await adminDb.collection('users').doc(cd.id)
        .collection('pointsHistory').get();
      histSnap.docs.forEach(hd => {
        const hData = hd.data();
        if (hData.type !== 'gain') return;
        const d = toDate(hData.date);
        if (!d || d < thirtyDaysAgo) return;
        teamPointsRecent += hData.points || 0;
      });
    }));

    const sortedTeam = teamMembers.sort((a, b) => b.points - a.points);
    const top = sortedTeam[0];

    const result = await notifyReactivation({
      userId: targetUserId,
      daysSinceLastPost,
      teamPointsRecent,
      topCollaboratorName: top?.name || '',
      topCollaboratorPoints: top?.points || 0,
    });

    if (!result.success) {
      return { error: result.reason || 'Falha ao enviar email.' };
    }
    return { success: true };
  } catch (error) {
    console.error('Error in sendReactivationEmail:', error);
    return { error: error instanceof Error ? error.message : 'Erro desconhecido.' };
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
