'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, History } from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { UploadHistoryModal } from './upload-history-modal';

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
// Inclui todos os campos de KPI para poder somar no período
type TrendMap = Record<string, Pick<LinkedInSnapshot,
  'mesAno' | 'totalNewFollowers' | 'totalImpressions' | 'totalReach' | 'totalEngagement' | 'uploadType'
>>;

type PeriodPreset = '1M' | '3M' | '6M' | '1A' | 'custom';

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  '1M': '1 mês',
  '3M': '3 meses',
  '6M': '6 meses',
  '1A': '1 ano',
  'custom': 'Personalizado',
};

/** Retorna o mês YYYY-MM resultante de subtrair `months` meses de `from` */
function subtractMonths(from: string, months: number): string {
  const [y, m] = from.split('-').map(Number);
  let newM = m - months;
  let newY = y;
  while (newM < 1) { newM += 12; newY--; }
  return `${newY}-${String(newM).padStart(2, '0')}`;
}

export function AnalyticsDashboard({
  userId,
  userName,
  userAvatarUrl,
  role,
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
  const [historicalModalOpen, setHistoricalModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const isLoadingDataRef = useRef(false);

  // Filtro de período — controla o range dos gráficos de tendência
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('6M');
  const [customFrom, setCustomFrom] = useState('');  // YYYY-MM (inclusive)
  const [customTo, setCustomTo] = useState('');       // YYYY-MM (inclusive)

  // O botão "Histórico" só aparece para o próprio usuário (role ≠ admin)
  const canManageHistory = role !== 'admin';

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
            totalReach: s.totalReach,
            totalEngagement: s.totalEngagement,
            uploadType: s.uploadType,
          };
        }
        setTrendSnapshots(trendMap);
      }

      // 5. Determinar mês selecionado
      // Preferência: monthly mais recente → qualquer snapshot mais recente
      const activeMonthly = monthToSelect && monthly.includes(monthToSelect)
        ? monthToSelect
        : monthly[0] ?? '';
      // Se não tem nenhum monthly, usa o mês mais recente de qualquer tipo (para prevSnapshot)
      const active = activeMonthly || allMonths[0] || '';
      setSelectedMonth(activeMonthly); // seletor de mês só reflete monthly

      if (!active) return;

      // 6. Snapshot do mês ativo (pode ser monthly ou historical, para carregar o prevSnapshot)
      if (activeMonthly) {
        const { snapshot: snap } = await getLinkedInSnapshot(token, userId, activeMonthly);
        setSnapshot(snap ?? null);
      } else {
        setSnapshot(null); // sem monthly → sem KPIs/top posts, mas ainda busca prevSnapshot
      }

      // 7. Snapshot do mês anterior — busca em qualquer tipo (monthly OU historical)
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
    setHistoricalModalOpen(false);
    loadData(mesAno);
  }, [loadData]);

  const handleDeleted = useCallback((deletedMesAno: string) => {
    // Se o mês deletado era o selecionado, recarregar tudo (o loadData seleciona o mais recente)
    // Caso contrário também recarrega para atualizar a lista de meses disponíveis
    const reloadTo = selectedMonth !== deletedMesAno ? selectedMonth : undefined;
    loadData(reloadTo);
  }, [loadData, selectedMonth]);

  // Todos os meses disponíveis (monthly + historical) em ordem crescente
  const allAvailableMonths = useMemo(
    () => Object.keys(trendSnapshots).sort(),
    [trendSnapshots],
  );

  // Mês mais recente com dados — âncora do período
  const latestMonth = useMemo(
    () => allAvailableMonths[allAvailableMonths.length - 1] ?? '',
    [allAvailableMonths],
  );

  // Range do período selecionado
  const periodRange = useMemo((): { from: string; to: string } => {
    if (!latestMonth) return { from: '', to: '' };
    const to = latestMonth;
    if (periodPreset === '1M') return { from: subtractMonths(to, 0), to };
    if (periodPreset === '3M') return { from: subtractMonths(to, 2), to };
    if (periodPreset === '6M') return { from: subtractMonths(to, 5), to };
    if (periodPreset === '1A') return { from: subtractMonths(to, 11), to };
    // custom
    return {
      from: customFrom || allAvailableMonths[0] || to,
      to: customTo || to,
    };
  }, [periodPreset, latestMonth, customFrom, customTo, allAvailableMonths]);

  // Snapshots filtrados pelo período — para os gráficos
  const filteredTrendSnapshots = useMemo((): TrendMap => {
    if (!periodRange.from) return trendSnapshots;
    const result: TrendMap = {};
    for (const [k, v] of Object.entries(trendSnapshots)) {
      if (k >= periodRange.from && k <= periodRange.to) result[k] = v;
    }
    return result;
  }, [trendSnapshots, periodRange]);

  // Meses monthly dentro do período (apenas monthly alimentam KPIs)
  const monthlyInRange = useMemo(() => {
    if (!periodRange.from) return monthlyMonths;
    return monthlyMonths.filter(m => m >= periodRange.from && m <= periodRange.to);
  }, [monthlyMonths, periodRange]);

  // Mês âncora dos KPIs = mês monthly mais recente dentro do período
  // (usado para top posts, demographics, action plan, ICP-Fit)
  const anchorMonth = useMemo(
    () => monthlyInRange[0] ?? selectedMonth, // monthlyMonths está desc
    [monthlyInRange, selectedMonth],
  );

  // KPIs acumulados do período = soma de todos os meses monthly no range
  const periodKpis = useMemo(() => {
    const snapsInRange = monthlyInRange.map(m => trendSnapshots[m]).filter(Boolean);
    return {
      totalImpressions: snapsInRange.reduce((s, v) => s + (v?.totalImpressions ?? 0), 0),
      totalReach:       snapsInRange.reduce((s, v) => s + (v?.totalReach ?? 0), 0),
      totalEngagement:  snapsInRange.reduce((s, v) => s + (v?.totalEngagement ?? 0), 0),
      totalNewFollowers: snapsInRange.reduce((s, v) => s + (v?.totalNewFollowers ?? 0), 0),
    };
  }, [monthlyInRange, trendSnapshots]);

  // Delta vs mês anterior ao anchor — sempre mostra quando há prevSnapshot disponível
  // (o prevSnapshot é o mês calendário imediatamente anterior ao anchorMonth)
  const showPeriodDelta = true;

  // Quando o período muda, atualiza o snapshot exibido para anchor
  useEffect(() => {
    if (!anchorMonth || anchorMonth === selectedMonth) return;
    setSelectedMonth(anchorMonth);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorMonth]);

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
      <div className="space-y-6">
        {/* Mensagem central */}
        <div className="flex flex-col items-center justify-center pt-12 pb-6 gap-2 text-center">
          <p className="text-base font-semibold">Nenhum dado disponível ainda.</p>
          <p className="text-sm text-muted-foreground max-w-sm">
            Para ativar o seu Analytics, faça o export dos seus dados do LinkedIn.
          </p>
        </div>

        {/* Cards de ação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto w-full">
          {/* Card — Histórico 12 meses (opção recomendada) */}
          <button
            onClick={() => setHistoricalModalOpen(true)}
            className="group relative flex flex-col items-start gap-3 rounded-xl border-2 border-blue-200 bg-blue-50/60 p-5 text-left transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="absolute right-3 top-3 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              Recomendado
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-200">
              {/* Ícone calendário */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Importar histórico (12 meses)</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Exporte os últimos 365 dias do LinkedIn Analytics. Os meses são separados automaticamente e os gráficos de evolução ficam disponíveis imediatamente.
              </p>
            </div>
          </button>

          {/* Card — Upload mensal */}
          <button
            onClick={() => setUploadModalOpen(true)}
            className="group flex flex-col items-start gap-3 rounded-xl border-2 border-muted bg-muted/20 p-5 text-left transition-all hover:border-muted-foreground/40 hover:bg-muted/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-muted-foreground/20">
              {/* Ícone upload */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Upload do mês atual</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Já tem histórico importado ou quer começar do mês corrente? Faça o export do período mensal e importe aqui.
              </p>
            </div>
          </button>
        </div>

        {/* Modal histórico */}
        <XlsxUploadModal
          open={historicalModalOpen}
          onOpenChange={setHistoricalModalOpen}
          userId={userId}
          onSuccess={handleUploadSuccess}
          uploadType="historical"
        />

        {/* Modal mensal */}
        <XlsxUploadModal
          open={uploadModalOpen}
          onOpenChange={setUploadModalOpen}
          userId={userId}
          onSuccess={handleUploadSuccess}
        />

        {canManageHistory && (
          <UploadHistoryModal
            open={historyModalOpen}
            onOpenChange={setHistoryModalOpen}
            userId={userId}
            onDeleted={handleDeleted}
          />
        )}
      </div>
    );
  }

  // Tem dados históricos mas nenhum upload mensal ainda
  const hasOnlyHistorical = monthlyMonths.length === 0;

  // Barra de controles: filtro de período + botão histórico (ícone)
  const ControlsBar = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Filtro de período — pills */}
      <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-0.5">
        {(['1M', '3M', '6M', '1A', 'custom'] as PeriodPreset[]).map(preset => (
          <button
            key={preset}
            onClick={() => setPeriodPreset(preset)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              periodPreset === preset
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {PERIOD_LABELS[preset]}
          </button>
        ))}
      </div>

      {/* Selects de range personalizado */}
      {periodPreset === 'custom' && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Select value={customFrom || allAvailableMonths[0] || ''} onValueChange={setCustomFrom}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="De" />
            </SelectTrigger>
            <SelectContent>
              {allAvailableMonths.map(m => (
                <SelectItem key={m} value={m} className="text-xs">{formatMesAno(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>→</span>
          <Select value={customTo || latestMonth || ''} onValueChange={setCustomTo}>
            <SelectTrigger className="h-7 w-32 text-xs">
              <SelectValue placeholder="Até" />
            </SelectTrigger>
            <SelectContent>
              {[...allAvailableMonths].reverse().map(m => (
                <SelectItem key={m} value={m} className="text-xs">{formatMesAno(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Botão ícone — histórico de uploads */}
      {canManageHistory && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Histórico de uploads"
          onClick={() => setHistoryModalOpen(true)}
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {uploadPending && (
        <UploadPendingBanner onUploadClick={() => setUploadModalOpen(true)} />
      )}

      {/* ── SEÇÃO DE PERÍODO ─────────────────────────────────────
          Tudo dentro desta seção é afetado pelo filtro de período.
          Gráficos de tendência + KPIs acumulados.
      ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card/50 space-y-4 p-4">

        {/* Cabeçalho da seção: info de seguidores (se houver snapshot) + filtro + histórico */}
        {snapshot && !hasOnlyHistorical ? (
          <AnalyticsHeader
            userName={userName}
            userAvatarUrl={userAvatarUrl}
            snapshot={snapshot}
            prevSnapshot={prevSnapshot ?? undefined}
            showMediaValue={showMediaValue}
            monthSelector={ControlsBar}
          />
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-2">
            {hasOnlyHistorical ? (
              <p className="text-sm font-medium text-muted-foreground">Evolução histórica</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sem dados para este período.</p>
            )}
            {ControlsBar}
          </div>
        )}

        {/* Gráficos de tendência — sempre visíveis quando há qualquer dado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-background p-4">
            <ImpressionsMonthlyChart snapshots={filteredTrendSnapshots} showMediaValue={showMediaValue} />
          </div>
          <div className="rounded-xl border bg-background p-4">
            <FollowersMonthlyChart snapshots={filteredTrendSnapshots} />
          </div>
        </div>

        {/* KPIs acumulados do período — só quando há snapshots monthly no range */}
        {!hasOnlyHistorical && periodKpis.totalImpressions > 0 && (
          <AnalyticsKpiCards
            totalImpressions={periodKpis.totalImpressions}
            totalReach={periodKpis.totalReach}
            totalEngagement={periodKpis.totalEngagement}
            totalNewFollowers={periodKpis.totalNewFollowers}
            prevImpressions={showPeriodDelta ? prevSnapshot?.totalImpressions : undefined}
            prevReach={showPeriodDelta ? prevSnapshot?.totalReach : undefined}
            prevEngagement={showPeriodDelta ? prevSnapshot?.totalEngagement : undefined}
            prevNewFollowers={showPeriodDelta ? prevSnapshot?.totalNewFollowers : undefined}
          />
        )}
      </div>
      {/* ── FIM SEÇÃO DE PERÍODO ─────────────────────────────── */}

      {/* ── SEÇÃO DO MÊS MAIS RECENTE ────────────────────────────
          Top posts, demographics, ICP-Fit, Action Plan.
          Não são afetados pelo filtro de período — sempre do mês âncora.
      ───────────────────────────────────────────────────────── */}
      {snapshot && !hasOnlyHistorical && (
        <>
          {/* Separador com label */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Análise detalhada — {formatMesAno(snapshot.mesAno)}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

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

      {/* Banner compacto quando só tem histórico — guia para upload mensal */}
      {hasOnlyHistorical && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed bg-muted/20 px-5 py-4">
          <div>
            <p className="text-sm font-medium text-foreground/80">Histórico importado ✓</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Faça o upload do mês atual para ver KPIs e top posts detalhados.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setUploadModalOpen(true)} className="shrink-0">
            Upload mensal
          </Button>
        </div>
      )}

      <XlsxUploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        userId={userId}
        onSuccess={handleUploadSuccess}
      />

      <XlsxUploadModal
        open={historicalModalOpen}
        onOpenChange={setHistoricalModalOpen}
        userId={userId}
        onSuccess={handleUploadSuccess}
        uploadType="historical"
      />

      {canManageHistory && (
        <UploadHistoryModal
          open={historyModalOpen}
          onOpenChange={setHistoryModalOpen}
          userId={userId}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
