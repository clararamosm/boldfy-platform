// src/app/admin/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Trophy, Gift, Target, BookOpen, TrendingUp, Lock,
  ChevronUp, ChevronDown, Minus, Award, BarChart3, Activity,
} from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n/context';
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAuthToken } from '@/lib/auth-client';
import { getAdminDashboardData, type DashboardData } from '@/app/actions/dashboard';
import { useAuth } from '@/contexts/auth-context';

// ─── Period Filter ──────────────────────────────────────────────────
type PeriodKey = 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months';

const PERIOD_KEYS: PeriodKey[] = ['this_week', 'this_month', 'last_month', 'last_3_months', 'last_6_months'];

const PERIOD_DICT_MAP: Record<PeriodKey, keyof typeof import('@/lib/i18n/dictionaries/pt-BR').default.adminDashboard.periods> = {
  this_week: 'thisWeek',
  this_month: 'thisMonth',
  last_month: 'lastMonth',
  last_3_months: 'last3Months',
  last_6_months: 'last6Months',
};

function getPeriodRange(key: PeriodKey) {
  const now = new Date();
  let start: Date, end: Date, prevStart: Date, prevEnd: Date;

  switch (key) {
    case 'this_week': {
      const dayOfWeek = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    }
    case 'this_month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    }
    case 'last_month': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    }
    case 'last_3_months': {
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = new Date(now);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    }
    case 'last_6_months': {
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      end = new Date(now);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      prevEnd = new Date(start);
      prevEnd.setMilliseconds(-1);
      break;
    }
  }
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString(),
  };
}

// ─── Value Formatting ───────────────────────────────────────────────
function formatCurrency(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
}

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString('pt-BR');
}

