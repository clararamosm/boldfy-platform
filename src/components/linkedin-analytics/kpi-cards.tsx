'use client';

import { Eye, Users, TrendingUp, UserPlus, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KpiDelta } from '@/lib/linkedin-analytics-types';

interface KpiCardProps {
  label: string;
  value: number;
  delta?: KpiDelta;
  icon: React.ReactNode;
  formatValue?: (n: number) => string;
  deltaLabel?: string; // ex: "posts" para delta absoluto
  /** Label do mês anterior, ex: "março". Quando presente, vira "+15% vs março". */
  prevMonthLabel?: string;
  /** Quando true, esconde valor + delta e mostra badge "Histórico não traz dado" — usado pra Alcance em snapshots historical. */
  unavailable?: boolean;
  className?: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

function KpiCard({ label, value, delta, icon, formatValue, deltaLabel, prevMonthLabel, unavailable, className }: KpiCardProps) {
  const displayValue = formatValue ? formatValue(value) : formatNumber(value);
  const vsLabel = prevMonthLabel ? `vs ${prevMonthLabel}` : 'vs mês anterior';

  return (
    <div className={cn('rounded-xl border bg-card p-4 flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>

      {unavailable ? (
        <>
          <div className="text-2xl font-bold tracking-tight text-muted-foreground/40">—</div>
          <div className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
            <span>Histórico não traz esse dado</span>
          </div>
        </>
      ) : (
        <>
          <div className="text-2xl font-bold tracking-tight">{displayValue}</div>
          {delta !== null && delta !== undefined && (
            <div className={cn(
              'flex items-center gap-1 text-xs font-medium',
              delta.percentage >= 0 ? 'text-green-600' : 'text-red-500'
            )}>
              {delta.percentage >= 0
                ? <ArrowUp className="h-3 w-3" />
                : <ArrowDown className="h-3 w-3" />
              }
              {deltaLabel
                ? `${delta.absolute >= 0 ? '+' : ''}${delta.absolute} ${deltaLabel} ${vsLabel}`
                : `${delta.percentage >= 0 ? '+' : ''}${delta.percentage.toFixed(1)}% ${vsLabel}`
              }
            </div>
          )}
          {(delta === null || delta === undefined) && (
            <div className="text-xs text-muted-foreground/50">Sem dados do mês anterior</div>
          )}
        </>
      )}
    </div>
  );
}

export function calcDelta(current: number, previous: number | undefined): KpiDelta {
  if (previous === undefined || previous === null) return null;
  if (previous === 0) return { absolute: current, percentage: current > 0 ? 100 : 0 };
  const pct = ((current - previous) / previous) * 100;
  return { absolute: current - previous, percentage: pct };
}

interface AnalyticsKpiCardsProps {
  totalImpressions: number;
  totalReach: number;
  totalEngagement: number;
  totalNewFollowers: number;
  // Valores do mês anterior (undefined = sem dados)
  prevImpressions?: number;
  prevReach?: number;
  prevEngagement?: number;
  prevNewFollowers?: number;
  /** Label do mês anterior pra exibir no delta (ex: "março"). */
  prevMonthLabel?: string;
  /** Quando true, esconde Alcance — historical exports não trazem esse dado. */
  isHistoricalSnapshot?: boolean;
}

export function AnalyticsKpiCards({
  totalImpressions,
  totalReach,
  totalEngagement,
  totalNewFollowers,
  prevImpressions,
  prevReach,
  prevEngagement,
  prevNewFollowers,
  prevMonthLabel,
  isHistoricalSnapshot,
}: AnalyticsKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard
        label="Impressões"
        value={totalImpressions}
        delta={calcDelta(totalImpressions, prevImpressions)}
        icon={<Eye className="h-4 w-4" />}
        prevMonthLabel={prevMonthLabel}
      />
      <KpiCard
        label="Alcance"
        value={totalReach}
        delta={calcDelta(totalReach, prevReach)}
        icon={<Users className="h-4 w-4" />}
        prevMonthLabel={prevMonthLabel}
        unavailable={isHistoricalSnapshot}
      />
      <KpiCard
        label="Engajamento"
        value={totalEngagement}
        delta={calcDelta(totalEngagement, prevEngagement)}
        icon={<TrendingUp className="h-4 w-4" />}
        prevMonthLabel={prevMonthLabel}
      />
      <KpiCard
        label="Seg. Ganhos"
        value={totalNewFollowers}
        delta={calcDelta(totalNewFollowers, prevNewFollowers)}
        icon={<UserPlus className="h-4 w-4" />}
        prevMonthLabel={prevMonthLabel}
      />
    </div>
  );
}
