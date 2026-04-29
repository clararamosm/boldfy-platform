'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { LinkedInSnapshot } from '@/lib/linkedin-analytics-types';
import { LINKEDIN_CPM_BRL } from '@/lib/constants';
import { MONTH_NAMES_PT, formatCompactNumber, formatCurrency } from '@/lib/linkedin-analytics-utils';
import { buildMonthBars, ChartXAxisTick, type MonthBarBase } from './chart-shared';

interface ImpressionsMonthlyChartProps {
  snapshots: Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalImpressions'>>;
  /** Exibir valor de mídia equivalente no tooltip — apenas admin */
  showMediaValue?: boolean;
}

interface MonthBar extends MonthBarBase {
  impressions: number;
}

// ─── Tooltip customizado ──────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  bars: MonthBar[];
  showMediaValue: boolean;
}

function CustomTooltip({ active, payload, label, bars, showMediaValue }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  const bar = bars.find(b => b.mesAno === label);
  if (!bar?.hasData) return null;

  const impressions = payload[0].value;
  const [year, month] = label.split('-');
  const mediaValue = (impressions / 1000) * LINKEDIN_CPM_BRL;

  return (
    <div className="bg-popover border border-border rounded-xl shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-semibold text-foreground mb-2 text-[13px]">
        {MONTH_NAMES_PT[month] ?? month} {year}
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Impressões</span>
        <span className="font-bold text-blue-600 tabular-nums">
          {impressions.toLocaleString('pt-BR')}
        </span>
      </div>
      {showMediaValue && (
        <div className="flex items-center justify-between gap-4 mt-1.5 pt-1.5 border-t border-border">
          <span className="text-muted-foreground">💰 Valor de mídia</span>
          <span className="font-bold text-purple-600 tabular-nums">
            {formatCurrency(mediaValue)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────

export function ImpressionsMonthlyChart({ snapshots, showMediaValue = false }: ImpressionsMonthlyChartProps) {
  const bars = useMemo<MonthBar[]>(() => {
    const sortedKeys = Object.keys(snapshots).sort();
    return buildMonthBars(sortedKeys).map(base => ({
      ...base,
      impressions: snapshots[base.mesAno]?.totalImpressions ?? 0,
    }));
  }, [snapshots]);

  if (!bars.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem dados de impressões disponíveis.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">Impressões por Mês</h3>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: Math.max(400, bars.length * 40) }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bars} margin={{ top: 24, right: 8, left: 0, bottom: 8 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="mesAno"
                tick={<ChartXAxisTick bars={bars} />}
                axisLine={false}
                tickLine={false}
                height={32}
              />
              <YAxis
                tickFormatter={formatCompactNumber}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                width={40}
              />
              <Tooltip
                content={<CustomTooltip bars={bars} showMediaValue={showMediaValue} />}
                cursor={{ fill: 'hsl(var(--muted)/0.5)', radius: 4 }}
              />
              <Bar dataKey="impressions" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
