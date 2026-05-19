// src/app/colaborador/dashboard/page.tsx
// Gamified dashboard — Bento grid layout with hero, check-in, missions, trails,
// conquests progress/badges, points, and rewards cards.
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import {
  collection, getDocs, getDoc, doc, query, where, orderBy, Timestamp,
} from 'firebase/firestore';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Zap, BookOpen, ChevronRight } from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { getWeekMonday } from '@/lib/iso-week';
import { getNextConquestTarget, getConquestGoalName, getLevelFromCycles, catchUpConquests } from '@/app/actions';
import { getAuthToken } from '@/lib/auth-client';

// Dashboard sub-components
import { HeroCard } from '@/components/gamification/dashboard/hero-card';
import { CheckinCard } from '@/components/gamification/dashboard/checkin-card';
import { ConquestsProgressCard } from '@/components/gamification/dashboard/conquests-progress-card';
import { ConquestsBadgesCard } from '@/components/gamification/dashboard/conquests-badges-card';
import { PointsCard } from '@/components/gamification/dashboard/points-card';
import { RewardsCard } from '@/components/gamification/dashboard/rewards-card';
import { UploadPendingBanner } from '@/components/linkedin-analytics/upload-pending-banner';
import { useRouter } from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────

type Mission = {
  id: string;
  title: string;
  points: number;
};

type Trail = {
  id: string;
  title: string;
  totalPhases: number;
  completedPhases: number;
  progress: number;
};

type DashboardData = {
  userName: string;
  avatarUrl?: string;
  points: number;
  level: number;
  cyclesCompleted: number;
  // Streak
  streakCurrentWeeks: number;
  streakPostsThisWeek: number;
  streakLastCompletedWeek: string;
  streakCurrentWeekId: string;
  weekDaysWithPosts: boolean[];
  // Conquests
  completedConquests: string[];
  // Real counts for conquest progress
  totalPublications: number;
  totalApprovedMissions: number;
  totalCompletedTrails: number;
  // Missions / Trails
  activeMissions: Mission[];
  trails: Trail[];
  // Points breakdown
  totalEarned: number;
  totalSpent: number;
  // Rewards
  redeemed: number;
  availableRewards: number;
};

// ─── Sub-components ───────────────────────────────────────────────

const MissionItem = ({ title, points, pointsLabel }: { title: string; points: number; pointsLabel: string }) => (
  <Link href="/colaborador/missoes" className="flex items-center justify-between p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Zap className="h-4 w-4 text-primary" />
      </div>
      <span className="text-sm font-medium">{title}</span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-xs text-primary font-medium">+{points} {pointsLabel}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  </Link>
);

const TrailItem = ({ title, progress }: { title: string; progress: number }) => (
  <Link href="/colaborador/trilhas" className="block p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <span className="text-xs text-muted-foreground">{progress}%</span>
    </div>
    <Progress value={progress} className="h-2" />
  </Link>
);

// ─── Skeleton ─────────────────────────────────────────────────────

const DashboardSkeleton = () => (
  <div className="space-y-4 p-6">
    <Card><CardContent className="p-5"><Skeleton className="h-20" /></CardContent></Card>
    <Card><CardContent className="p-5"><Skeleton className="h-48" /></CardContent></Card>
    <div className="grid md:grid-cols-2 gap-4">
      <Card><CardContent className="p-5"><Skeleton className="h-40" /></CardContent></Card>
      <Card><CardContent className="p-5"><Skeleton className="h-40" /></CardContent></Card>
      <Card><CardContent className="p-5"><Skeleton className="h-32" /></CardContent></Card>
      <Card><CardContent className="p-5"><Skeleton className="h-32" /></CardContent></Card>
      <Card><CardContent className="p-5"><Skeleton className="h-24" /></CardContent></Card>
      <Card><CardContent className="p-5"><Skeleton className="h-24" /></CardContent></Card>
    </div>
  </div>
);