// ─── Comparison Badge ───────────────────────────────────────────────
function ComparisonBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return (
    <span className="inline-flex items-center text-[11px] text-green-600 dark:text-green-400 font-medium">
      <ChevronUp className="h-3 w-3" /> Novo
    </span>
  );
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return (
    <span className="inline-flex items-center text-[11px] text-muted-foreground font-medium">
      <Minus className="h-3 w-3" /> 0%
    </span>
  );
  const isPositive = pct > 0;
  return (
    <span className={`inline-flex items-center text-[11px] font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {isPositive ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{pct}%
    </span>
  );
}

// ─── Health Bar ─────────────────────────────────────────────────────
function HealthBar({ label, value, thresholdGreen, thresholdOrange }: {
  label: string;
  value: number;
  thresholdGreen: number;
  thresholdOrange: number;
}) {
  const color = value >= thresholdGreen
    ? 'bg-green-500'
    : value >= thresholdOrange
      ? 'bg-orange-500'
      : 'bg-red-500';
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}%</span>
      </div>
      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

// ─── Coming Soon Overlay ────────────────────────────────────────────
function ComingSoonOverlay({ children, message }: { children: React.ReactNode; message?: string }) {
  return (
    <div className="relative">
      <div className="opacity-40 pointer-events-none select-none blur-[1px]">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-lg">
        <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-full border shadow-sm">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{message || 'Coming soon'}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2"><Skeleton className="h-4 w-24" /></CardHeader>
            <CardContent><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-32 mt-2" /></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
        <Card><CardContent className="pt-6"><Skeleton className="h-48 w-full" /></CardContent></Card>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();

  const fetchData = useCallback(async (companyId: string) => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const result = await getAdminDashboardData(token, companyId, getPeriodRange(period));

      if (result.error) {
        toast({ variant: 'destructive', title: t.adminDashboard.loadingError, description: result.error });
      } else if (result.data) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast({ variant: 'destructive', title: t.adminDashboard.loadingError });
    } finally {
      setIsLoading(false);
    }
  }, [period, toast]);

  // Get companyId from auth context or Firestore
  useEffect(() => {
    if (!user) return;

    const getCompanyAndFetch = async () => {
      let cId = user.companyId;

      // For master viewing admin panel, companyId comes from URL
      if (!cId && user.role === 'master') {
        const params = new URLSearchParams(window.location.search);
        cId = params.get('companyId') || undefined;
      }

      if (cId) {
        fetchData(cId);
      }
    };

    getCompanyAndFetch();
  }, [user, fetchData]);

  if (isLoading || !data) {
    return (
      <>
        <Header title={t.adminDashboard.title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <DashboardSkeleton />
        </main>
      </>
    );
  }

  const adhesionRate = data.totalLicenses > 0
    ? Math.round((data.activeCollaborators / data.totalLicenses) * 100)
    : 0;
  const engagementRate = data.activeCollaborators > 0
    ? Math.round((data.collaboratorsWithActivity / data.activeCollaborators) * 100)
    : 0;
  const missionCompletionRate = data.totalMissionsAvailable > 0
    ? Math.round((data.missionsApproved / (data.activeCollaborators * data.totalMissionsAvailable)) * 100)
    : 0;
  const trailProgressRate = data.activeCollaborators > 0
    ? Math.round(((data.trailsStarted + data.trailsCompleted) / data.activeCollaborators) * 100)
    : 0;
  const redemptionRate = data.totalPointsDistributed > 0
    ? Math.round((data.totalPointsRedeemed / data.totalPointsDistributed) * 100)
    : 0;

  return (
    <>
      <Header title={t.adminDashboard.title} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Period filter */}
        <div className="flex items-center justify-end">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_KEYS.map(key => (
                <SelectItem key={key} value={key}>{t.adminDashboard.periods[PERIOD_DICT_MAP[key]]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ─── BLOCO 1: KPIs de topo ─────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Valor equivalente (COMING SOON) */}
          <ComingSoonOverlay message={t.adminDashboard.comingSoonOverlay}>
            <Card className="border-purple-200 dark:border-purple-900/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.adminDashboard.equivalentValue}</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(data.estimatedValue)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.adminDashboard.estimateCollaborators.replace('{count}', String(data.activeCollaborators))}
                </p>
              </CardContent>
            </Card>
          </ComingSoonOverlay>

          {/* Card 2: Impressões (COMING SOON) */}
          <ComingSoonOverlay message={t.adminDashboard.comingSoonOverlay}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.adminDashboard.impressionsGenerated}</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(data.estimatedImpressions)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.adminDashboard.impressionsCost}
                </p>
              </CardContent>
            </Card>
          </ComingSoonOverlay>

          {/* Card 3: Colaboradores ativos (WORKS) */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.adminDashboard.activeCollaborators}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.activeCollaborators} <span className="text-base font-normal text-muted-foreground">/ {data.totalLicenses}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className={adhesionRate >= 70 ? 'text-green-600' : adhesionRate >= 40 ? 'text-orange-500' : 'text-red-500'}>
                  {t.adminDashboard.adhesionRate.replace('{rate}', String(adhesionRate))}
                </span>
              </p>
            </CardContent>
          </Card>

          {/* Card 4: ROI (COMING SOON) */}
          <ComingSoonOverlay message={t.adminDashboard.comingSoonOverlay}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t.adminDashboard.programROI}</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.4x</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t.adminDashboard.roiSubtitle}
                </p>
              </CardContent>
            </Card>
          </ComingSoonOverlay>
        </div>

        {/* ─── BLOCO 2: Gráfico + Donut ──────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
          {/* Evolução mensal (COMING SOON) */}
          <ComingSoonOverlay message={t.adminDashboard.availableWithLinkedinTrack}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  {t.adminDashboard.impressionsAndValue}
                </CardTitle>
                <CardDescription>{t.adminDashboard.monthlyEvolution}</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Placeholder chart */}
                <div className="flex items-end gap-2 h-40 px-2">
                  {[25, 35, 42, 50, 58, 65].map((h, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-purple-300 dark:bg-purple-800 rounded-t" style={{ height: `${h}%` }} />
                      <span className="text-[10px] text-muted-foreground">
                        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'][i]}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </ComingSoonOverlay>

          {/* Engajamento donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                {t.adminDashboard.engagement}
              </CardTitle>
              <CardDescription>{t.adminDashboard.activityDistribution}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-2">
                {/* Simple donut using CSS */}
                <div className="relative h-40 w-40">
                  <svg viewBox="0 0 36 36" className="h-40 w-40 -rotate-90">
                    {/* Inactive */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#E8D8F5" strokeWidth="3"
                      strokeDasharray={`${100} ${0}`} strokeDashoffset="0" className="dark:stroke-purple-900/40" />
                    {/* Pending */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#CD50F1" strokeWidth="3"
                      strokeDasharray={`${data.activeCollaborators > 0 ? ((data.activeCollaborators - data.collaboratorsWithActivity) / data.activeCollaborators * 100) : 0} ${100}`}
                      strokeDashoffset={`-${data.activeCollaborators > 0 ? (data.collaboratorsWithActivity / data.activeCollaborators * 100) : 0}`} />
                    {/* Active */}
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#9840AD" strokeWidth="3"
                      strokeDasharray={`${data.activeCollaborators > 0 ? (data.collaboratorsWithActivity / data.activeCollaborators * 100) : 0} ${100}`}
                      strokeDashoffset="0" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold">{data.activeCollaborators}</span>
                    <span className="text-[10px] text-muted-foreground">{t.adminDashboard.collaborators}</span>
                  </div>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#9840AD]" />
                  {t.adminDashboard.engaged.replace('{count}', String(data.collaboratorsWithActivity))}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#CD50F1]" />
                  {t.adminDashboard.noActivity.replace('{count}', String(data.activeCollaborators - data.collaboratorsWithActivity))}
                </span>
                {data.totalLicenses > data.activeCollaborators && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#E8D8F5] dark:bg-purple-900/40" />
                    {t.adminDashboard.inactive.replace('{count}', String(data.totalLicenses - data.activeCollaborators))}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── BLOCO 3: Métricas operacionais ────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Missões concluídas */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t.adminDashboard.missionsCompleted}</span>
                <Target className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{data.missionsApproved}</span>
                <span className="text-sm text-muted-foreground">/ {data.totalMissionsAvailable * data.activeCollaborators || '—'}</span>
              </div>
              <ComparisonBadge current={data.missionsApproved} previous={data.prevMissionsApproved} />
              {data.missionsPending > 0 && (
                <p className="text-xs text-orange-500">{t.adminDashboard.pendingReview.replace('{count}', String(data.missionsPending))}</p>
              )}
            </CardContent>
          </Card>

          {/* Trilhas concluídas */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t.adminDashboard.trailsCompleted}</span>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{data.trailsCompleted}</span>
                <span className="text-sm text-muted-foreground">/ {data.trailsStarted + data.trailsCompleted} {t.adminDashboard.started}</span>
              </div>
              {(data.trailsStarted + data.trailsCompleted) > 0 && (
                <Progress
                  value={(data.trailsCompleted / (data.trailsStarted + data.trailsCompleted)) * 100}
                  className="h-2"
                />
              )}
            </CardContent>
          </Card>

          {/* Pontos distribuídos */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t.adminDashboard.pointsDistributed}</span>
                <CoinIcon className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-3xl font-bold">{data.totalPointsDistributed.toLocaleString()}</div>
              <ComparisonBadge current={data.totalPointsDistributed} previous={data.prevPointsDistributed} />
              {data.rewardsRedeemed > 0 && (
                <p className="text-xs text-muted-foreground">{t.adminDashboard.rewardsRedeemed.replace('{count}', String(data.rewardsRedeemed))}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── BLOCO 4: Leaderboard + Saúde ──────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top 5 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="h-5 w-5 text-muted-foreground" />
                {t.adminDashboard.top5}
              </CardTitle>
              <CardDescription>{t.adminDashboard.rankingByPoints}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topCollaborators.length === 0 ? (
                <p className="text-center text-muted-foreground py-6 text-sm">
                  {t.adminDashboard.noPointsYet}
                </p>
              ) : (
                <div className="space-y-3">
                  {data.topCollaborators.map((collab, index) => (
                    <div key={collab.id} className="flex items-center gap-3">
                      <div className={`
                        flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold
                        ${index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                          index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-muted text-muted-foreground'}
                      `}>
                        {index + 1}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {collab.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{collab.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {t.adminDashboard.missionsStat.replace('{count}', String(collab.missionsCompleted)).replace('{points}', collab.points.toLocaleString())}
                        </p>
                      </div>
                      <Badge variant="secondary" className="bg-primary/10 text-primary shrink-0 text-xs">
                        <CoinIcon className="h-3 w-3 mr-0.5" /> {collab.points.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Saúde do programa */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                {t.adminDashboard.programHealth}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <HealthBar label={t.adminDashboard.healthAdhesion} value={adhesionRate} thresholdGreen={70} thresholdOrange={40} />
              <HealthBar label={t.adminDashboard.healthMissionsWeek} value={missionCompletionRate} thresholdGreen={60} thresholdOrange={30} />
              <HealthBar label={t.adminDashboard.healthTrailsProgress} value={trailProgressRate} thresholdGreen={50} thresholdOrange={25} />
              <HealthBar label={t.adminDashboard.healthRewardsRedeemed} value={redemptionRate} thresholdGreen={30} thresholdOrange={15} />

              {/* Custo por impressão (COMING SOON) */}
              <ComingSoonOverlay message={t.common.comingSoon}>
                <div className="mt-2 rounded-lg bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">{t.adminDashboard.costPerImpression}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-primary">R$ 0,13</span>
                    <span className="text-xs text-muted-foreground">
                      {t.adminDashboard.costComparison}
                    </span>
                  </div>
                </div>
              </ComingSoonOverlay>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
