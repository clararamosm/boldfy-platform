// src/app/admin/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Trophy, Target, BookOpen, TrendingUp, Lock,
  ChevronUp, ChevronDown, Minus, Award, BarChart3, Activity,
  Linkedin, FileText, CheckCircle2, UserCheck, Gift,
} from "lucide-react";
import { CoinIcon } from "@/components/coin-icon";
import { Button } from '@/components/ui/button';
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
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import { getAdminDashboardData, type DashboardData, type TopCollaboratorByIcp } from '@/app/actions/dashboard';
import { useAuth } from '@/contexts/auth-context';
import { useResolvedCompanyId } from '@/hooks/use-resolved-company-id';
import { LinkedInPerformance } from '@/components/linkedin-performance/linkedin-performance';
import { getCompanyLinkedInProfiles, type CompanyLinkedInProfile } from '@/app/actions/linkedin';

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

// ─── Funnel Chart ────────────────────────────────────────────────
function FunnelStep({
  icon: Icon,
  label,
  count,
  total,
  color,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="font-bold text-foreground tabular-nums">
          {count} <span className="font-normal text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function FunnelChart({
  invited, activated, linkedIn, posted, watchedTrail,
}: {
  invited: number;
  activated: number;
  linkedIn: number;
  posted: number;
  watchedTrail: number;
}) {
  const steps = [
    { icon: Users,        label: 'Convidados',              count: invited,      color: '#6366f1' },
    { icon: UserCheck,    label: 'Ativaram a conta',        count: activated,    color: '#8b5cf6' },
    { icon: Linkedin,     label: 'Conectaram o LinkedIn',   count: linkedIn,     color: '#0ea5e9' },
    { icon: FileText,     label: 'Publicaram conteúdo',     count: posted,       color: '#10b981' },
    { icon: CheckCircle2, label: 'Assistiram uma trilha',   count: watchedTrail, color: '#f59e0b' },
  ];
  return (
    <div className="space-y-3 pt-1">
      {steps.map(step => (
        <FunnelStep key={step.label} {...step} total={invited} />
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [linkedInProfiles, setLinkedInProfiles] = useState<CompanyLinkedInProfile[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();
  const t = useT();

  const fetchData = useCallback(async (companyId: string) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const token = await getAuthToken();
      const [result, profilesResult] = await Promise.all([
        getAdminDashboardData(token, companyId, getPeriodRange(period)),
        getCompanyLinkedInProfiles(token, companyId),
      ]);

      if (result.error) {
        setFetchError(result.error);
        toast({ variant: 'destructive', title: t.adminDashboard.loadingError, description: result.error });
      } else if (result.data) {
        setData(result.data);
      }

      if (profilesResult.profiles) {
        setLinkedInProfiles(profilesResult.profiles.filter((p) => p.hasLinkedin));
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setFetchError('Erro ao carregar dados do dashboard.');
      toast({ variant: 'destructive', title: t.adminDashboard.loadingError });
    } finally {
      setIsLoading(false);
    }
  }, [period, toast]);

  const resolvedCompanyId = useResolvedCompanyId();

  // Fetch data when companyId is resolved
  useEffect(() => {
    if (!user || !resolvedCompanyId) return;

    const getCompanyAndFetch = async () => {
      fetchData(resolvedCompanyId);
    };

    getCompanyAndFetch();
  }, [user, fetchData]);

  if (isLoading) {
    return (
      <>
        <Header title={t.adminDashboard.title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <DashboardSkeleton />
        </main>
      </>
    );
  }

  if (fetchError || !data) {
    return (
      <>
        <Header title={t.adminDashboard.title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card className="max-w-md mx-auto mt-12">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="font-semibold">Erro ao carregar dashboard</p>
                <p className="text-sm text-muted-foreground mt-1">{fetchError || 'Não foi possível carregar os dados.'}</p>
              </div>
              <Button variant="outline" onClick={() => resolvedCompanyId && fetchData(resolvedCompanyId)} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
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
          {/* Card 1: Earned Media — real se tiver snapshots, estimado se não */}
          <Card className="border-purple-200 dark:border-purple-900/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Earned Media</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCurrency(data.realEarnedMedia > 0 ? data.realEarnedMedia : data.estimatedValue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.realEarnedMedia > 0
                  ? 'Baseado nos extracts do mês atual'
                  : `Estimativa: ${data.activeCollaborators} colaboradores`
                }
              </p>
            </CardContent>
          </Card>

          {/* Card 2: Impressões — real se tiver snapshots, estimado se não */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Impressões Geradas</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(data.realImpressions > 0 ? data.realImpressions : data.estimatedImpressions)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.realImpressions > 0
                  ? 'Soma de todos os perfis — mês atual'
                  : 'Estimativa (R$300 CPM)'
                }
              </p>
            </CardContent>
          </Card>

          {/* Card 3: Colaboradores ativos */}
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

        {/* ─── BLOCO 2: Gráfico + Funil ──────────────────────────────── */}
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

          {/* Funil de engajamento no programa */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Engajamento no Programa
              </CardTitle>
              <CardDescription>Jornada de ativação dos colaboradores</CardDescription>
            </CardHeader>
            <CardContent>
              <FunnelChart
                invited={data.funnelInvited}
                activated={data.funnelActivated}
                linkedIn={data.funnelLinkedIn}
                posted={data.funnelPosted}
                watchedTrail={data.funnelWatchedTrail}
              />
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
                <CoinIcon size="sm" />
              </div>
              <div className="text-3xl font-bold">{data.totalPointsDistributed.toLocaleString()}</div>
              <ComparisonBadge current={data.totalPointsDistributed} previous={data.prevPointsDistributed} />
              {data.rewardsRedeemed > 0 && (
                <p className="text-xs text-muted-foreground">{t.adminDashboard.rewardsRedeemed.replace('{count}', String(data.rewardsRedeemed))}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── BLOCO 4: LinkedIn Performance ──────────────────────────── */}
        {linkedInProfiles.length > 0 && (
          <LinkedInPerformance
            userId={linkedInProfiles[0].id}
            showProfileFilter
            profiles={linkedInProfiles.map((p) => ({ id: p.id, name: p.name }))}
            callerRole="admin"
          />
        )}

        {/* ─── BLOCO 5: Rankings ──────────────────────────────────────── */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Colaboradores por pontos */}
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
                        flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0
                        ${index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                          index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-muted text-muted-foreground'}
                      `}>
                        {index + 1}
                      </div>
                      <Avatar className="h-8 w-8 shrink-0">
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
                        <CoinIcon size="xs" className="mr-0.5" /> {collab.points.toLocaleString()}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top por ICP-Fit */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-muted-foreground" />
                Top por ICP-Fit
              </CardTitle>
              <CardDescription>Maior fit de audiência com o ICP — mês mais recente</CardDescription>
            </CardHeader>
            <CardContent>
              {data.topCollaboratorsByIcp.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Nenhum score calculado ainda.
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    O score ICP-Fit é calculado automaticamente ao abrir o Analytics de cada perfil.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.topCollaboratorsByIcp.map((collab, index) => {
                    const scoreColor = collab.icpScore >= 70 ? 'text-emerald-600' : collab.icpScore >= 45 ? 'text-amber-500' : 'text-red-500';
                    const scoreBg = collab.icpScore >= 70 ? 'bg-emerald-50 border-emerald-200' : collab.icpScore >= 45 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                    return (
                      <div key={collab.id} className="flex items-center gap-3">
                        <div className={`
                          flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0
                          ${index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                            index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                            'bg-muted text-muted-foreground'}
                        `}>
                          {index + 1}
                        </div>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {collab.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{collab.name}</p>
                          <p className="text-[11px] text-muted-foreground">{collab.mesAno}</p>
                        </div>
                        <div className={`shrink-0 border rounded-full px-2.5 py-0.5 text-xs font-bold ${scoreBg} ${scoreColor}`}>
                          {collab.icpScore}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── BLOCO 6: Saúde do programa ─────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              {t.adminDashboard.programHealth}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <HealthBar label={t.adminDashboard.healthAdhesion} value={adhesionRate} thresholdGreen={70} thresholdOrange={40} />
              <HealthBar label={t.adminDashboard.healthMissionsWeek} value={missionCompletionRate} thresholdGreen={60} thresholdOrange={30} />
              <HealthBar label={t.adminDashboard.healthTrailsProgress} value={trailProgressRate} thresholdGreen={50} thresholdOrange={25} />
              <HealthBar label={t.adminDashboard.healthRewardsRedeemed} value={redemptionRate} thresholdGreen={30} thresholdOrange={15} />
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