// ─── Conquest helpers ──────────────────────────────────────────────
// getNextConquestTarget + getConquestGoalName imported from gamification-constants
// They handle infinite ladders for pub/trail/mission and finite for seq.

// ─── Main Component ───────────────────────────────────────────────

export default function ColaboradorDashboardPage() {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const t = useT();

  // Detecta se o extract do mês passado ainda não foi feito. Reflete a
  // mesma regra usada na página de Analytics (compara com o mês anterior,
  // não com o mês corrente — o extract só fecha quando o mês termina).
  const uploadPending = React.useMemo(() => {
    if (!authUser) return false;
    const status = (authUser as { linkedinSnapshotStatus?: { lastUploadMonth?: string } }).linkedinSnapshotStatus;
    const lastMonth = status?.lastUploadMonth;
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    return !lastMonth || lastMonth < previousMonth;
  }, [authUser]);

  const fetchDashboard = useCallback(async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) return;

      const userData = userDocSnap.data();
      const companyId = userData.companyId;
      if (!companyId) return;

      const weekMonday = getWeekMonday();

      // ── Parallel queries (batch 1: non-dependent) ──
      const [
        allMissionsSnap,
        missionSubsSnap,
        rewardsSnap,
        progressSnap,
        rescuesSnap,
        gainHistorySnap,
        spentHistorySnap,
        weekPostsSnap,
        pubHistorySnap,
        missionSubmissionsSnap,
        activatedGlobalSnap,
      ] = await Promise.all([
        // All missions (NO status filter — status is derived client-side)
        getDocs(collection(db, 'companies', companyId, 'missions')),
        // All submissions for this user (to derive mission status)
        getDocs(collection(db, 'companies', companyId, 'missionSubmissions')),
        getDocs(collection(db, 'companies', companyId, 'rewards')),
        getDocs(collection(db, 'users', uid, 'trailProgress')),
        getDocs(collection(db, 'users', uid, 'rescues')),
        getDocs(query(
          collection(db, 'users', uid, 'pointsHistory'),
          where('type', '==', 'gain'),
        )),
        getDocs(query(
          collection(db, 'users', uid, 'pointsHistory'),
          where('type', '==', 'spend'),
        )),
        getDocs(query(
          collection(db, 'users', uid, 'pointsHistory'),
          where('source', '==', 'publicacao'),
          where('date', '>=', Timestamp.fromDate(weekMonday)),
        )),
        // Real publication count for conquest progress
        getDocs(query(
          collection(db, 'users', uid, 'pointsHistory'),
          where('source', '==', 'publicacao'),
        )),
        // Approved missions count for conquest progress
        getDocs(query(
          collection(db, 'companies', companyId, 'missionSubmissions'),
          where('userId', '==', uid),
          where('status', '==', 'approved'),
        )),
        // Activated global trails for this company
        getDocs(collection(db, 'companies', companyId, 'activatedGlobalTrails')),
      ]);

      // ── Parse missions (derive active status client-side, same as missoes page) ──
      const userSubs: Record<string, { status: string }> = {};
      missionSubsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.userId === uid) {
          const existing = userSubs[data.missionId];
          if (!existing || data.status === 'pending' || data.status === 'approved') {
            userSubs[data.missionId] = { status: data.status };
          }
        }
      });

      const now = new Date();
      const missions: Mission[] = [];
      allMissionsSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        // Skip trail-type missions assigned to other users
        const isTrailMission = data.type === 'trail_content' || data.type === 'trail_trigger';
        if (isTrailMission && data.assignedTo && data.assignedTo !== uid) return;

        const sub = userSubs[docSnap.id];
        // Already completed or awaiting → not active for dashboard
        if (sub?.status === 'approved' || sub?.status === 'pending') return;

        const isFixed = data.type === 'fixed';
        const start = data.startDate?.toDate ? data.startDate.toDate() : data.startDate ? new Date(data.startDate) : null;
        const end = data.endDate?.toDate ? data.endDate.toDate() : data.endDate ? new Date(data.endDate) : null;

        // Derive status
        if (!isFixed && start && now < start) return; // scheduled → skip
        if (!isFixed && end && now > end) return;      // expired → skip

        // At this point it's an active mission (pendente or rejeitada)
        missions.push({
          id: docSnap.id,
          title: data.name || data.title || 'Sem titulo',
          points: data.points || 0,
        });
      });

      // ── Parse trails (correct 2-source pattern: global + custom sessions) ──
      const progressMap: Record<string, number[]> = {};
      progressSnap.docs.forEach(d => {
        progressMap[d.id] = d.data().modulosCompletos || [];
      });

      type TrailDoc = { id: string; titulo: string; modulos: unknown[]; ativa?: boolean; ordem?: number };
      const allTrailDocs: TrailDoc[] = [];

      // Source 1: Activated global trails — fetch all in parallel
      const activatedBySession: Record<string, string[]> = {};
      activatedGlobalSnap.docs.forEach(d => {
        const sessId = d.data().sessionId;
        if (!sessId) return;
        if (!activatedBySession[sessId]) activatedBySession[sessId] = [];
        activatedBySession[sessId].push(d.id);
      });
      const globalTrailReqs: Array<Promise<TrailDoc | null>> = [];
      for (const [sessId, trailIds] of Object.entries(activatedBySession)) {
        for (const tid of trailIds) {
          globalTrailReqs.push(
            getDoc(doc(db, `globalSessions/${sessId}/trails`, tid))
              .then(tDoc => {
                if (!tDoc.exists()) return null;
                const data = tDoc.data();
                if (data.ativa === false) return null;
                return {
                  id: tDoc.id,
                  titulo: data.titulo || 'Sem titulo',
                  modulos: data.modulos || [],
                  ativa: data.ativa,
                  ordem: data.ordem,
                };
              })
              .catch(() => null)
          );
        }
      }

      // Source 2: Company custom sessions → trails — fan out in parallel
      let customTrailDocs: TrailDoc[] = [];
      try {
        const compSessSnap = await getDocs(
          query(collection(db, `companies/${companyId}/sessions`), orderBy('ordem', 'asc'))
        );
        const activeSessions = compSessSnap.docs.filter(d => d.data().ativa !== false);
        const sessionTrailSnaps = await Promise.all(
          activeSessions.map(sessDoc =>
            getDocs(
              query(collection(db, `companies/${companyId}/sessions/${sessDoc.id}/trails`), orderBy('ordem', 'asc'))
            ).catch(() => null)
          )
        );
        customTrailDocs = sessionTrailSnaps.flatMap(snap => {
          if (!snap) return [];
          return snap.docs
            .map(td => {
              const data = td.data();
              if (data.ativa === false) return null;
              return {
                id: td.id,
                titulo: data.titulo || 'Sem titulo',
                modulos: data.modulos || [],
                ativa: data.ativa,
                ordem: data.ordem,
              } as TrailDoc;
            })
            .filter((t): t is TrailDoc => t !== null);
        });
      } catch { /* skip if no sessions collection */ }

      const globalTrailDocs = (await Promise.all(globalTrailReqs)).filter((t): t is TrailDoc => t !== null);
      allTrailDocs.push(...globalTrailDocs, ...customTrailDocs);

      // Build Trail[] with progress
      const trails: Trail[] = allTrailDocs.map(t => {
        const totalPhases = (t.modulos || []).length;
        const completed = progressMap[t.id] || [];
        const completedCount = completed.length;
        const progress = totalPhases > 0 ? Math.round((completedCount / totalPhases) * 100) : 0;
        return { id: t.id, title: t.titulo, totalPhases, completedPhases: completedCount, progress };
      });
      const completedTrails = trails.filter(tr => tr.progress === 100).length;

      // ── Points breakdown ──
      let totalEarned = 0;
      gainHistorySnap.docs.forEach(d => { totalEarned += (d.data().points as number) || 0; });
      let totalSpent = 0;
      spentHistorySnap.docs.forEach(d => { totalSpent += Math.abs((d.data().points as number) || 0); });

      // ── Week day-by-day posts ──
      const weekDays: boolean[] = [false, false, false, false, false, false, false];
      weekPostsSnap.docs.forEach(d => {
        const dateField = d.data().date;
        if (dateField) {
          const postDate = dateField.toDate ? dateField.toDate() : new Date(dateField);
          const dayIdx = (postDate.getDay() + 6) % 7;
          weekDays[dayIdx] = true;
        }
      });

      // ── Streak & Level from user doc ──
      const rawStreak = userData.streak || {};
      const cyclesCompleted = (rawStreak.cyclesCompleted as number) || 0;
      const level = (userData.level?.current as number) || getLevelFromCycles(cyclesCompleted);
      const completedConquests: string[] = userData.conquests?.completed || [];

      // ── Retroactive catch-up runs in background ──
      // Used to block render with `await`, which added a server-action
      // round-trip to the critical path. Now we kick it off and merge any
      // newly-awarded conquests into state once it resolves.
      void (async () => {
        try {
          const token = await getAuthToken();
          const catchUpResult = await catchUpConquests(token, uid);
          if (catchUpResult.awarded.length > 0) {
            setData(prev => prev ? {
              ...prev,
              completedConquests: [...prev.completedConquests, ...catchUpResult.awarded],
            } : prev);
          }
        } catch (err) {
          console.error('Conquest catch-up failed:', err);
        }
      })();

      setData({
        userName: userData.profile?.name || userData.name || 'Colaborador',
        avatarUrl: userData.profile?.photoURL || userData.photoURL,
        points: userData.points || 0,
        level,
        cyclesCompleted,
        streakCurrentWeeks: (rawStreak.currentWeeks as number) || 0,
        streakPostsThisWeek: (rawStreak.postsThisWeek as number) || 0,
        streakLastCompletedWeek: (rawStreak.lastCompletedWeek as string) || '',
        streakCurrentWeekId: (rawStreak.currentWeekId as string) || '',
        weekDaysWithPosts: weekDays,
        completedConquests,
        totalPublications: pubHistorySnap.size,
        totalApprovedMissions: missionSubmissionsSnap.size,
        totalCompletedTrails: completedTrails,
        activeMissions: missions,
        trails,
        totalEarned,
        totalSpent,
        redeemed: rescuesSnap.size,
        availableRewards: rewardsSnap.docs.filter(d => {
          const status = d.data().status;
          return status !== 'disabled' && status !== 'Desativada';
        }).length,
      });

      setIsLoading(false);
    } catch (err) {
      console.error('Dashboard error:', err);
      toast({
        title: t.colabDashboard.loadingError,
        description: t.colabDashboard.loadingErrorDescription,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (authUser?.uid) fetchDashboard(authUser.uid);
  }, [authUser?.uid, fetchDashboard]);

  if (isLoading) {
    return (
      <div>
        <Header title={t.nav.dashboard} subtitle={t.common.loading} />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <Header title={t.nav.dashboard} subtitle={t.colabDashboard.loadingError} />
        <div className="p-6 text-center text-muted-foreground">
          {t.colabDashboard.noData}
        </div>
      </div>
    );
  }

  // ── i18n sub-sections ──
  const gamDash = (t.gamification as Record<string, unknown>)?.dashboard as Record<string, string> | undefined;
  const gamCheckin = (t.gamification as Record<string, unknown>)?.checkin as Record<string, unknown> | undefined;
  const gamLevelUp = (t.gamification as Record<string, unknown>)?.levelUp as Record<string, unknown> | undefined;
  const conquestsI18n = (t.gamification as Record<string, unknown>)?.conquests as Record<string, string> | undefined;

  // Is this week completed?
  const isWeekCompleted = data.streakPostsThisWeek >= 3 && data.streakLastCompletedWeek === data.streakCurrentWeekId;

  // Build conquest progress (pub/trail/mission) — using REAL counts, not badge thresholds
  const realCounts: Record<string, number> = {
    pub: data.totalPublications,
    trail: data.totalCompletedTrails,
    mission: data.totalApprovedMissions,
  };

  const conquestCategories = ['pub', 'trail', 'mission'] as const;
  const conquestProgress: { category: string; current: number; target: number; label: string; goalName: string }[] = [];

  for (const cat of conquestCategories) {
    const nextTarget = getNextConquestTarget(cat, data.completedConquests);
    if (nextTarget !== null) {
      conquestProgress.push({
        category: cat,
        current: realCounts[cat] || 0,
        target: nextTarget,
        label: gamDash?.[`${cat}Category`] || cat,
        goalName: getConquestGoalName(cat, nextTarget),
      });
    }
  }

  // Build conquest badges
  const conquestBadges = data.completedConquests.map((id) => {
    const [cat, numStr] = id.split('_');
    const num = parseInt(numStr, 10);
    // Generate a display label: "1a" for first, number for the rest
    const displayLabel = num === 1 ? '1a' : String(num);
    return { id, category: cat, label: conquestsI18n?.[id] || displayLabel };
  });

  // Trails shown in the dashboard card: prefer ones already started but
  // unfinished. If the user has none in progress, show the next ones they
  // haven't started yet. Finished trails (100%) are never listed here.
  const inProgressTrails = data.trails.filter(tr => tr.progress > 0 && tr.progress < 100);
  const notStartedTrails = data.trails.filter(tr => tr.progress === 0);
  const trailsToShow = inProgressTrails.length > 0 ? inProgressTrails : notStartedTrails;

  // Hero subtitle based on streak
  const heroSubtitle = data.streakCurrentWeeks >= 4
    ? 'Publicando com consistencia!'
    : data.streakCurrentWeeks >= 1
      ? 'Continue publicando!'
      : undefined;

  return (
    <div>
      {/* No duplicate greeting — Header just shows "Dashboard" */}
      <Header title={t.nav.dashboard} />
      <div className="p-6 space-y-4">
        {/* Row 1: Hero (full width) */}
        <HeroCard
          userName={data.userName}
          avatarUrl={data.avatarUrl}
          level={data.level}
          points={data.points}
          redeemed={data.redeemed}
          conquests={data.completedConquests.length}
          subtitle={heroSubtitle}
          t={{
            greeting: t.colabDashboard.greeting,
            levelPill: (gamLevelUp?.levelPill as string) || 'Nivel {level}',
            heroPoints: gamDash?.heroPoints || 'Pontos',
            heroRewards: gamDash?.heroRewards || 'Resgatados',
            heroConquests: gamDash?.heroConquests || 'Conquistas',
          }}
        />

        {/* Banner de upload do mês passado — destaque maior pra fortalecer
            o hábito de export mensal. Clicar leva pra Analytics, onde
            está o botão real de upload. Só aparece se está pendente. */}
        {uploadPending && (
          <UploadPendingBanner
            variant="highlight"
            onUploadClick={() => router.push('/colaborador/analytics')}
          />
        )}

        {/* Row 2: Check-in (full width) */}
        <CheckinCard
          postsThisWeek={data.streakPostsThisWeek}
          currentWeeks={data.streakCurrentWeeks}
          weekDaysWithPosts={data.weekDaysWithPosts}
          cyclesCompleted={data.cyclesCompleted}
          isWeekCompleted={isWeekCompleted}
          t={{
            title: (gamCheckin?.title as string) || 'Check-in Semanal',
            week: (gamCheckin?.week as string) || 'Semana',
            postsCount: (gamCheckin?.postsCount as string) || '{count}/3',
            completed: (gamCheckin?.completed as string) || 'Semana completa!',
            streakBonus: (gamCheckin?.streakBonus as string) || 'Bonus streak: +{points} pts',
            nextBonus: (gamCheckin?.nextBonus as string) || 'Proximo bonus: +{points} pts',
            cycleComplete: (gamCheckin?.cycleComplete as string) || 'Ciclo completo!',
            noPosts: (gamCheckin?.noPosts as string) || 'Nenhuma publicacao',
            cycle: (gamCheckin?.cycle as string) || 'Ciclo',
            weeksStreak: (gamCheckin?.weeksStreak as string) || 'semanas seguidas',
            weekSummary: (gamCheckin?.weekSummary as string) || 'posts esta semana',
            days: (gamCheckin?.days as string[]) || ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'],
          }}
        />

        {/* Row 3: Missions + Trails (with header icons) */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  {t.colabDashboard.activeMissionsTitle}
                </CardTitle>
                <Link href="/colaborador/missoes" className="text-[11px] font-semibold text-primary hover:underline">
                  {t.common.seeAll}
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {data.activeMissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t.colabDashboard.noActiveMissions}
                </p>
              ) : (
                <div className="space-y-1">
                  {data.activeMissions.slice(0, 4).map(m => (
                    <MissionItem key={m.id} title={m.title} points={m.points} pointsLabel={t.common.pts} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  {t.colabDashboard.learningTrails}
                </CardTitle>
                <Link href="/colaborador/trilhas" className="text-[11px] font-semibold text-primary hover:underline">
                  {t.common.seeAll}
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {trailsToShow.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t.colabDashboard.noTrails}
                </p>
              ) : (
                <div className="space-y-3">
                  {trailsToShow.slice(0, 4).map(tr => (
                    <TrailItem key={tr.id} title={tr.title} progress={tr.progress} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 4: Conquests progress + Badges */}
        <div className="grid md:grid-cols-2 gap-4">
          <ConquestsProgressCard
            conquests={conquestProgress}
            t={{ conquestsInProgress: gamDash?.conquestsInProgress || 'Conquistas em Andamento' }}
          />
          <ConquestsBadgesCard
            badges={conquestBadges}
            userLevel={data.level}
            completedConquests={data.completedConquests}
            t={{
              conquestsBadges: gamDash?.conquestsBadges || 'Conquistas',
              badgesCollected: gamDash?.badgesCollected || '{count} conquistados',
              pubCategory: gamDash?.pubCategory || 'Publicacoes',
              trailCategory: gamDash?.trailCategory || 'Trilhas',
              missionCategory: gamDash?.missionCategory || 'Missoes',
              seqCategory: gamDash?.seqCategory || 'Constancia (jornada de niveis)',
            }}
          />
        </div>

        {/* Row 5: Points + Rewards */}
        <div className="grid md:grid-cols-2 gap-4">
          <PointsCard
            available={data.points}
            totalEarned={data.totalEarned}
            totalSpent={data.totalSpent}
            t={{
              myPoints: gamDash?.myPoints || 'Meus Pontos',
              available: gamDash?.available || 'Disponiveis',
              totalEarned: gamDash?.totalEarned || 'Total ganhos',
              totalSpent: gamDash?.totalSpent || 'Total gastos',
              history: gamDash?.history || 'Historico',
            }}
          />
          <RewardsCard
            redeemed={data.redeemed}
            availableInShop={data.availableRewards}
            t={{
              rewardsCard: gamDash?.rewardsCard || 'Recompensas',
              redeemed: gamDash?.redeemed || 'Resgatadas',
              redeemedLabel: gamDash?.redeemedLabel || 'recompensas resgatadas',
              availableLabel: gamDash?.availableLabel || 'recompensas disponiveis',
              availableInShop: gamDash?.availableInShop || 'Disponiveis na loja',
              viewShop: gamDash?.viewShop || 'Ver loja',
              history: gamDash?.history || 'Historico',
            }}
          />
        </div>
      </div>
    </div>
  );
}
