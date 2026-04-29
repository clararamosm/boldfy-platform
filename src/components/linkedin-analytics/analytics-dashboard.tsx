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
import { ImpressionsMonthlyChart } from './impressions-monthly-chart';
import { FollowersMonthlyChart } from './followers-monthly-chart';
import { TopPostsSection } from './top-posts-section';
import { DemographicsPanel } from './demographics-panel';
import { ActionPlanSection } from './action-plan-section';
import { IcpFitScoreCard } from './icp-fit-score-card';
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
  /** Exibir ICP-Fit Score card (só para TL e Colaborador quando há brand context configurado) */
  showIcpScore?: boolean;
}

// Maps para os gráficos de tendência (inclui todos os snapshots — monthly + historical)
type TrendMap = Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalNewFollowers' | 'totalImpressions'>>;

export function AnalyticsDashboard({
  userId,
  userName,
  userAvatarUrl,
  showMediaValue = false,
  uploadPending = false,
  showActionPlan = false,
  readOnlyActionPlan = true,
  showIcpScore = false,
}: AnalyticsDashboardProps) {
  // Meses com upload MONTHLY (aparecem no seletor e geram KPIs / top posts)
  const [monthlyMonths, setMonthlyMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [snapshot, setSnapshot] = useState<LinkedInSnapshot | null>(null);
  const [prevSnapshot, setPrevSnapshot] = useState<LinkedInSnapshot | null>(null);

  // Todos os snapshots (monthly + historical) — usados nos gráficos de tendência
  const [trendSnapshots, setTrendSnapshots] = useState<TrendMap>({});

  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const isLoadingDataRef = useRef(false);

  const loadData = useCallback(async (monthToSelect?: string) => {
    isLoadingDataRef.current = true;
    setLoading(true);
    try {
      const token = await getAuthToken();

      // 1. Listar todos os meses disponíveis
      const { months: rawMonths, error: listError } = await listLinkedInSnapshots(token, userId);
      if (listError) console.error('[AnalyticsDashboard] listLinkedInSnapshots error:', listError);
      const allMonths = rawMonths ?? [];

      // 2. Buscar batch completo para separar monthly de historical
      if (allMonths.length === 0) {
        setMonthlyMonths([]);
        setSelectedMonth('');
        setSnapshot(null);
        setPrevSnapshot(null);
        setTrendSnapshots({});
        return;
      }

      const { snapshots: batch } = await getLinkedInSnapshotBatch(token, userId, allMonths);

      // 3. Separar meses monthly (seletor) dos históricos (só gráficos)
      const monthly = allMonths.filter(m => (batch?.[m]?.uploadType ?? 'monthly') === 'monthly');
      setMonthlyMonths(monthly);

      // 4. Montar mapa de tendência com todos os snapshots
      if (batch) {
        const trendMap: TrendMap = {};
        for (const [k, s] of Object.entries(batch)) {
          trendMap[k] = {
            mesAno: s.mesAno,
            totalNewFollowers: s.totalNewFollowers,
            totalImpressions: s.totalImpressions,
          };
        }
        setTrendSnapshots(trendMap);
      }

      // 5. Determinar mês selecionado (só entre os monthly)
      const active = monthToSelect && monthly.includes(monthToSelect)
        ? monthToSelect
        : monthly[0] ?? '';
      setSelectedMonth(active);

      if (!active) return;

      // 6. Snapshot do mês selecionado
      const { snapshot: snap } = await getLinkedInSnapshot(token, userId, active);
      setSnapshot(snap ?? null);

      // 7. Snapshot do mês anterior (só monthly)
      const [y, m] = active.split('-').map(Number);
      let prevY = y, prevM = m - 1;
      if (prevM < 1) { prevM = 12; prevY--; }
      const prevMesAno = `${prevY}-${String(prevM).padStart(2, '0')}`;
      const { snapshot: prev } = await getLinkedInSnapshot(token, userId, prevMesAno);
      setPrevSnapshot(prev ?? null);

    } catch (e) {
      console.error('[AnalyticsDashboard] loadData error:', e);
    } finally {
      setLoading(false);
      isLoadingDataRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Troca de mês manual — só busca o snapshot, sem recarregar tudo
  useEffect(() => {
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
    loadData(mesAno);
  }, [loadData]);

  const MonthSelector = (
    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
      <SelectTrigger className="w-44">
        <SelectValue placeholder="Selecionar mês" />
      </SelectTrigger>
      <SelectContent>
        {monthlyMonths.map(m => (
          <SelectItem key={m} value={m}>{formatMesAno(m)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sem nenhum dado ainda
  if (Object.keys(trendSnapshots).length === 0) {
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

  // Tem dados históricos mas nenhum upload mensal ainda
  const hasOnlyHistorical = monthlyMonths.length === 0;

  return (
    <div className="space-y-6">
      {uploadPending && (
        <UploadPendingBanner onUploadClick={() => setUploadModalOpen(true)} />
      )}

      {/* Header — só aparece se há snapshot mensal selecionado */}
      {snapshot && !hasOnlyHistorical && (
        <AnalyticsHeader
          userName={userName}
          userAvatarUrl={userAvatarUrl}
          snapshot={snapshot}
          prevSnapshot={prevSnapshot ?? undefined}
          showMediaValue={showMediaValue}
          monthSelector={MonthSelector}
        />
      )}

      {/* Sem snapshot mensal: título + seletor ou aviso de aguardando primeiro mês */}
      {!snapshot && !hasOnlyHistorical && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Sem dados para este mês.</p>
          {MonthSelector}
        </div>
      )}

      {/* Gráficos de tendência — sempre visíveis quando há qualquer dado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <ImpressionsMonthlyChart snapshots={trendSnapshots} />
        </div>
        <div className="rounded-xl border bg-card p-4">
          <FollowersMonthlyChart snapshots={trendSnapshots} />
        </div>
      </div>

      {/* KPIs, top posts, demográficos e plano — só quando há snapshot mensal */}
      {snapshot && !hasOnlyHistorical && (
        <>
          <AnalyticsKpiCards
            totalImpressions={snapshot.totalImpressions}
            totalReach={snapshot.totalReach}
            totalEngagement={snapshot.totalEngagement}
            totalNewFollowers={snapshot.totalNewFollowers}
            prevImpressions={prevSnapshot?.totalImpressions}
            prevReach={prevSnapshot?.totalReach}
            prevEngagement={prevSnapshot?.totalEngagement}
            prevNewFollowers={prevSnapshot?.totalNewFollowers}
          />

          {/* Top posts — só quando o snapshot mensal tem posts reais */}
          {(snapshot.topPostsByEngagement.length > 0 || snapshot.topPostsByImpressions.length > 0) && (
            <TopPostsSection
              topByEngagement={snapshot.topPostsByEngagement}
              topByImpressions={snapshot.topPostsByImpressions}
            />
          )}

          <DemographicsPanel demographics={snapshot.demographics} />

          {showIcpScore && (
            <IcpFitScoreCard userId={userId} mesAno={snapshot.mesAno} />
          )}

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

      {/* Aviso quando só tem histórico — aguardando primeiro upload mensal */}
      {hasOnlyHistorical && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center space-y-2">
          <p className="text-sm font-medium text-foreground/70">
            Histórico importado ✓
          </p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Os gráficos acima já mostram sua evolução. Faça o upload do mês atual para
            ver os KPIs e top posts detalhados.
          </p>
        </div>
      )}

      <XlsxUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        userId={userId}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
