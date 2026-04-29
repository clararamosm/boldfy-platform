'use client';

import { Eye, Users, TrendingUp, UserPlus, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KpiDelta } from '@/lib/linkedin-analytics-types';

interface KpiCardProps {
  label: string;
  value: number;
  delta?: KpiDelta;
  icon: React.ReactNode;
  formatValue?: (n: number) => string;
  deltaLabel?: string; // ex: "posts" para delta absoluto
  className?: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

function KpiCard({ label, value, delta, icon, formatValue, deltaLabel, className }: KpiCardProps) {
  const displayValue = formatValue ? formatValue(value) : formatNumber(value);

  return (
    <div className={cn('rounded-xl border bg-card p-4 flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className="text-muted-foreground/60">{icon}</span>
      </div>
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
            ? `${delta.absolute >= 0 ? '+' : ''}${delta.absolute} ${deltaLabel} vs mês anterior`
            : `${delta.percentage >= 0 ? '+' : ''}${delta.percentage.toFixed(1)}% vs mês anterior`
          }
        </div>
      )}
      {(delta === null || delta === undefined) && (
        <div className="text-xs text-muted-foreground/50">Sem dados do mês anterior</div>
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
}: AnalyticsKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <KpiCard
        label="Impressões"
        value={totalImpressions}
        delta={calcDelta(totalImpressions, prevImpressions)}
        icon={<Eye className="h-4 w-4" />}
      />
      <KpiCard
        label="Alcance"
        value={totalReach}
        delta={calcDelta(totalReach, prevReach)}
        icon={<Users className="h-4 w-4" />}
      />
      <KpiCard
        label="Engajamento"
        value={totalEngagement}
        delta={calcDelta(totalEngagement, prevEngagement)}
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <KpiCard
        label="Seg. Ganhos"
        value={totalNewFollowers}
        delta={calcDelta(totalNewFollowers, prevNewFollowers)}
        icon={<UserPlus className="h-4 w-4" />}
      />
    </div>
  );
}
