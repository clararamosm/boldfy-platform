'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { ActionPlanSection } from './action-plan-section';
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
  showActionPlan = false,
  readOnlyActionPlan = true,
}: AnalyticsDashboardProps) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [snapshot, setSnapshot] = useState<LinkedInSnapshot | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<LinkedInSnapshot | null>(null);
  const [allSnapshots, setAllSnapshots] = useState<Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalNewFollowers'>>>({});
  const [allDailyData, setAllDailyData] = useState<LinkedInSnapshot['dailyEngagement']>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  // flag para evitar que o useEffect de troca de mês dispare durante loadData
  const isLoadingDataRef = useRef(false);

  // Função central de carregamento — usada no mount e após upload
  const loadData = useCallback(async (monthToSelect?: string) => {
    isLoadingDataRef.current = true;
    setLoading(true);
    try {
      const token = await getAuthToken();

      // 1. Listar meses disponíveis
      const { months: rawMonths, error: listError } = await listLinkedInSnapshots(token, userId);
      if (listError) console.error('[AnalyticsDashboard] listLinkedInSnapshots error:', listError);
      const months = rawMonths ?? [];
      setAvailableMonths(months);

      // 2. Determinar mês a exibir
      const active = monthToSelect && months.includes(monthToSelect)
        ? monthToSelect
        : months[0] ?? '';
      setSelectedMonth(active);

      if (!active || months.length === 0) return;

      // 3. Snapshot selecionado
      const { snapshot: snap } = await getLinkedInSnapshot(token, userId, active);
      setSnapshot(snap ?? null);

      // 4. Snapshot do mês anterior
      const [y, m] = active.split('-').map(Number);
      let prevY = y, prevM = m - 1;
      if (prevM < 1) { prevM = 12; prevY--; }
      const prevMesAno = `${prevY}-${String(prevM).padStart(2, '0')}`;
      const { snapshot: prev } = await getLinkedInSnapshot(token, userId, prevMesAno);
      setPrevSnapshot(prev ?? null);

      // 5. Batch de todos os meses para os gráficos multi-mês
      const { snapshots: batch } = await getLinkedInSnapshotBatch(token, userId, months);
      if (batch) {
        const followersMap: Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalNewFollowers'>> = {};
        for (const [k, s] of Object.entries(batch)) {
          followersMap[k] = { mesAno: s.mesAno, totalNewFollowers: s.totalNewFollowers };
        }
        setAllSnapshots(followersMap);

        const allDaily = months
          .flatMap(mo => batch[mo]?.dailyEngagement ?? [])
          .sort((a, b) => a.date.localeCompare(b.date));
        setAllDailyData(allDaily);
      }
    } catch (e) {
      console.error('[AnalyticsDashboard] loadData error:', e);
    } finally {
      setLoading(false);
      isLoadingDataRef.current = false;
    }
  }, [userId]);

  // Carregar na montagem
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quando o usuário muda o mês manualmente (sem recarregar tudo)
  useEffect(() => {
    // Ignorar disparos causados pelo loadData (que já busca o snapshot)
    if (!selectedMonth || isLoadingDataRef.current) return;

    async function loadSelectedSnapshot() {
      try {
        const token = await getAuthToken();

        const { snapshot: snap } = await getLinkedInSnapshot(token, userId, selectedMonth);
        setSnapshot(snap ?? null);

        const [y, m] = selectedMonth.split('-').map(Number);
        let prevY = y, prevM = m - 1;
        if (prevM < 1) { prevM = 12; prevY--; }
        const prevMesAno = `${prevY}-${String(prevM).padStart(2, '0')}`;
        const { snapshot: prev } = await getLinkedInSnapshot(token, userId, prevMesAno);
        setPrevSnapshot(prev ?? null);
      } catch (e) {
        console.error('[AnalyticsDashboard] loadSelectedSnapshot error:', e);
      }
    }

    loadSelectedSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const handleUploadSuccess = useCallback((mesAno: string) => {
    setUploadModalOpen(false);
    // Recarregar tudo a partir do zero, forçando o mês recém-carregado
    loadData(mesAno);
  }, [loadData]);

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

          {/* Plano de ação */}
          {showActionPlan && (
            <ActionPlanSection
              tlUserId={userId}
              mesAno={snapshot.mesAno}
              actionPlan={snapshot.actionPlan}
              canEdit={!readOnlyActionPlan}
            />
          )}
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
