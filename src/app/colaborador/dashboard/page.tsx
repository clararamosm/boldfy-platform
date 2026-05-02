// src/app/colaborador/dashboard/page.tsx
// Gamified dashboard — Bento grid layout with hero, check-in, missions, trails,
// conquests progress/badges, points, and rewards cards.
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import {
  collection, getDocs, getDoc, doc, query, where, orderBy, limit, Timestamp,
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
import { CONQUEST_LADDERS, getLevelFromCycles } from '@/app/actions';

// Dashboard sub-components
import { HeroCard } from '@/components/gamification/dashboard/hero-card';
import { CheckinCard } from '@/components/gamification/dashboard/checkin-card';
import { ConquestsProgressCard } from '@/components/gamification/dashboard/conquests-progress-card';
import { ConquestsBadgesCard } from '@/components/gamification/dashboard/conquests-badges-card';
import { PointsCard } from '@/components/gamification/dashboard/points-card';
import { RewardsCard } from '@/components/gamification/dashboard/rewards-card';

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

// ─── Helper: get next conquest target ─────────────────────────────

function getNextConquest(category: string, completed: string[]): number | null {
  const ladder = CONQUEST_LADDERS[category];
  if (!ladder) return null;
  for (const target of ladder) {
    if (!completed.includes(`${category}_${target}`)) return target;
  }
  return null;
}

// ─── Helper: goal name for conquests ──────────────────────────────

const GOAL_NAMES: Record<string, Record<number, string>> = {
  pub: { 1: '1a publicacao', 10: '10 publicacoes', 30: '30 publicacoes', 50: '50 publicacoes', 100: '100 publicacoes' },
  trail: { 1: '1a trilha', 5: '5 trilhas', 10: '10 trilhas', 20: '20 trilhas', 30: '30 trilhas', 40: '40 trilhas' },
  mission: { 1: '1a missao', 5: '5 missoes', 10: '10 missoes', 20: '20 missoes' },
};

// ─── Main Component ───────────────────────────────────────────────

export default function ColaboradorDashboardPage() {
  const { user: authUser } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const t = useT();

  const fetchDashboard = useCallback(async (uid: string) => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) return;

      const userData = userDocSnap.data();
      const companyId = userData.companyId;
      if (!companyId) return;

      const weekMonday = getWeekMonday();

      // ── Parallel queries ──
      const [
        missionsSnap,
        trailsSnap,
        rewardsSnap,
        progressSnap,
        rescuesSnap,
        gainHistorySnap,
        spentHistorySnap,
        weekPostsSnap,
        pubHistorySnap,
        missionSubmissionsSnap,
      ] = await Promise.all([
        getDocs(query(
          collection(db, 'companies', companyId, 'missions'),
          where('status', '==', 'Ativa'),
          limit(5),
        )),
        getDocs(query(
          collection(db, 'companies', companyId, 'trails'),
          where('active', '==', true),
          orderBy('order', 'asc'),
        )),
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
      ]);

      // ── Parse missions ──
      const missions: Mission[] = missionsSnap.docs.map(d => ({
        id: d.id,
        title: d.data().title || d.data().name || 'Sem titulo',
        points: d.data().points || 0,
      }));

      // ── Parse trails ──
      const progressMap: Record<string, number[]> = {};
      progressSnap.docs.forEach(d => {
        progressMap[d.id] = d.data().completedPhases || [];
      });
      const trails: Trail[] = trailsSnap.docs.map(d => {
        const tData = d.data();
        const totalPhases = (tData.phases || []).length;
        const completed = progressMap[d.id] || [];
        const completedCount = completed.length;
        const progress = totalPhases > 0 ? Math.round((completedCount / totalPhases) * 100) : 0;
        return { id: d.id, title: tData.title || 'Sem titulo', totalPhases, completedPhases: completedCount, progress };
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
        availableRewards: rewardsSnap.docs.filter(d => d.data().status !== 'disabled').length,
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
    const nextTarget = getNextConquest(cat, data.completedConquests);
    if (nextTarget !== null) {
      conquestProgress.push({
        category: cat,
        current: realCounts[cat] || 0,
        target: nextTarget,
        label: gamDash?.[`${cat}Category`] || cat,
        goalName: GOAL_NAMES[cat]?.[nextTarget] || `${nextTarget} ${cat}`,
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
              {data.trails.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t.colabDashboard.noTrails}
                </p>
              ) : (
                <div className="space-y-3">
                  {data.trails.slice(0, 4).map(tr => (
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
