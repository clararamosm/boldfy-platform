'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';
import type { LinkedInSnapshot } from '@/lib/linkedin-analytics-types';
import { LINKEDIN_CPM_BRL } from '@/lib/constants';
import { MONTH_NAMES_PT, formatCompactNumber, formatCurrency } from '@/lib/linkedin-analytics-utils';
import { buildMonthBars, ChartXAxisTick, type MonthBarBase } from './chart-shared';

interface ImpressionsMonthlyChartProps {
  snapshots: Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalImpressions' | 'totalEngagement' | 'totalPostsPublished'>>;
  /** Exibir valor de mídia equivalente no tooltip — apenas admin */
  showMediaValue?: boolean;
}

interface MonthBar extends MonthBarBase {
  impressions: number;
  engagement: number;
  postsPublished: number;
}

type TrendRange = '6M' | '12M';
const TREND_RANGE_KEY = 'analytics.trendRange';

// ─── Tooltip customizado ──────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  label?: string;
  bars: MonthBar[];
  showMediaValue: boolean;
}

function CustomTooltip({ active, label, bars, showMediaValue }: CustomTooltipProps) {
  if (!active || !label) return null;

  const bar = bars.find(b => b.mesAno === label);
  if (!bar?.hasData) return null;

  const { impressions, engagement, postsPublished } = bar;
  const [year, month] = label.split('-');
  const mediaValue = (impressions / 1000) * LINKEDIN_CPM_BRL;
  const impPerPost = postsPublished > 0
    ? Math.round(impressions / postsPublished).toLocaleString('pt-BR')
    : null;

  return (
    <div className="bg-popover border border-border rounded-xl shadow-lg p-3 text-xs min-w-[200px]">
      <p className="font-semibold text-foreground mb-2 text-[13px]">
        {MONTH_NAMES_PT[month] ?? month} {year}
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">👁️ Impressões</span>
        <span className="font-bold text-blue-600 tabular-nums">
          {impressions.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 mt-1">
        <span className="text-muted-foreground">💬 Engajamento</span>
        <span className="font-bold text-emerald-600 tabular-nums">
          {engagement.toLocaleString('pt-BR')}
        </span>
      </div>
      {postsPublished > 0 && (
        <div className="flex items-center justify-between gap-4 mt-1">
          <span className="text-muted-foreground">📝 Posts publicados</span>
          <span className="font-semibold text-foreground tabular-nums">
            {postsPublished}
          </span>
        </div>
      )}
      {impPerPost && (
        <div className="flex items-center justify-between gap-4 mt-1">
          <span className="text-muted-foreground">Média por post</span>
          <span className="font-semibold text-foreground tabular-nums">
            {impPerPost}
          </span>
        </div>
      )}
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
  // Toggle 6m/12m com preferência persistida em localStorage.
  const [trendRange, setTrendRange] = useState<TrendRange>('6M');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(TREND_RANGE_KEY);
    if (stored === '6M' || stored === '12M') setTrendRange(stored);
  }, []);
  const handleRangeChange = (range: TrendRange) => {
    setTrendRange(range);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TREND_RANGE_KEY, range);
    }
  };

  const bars = useMemo<MonthBar[]>(() => {
    const sortedKeys = Object.keys(snapshots).sort();
    const limit = trendRange === '6M' ? 6 : 12;
    const recentKeys = sortedKeys.slice(-limit);
    return buildMonthBars(recentKeys).map(base => ({
      ...base,
      impressions: snapshots[base.mesAno]?.totalImpressions ?? 0,
      engagement: snapshots[base.mesAno]?.totalEngagement ?? 0,
      postsPublished: snapshots[base.mesAno]?.totalPostsPublished ?? 0,
    }));
  }, [snapshots, trendRange]);

  if (!bars.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem dados de impressões disponíveis.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Impressões e engajamento por mês</h3>
        <div className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5">
          {(['6M', '12M'] as TrendRange[]).map(range => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-semibold transition-colors',
                trendRange === range
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {range === '6M' ? '6m' : '12m'}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: Math.max(400, bars.length * 40) }}>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={bars} margin={{ top: 24, right: 16, left: 0, bottom: 8 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="mesAno"
                tick={<ChartXAxisTick bars={bars} />}
                axisLine={false}
                tickLine={false}
                height={32}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={formatCompactNumber}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                width={40}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={formatCompactNumber}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#10b981' }}
                width={36}
              />
              <Tooltip
                content={<CustomTooltip bars={bars} showMediaValue={showMediaValue} />}
                cursor={{ fill: 'hsl(var(--muted)/0.5)', radius: 4 }}
              />
              <Bar yAxisId="left" dataKey="impressions" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.85} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="engagement"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
