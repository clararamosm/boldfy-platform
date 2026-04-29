'use client';

import { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { getAuthToken } from '@/lib/auth-client';
import { getLinkedInSnapshot, getLinkedInSnapshotBatch, listLinkedInSnapshots } from '@/app/actions/linkedin-analytics';
import type { LinkedInSnapshot } from '@/lib/linkedin-analytics-types';

import { AnalyticsHeader } from './analytics-header';
import { UploadPendingBanner } from './upload-pending-banner';
import { AnalyticsKpiCards } from './kpi-cards';
import { ImpressionsWeeklyChart } from './impressions-weekly-chart';
import { FollowersMonthlyChart } from './followers-monthly-chart';
import { TopPostsSection } from './top-posts-section';
import { DemographicsPanel } from './demographics-panel';
import { XlsxUploadModal } from './xlsx-upload-modal';

const MONTH_NAMES_PT: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

function formatMesAno(mesAno: string): string {
  const [year, month] = mesAno.split('-');
  return `${MONTH_NAMES_PT[month] ?? month} ${year}`;
}

export interface AnalyticsDashboardProps {
  userId: string;
  userName?: string;
  userAvatarUrl?: string;
  role: 'thoughtleader' | 'colaborador' | 'strategist' | 'admin';
  showActionPlan?: boolean;
  readOnlyActionPlan?: boolean;
  showMediaValue?: boolean;
  uploadPending?: boolean;
}

export function AnalyticsDashboard({
  userId,
  userName,
  userAvatarUrl,
  showMediaValue = false,
  uploadPending = false,
}: AnalyticsDashboardProps) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [snapshot, setSnapshot] = useState<LinkedInSnapshot | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<LinkedInSnapshot | null>(null);
  const [allSnapshots, setAllSnapshots] = useState<Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalNewFollowers'>>>({});
  const [allDailyData, setAllDailyData] = useState<LinkedInSnapshot['dailyEngagement']>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Carregar lista de meses disponíveis
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = await getAuthToken();
        const result = await listLinkedInSnapshots(token, userId);
        const months = result.months ?? [];
        setAvailableMonths(months);
        if (months.length > 0) setSelectedMonth(months[0]); // mais recente primeiro
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  // Carregar snapshot selecionado + anterior + batch para gráficos
  useEffect(() => {
    if (!selectedMonth) return;

    async function loadSnapshot() {
      try {
        const token = await getAuthToken();

        // Snapshot selecionado
        const { snapshot: snap } = await getLinkedInSnapshot(token, userId, selectedMonth);
        setSnapshot(snap ?? null);

        // Snapshot do mês anterior
        const [y, m] = selectedMonth.split('-').map(Number);
        let prevY = y, prevM = m - 1;
        if (prevM < 1) { prevM = 12; prevY--; }
        const prevMesAno = `${prevY}-${String(prevM).padStart(2, '0')}`;
        const { snapshot: prev } = await getLinkedInSnapshot(token, userId, prevMesAno);
        setPrevSnapshot(prev ?? null);

        // Batch de todos os meses para os gráficos multi-mês
        if (availableMonths.length > 0) {
          const { snapshots: batch } = await getLinkedInSnapshotBatch(token, userId, availableMonths);
          if (batch) {
            // Para o gráfico de seguidores: apenas totalNewFollowers
            const followersMap: Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalNewFollowers'>> = {};
            for (const [k, s] of Object.entries(batch)) {
              followersMap[k] = { mesAno: s.mesAno, totalNewFollowers: s.totalNewFollowers };
            }
            setAllSnapshots(followersMap);

            // Para o gráfico de impressões: concatenar dailyEngagement de todos os meses
            const allDaily = availableMonths
              .flatMap(m => batch[m]?.dailyEngagement ?? [])
              .sort((a, b) => a.date.localeCompare(b.date));
            setAllDailyData(allDaily);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }

    loadSnapshot();
  }, [selectedMonth, userId, availableMonths]);

  const handleUploadSuccess = useCallback((mesAno: string) => {
    setUploadModalOpen(false);
    // Recarregar lista de meses
    getAuthToken().then(token =>
      listLinkedInSnapshots(token, userId).then(result => {
        const months = result.months ?? [];
        setAvailableMonths(months);
        setSelectedMonth(mesAno);
      })
    );
  }, [userId]);

  // Month selector component
  const MonthSelector = (
    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Selecionar mês" />
      </SelectTrigger>
      <SelectContent>
        {availableMonths.map(m => (
          <SelectItem key={m} value={m}>{formatMesAno(m)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  // Estado de loading inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Estado vazio — sem nenhum mês disponível
  if (availableMonths.length === 0) {
    return (
      <div className="space-y-4">
        {uploadPending && (
          <UploadPendingBanner
            onUploadClick={() => setUploadModalOpen(true)}
            dismissible={false}
          />
        )}
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <p className="text-sm font-medium">Nenhum dado disponível ainda.</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Faça o upload do relatório do LinkedIn Analytics para visualizar seu dashboard.
            Para ter histórico desde o início, exporte os últimos 12 meses.
          </p>
        </div>
        <XlsxUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          userId={userId}
          onSuccess={handleUploadSuccess}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de upload pendente */}
      {uploadPending && (
        <UploadPendingBanner onUploadClick={() => setUploadModalOpen(true)} />
      )}

      {/* Header */}
      {snapshot && (
        <AnalyticsHeader
          userName={userName}
          userAvatarUrl={userAvatarUrl}
          snapshot={snapshot}
          prevSnapshot={prevSnapshot ?? undefined}
          showMediaValue={showMediaValue}
          monthSelector={MonthSelector}
        />
      )}

      {!snapshot && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Sem dados para este mês.</p>
          {MonthSelector}
        </div>
      )}

      {snapshot && (
        <>
          {/* KPI Cards */}
          <AnalyticsKpiCards
            totalImpressions={snapshot.totalImpressions}
            totalReach={snapshot.totalReach}
            totalEngagement={snapshot.totalEngagement}
            totalNewFollowers={snapshot.totalNewFollowers}
            totalPostsPublished={snapshot.totalPostsPublished}
            prevImpressions={prevSnapshot?.totalImpressions}
            prevReach={prevSnapshot?.totalReach}
            prevEngagement={prevSnapshot?.totalEngagement}
            prevNewFollowers={prevSnapshot?.totalNewFollowers}
            prevPostsPublished={prevSnapshot?.totalPostsPublished}
          />

          {/* Gráfico de impressões semanais */}
          <div className="rounded-xl border bg-card p-4">
            <ImpressionsWeeklyChart dailyData={allDailyData} />
          </div>

          {/* Gráfico de seguidores mensais */}
          <div className="rounded-xl border bg-card p-4">
            <FollowersMonthlyChart snapshots={allSnapshots} />
          </div>

          {/* Top posts */}
          <TopPostsSection
            topByEngagement={snapshot.topPostsByEngagement}
            topByImpressions={snapshot.topPostsByImpressions}
          />

          {/* Dados demográficos */}
          <DemographicsPanel demographics={snapshot.demographics} />
        </>
      )}

      {/* Modal de upload */}
      <XlsxUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        userId={userId}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
