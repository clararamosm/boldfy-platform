'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { LinkedInDailyEngagement } from '@/lib/linkedin-analytics-types';

interface ImpressionsWeeklyChartProps {
  // Dados de múltiplos meses concatenados
  dailyData: LinkedInDailyEngagement[];
}

const MONTH_ABBR_PT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

/**
 * Retorna o ISO week number e year para uma data "YYYY-MM-DD"
 */
function getISOWeek(dateStr: string): { year: number; week: number; month: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // ISO week: semana começa na segunda-feira
  const dayOfWeek = (date.getDay() + 6) % 7; // 0=Mon...6=Sun
  const thursday = new Date(date);
  thursday.setDate(date.getDate() - dayOfWeek + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return {
    year: thursday.getFullYear(),
    week: weekNum,
    month: String(m).padStart(2, '0'),
  };
}

interface WeekBar {
  key: string;        // "2026-W14"
  label: string;      // "S14"
  month: string;      // "04" → para agrupamento
  monthLabel: string; // "Abr"
  yearMonth: string;  // "2026-04"
  impressions: number;
  isFirstOfMonth: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function ImpressionsWeeklyChart({ dailyData }: ImpressionsWeeklyChartProps) {
  const bars = useMemo<WeekBar[]>(() => {
    if (!dailyData.length) return [];

    // Somar impressões por semana ISO
    const weekMap: Record<string, { impressions: number; month: string; yearMonth: string }> = {};

    for (const day of dailyData) {
      if (!day.date) continue;
      const { year, week, month } = getISOWeek(day.date);
      const yearMonth = `${day.date.substring(0, 4)}-${month}`;
      const key = `${year}-W${String(week).padStart(2, '0')}`;
      if (!weekMap[key]) {
        weekMap[key] = { impressions: 0, month, yearMonth };
      }
      weekMap[key].impressions += day.impressions;
    }

    // Ordenar chaves cronologicamente
    const sortedKeys = Object.keys(weekMap).sort();

    // Identificar primeiro de cada mês
    const seenMonths = new Set<string>();
    return sortedKeys.map(key => {
      const { impressions, month, yearMonth } = weekMap[key];
      const monthLabel = MONTH_ABBR_PT[month] ?? month;
      const isFirstOfMonth = !seenMonths.has(yearMonth);
      if (isFirstOfMonth) seenMonths.add(yearMonth);
      const weekNum = key.split('W')[1];
      return {
        key,
        label: `S${parseInt(weekNum, 10)}`,
        month,
        monthLabel,
        yearMonth,
        impressions,
        isFirstOfMonth,
      };
    });
  }, [dailyData]);

  if (!bars.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem dados de impressões disponíveis.
      </div>
    );
  }

  // Construir ticks customizados para o eixo X (mostrar "Abr" no primeiro da semana do mês)
  const CustomXAxisTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
    const bar = bars.find(b => b.key === payload?.value);
    if (!bar) return null;
    return (
      <g transform={`translate(${x},${y})`}>
        {bar.isFirstOfMonth && (
          <text x={0} y={-8} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight={600}>
            {bar.monthLabel}
          </text>
        )}
        <text x={0} y={12} textAnchor="middle" fontSize={9} fill="#94a3b8">
          {bar.label}
        </text>
        {bar.isFirstOfMonth && (
          <line x1={-8} x2={-8} y1={-20} y2={6} stroke="#e2e8f0" strokeWidth={1} />
        )}
      </g>
    );
  };

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">Impressões por Semana</h3>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: Math.max(600, bars.length * 28) }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bars} margin={{ top: 24, right: 8, left: 0, bottom: 8 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="key"
                tick={<CustomXAxisTick />}
                axisLine={false}
                tickLine={false}
                height={32}
              />
              <YAxis
                tickFormatter={formatNumber}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                width={40}
              />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Impressões']}
                labelFormatter={(label: string) => {
                  const bar = bars.find(b => b.key === label);
                  return bar ? `${bar.monthLabel} · ${bar.label}` : label;
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="impressions" radius={[3, 3, 0, 0]}>
                {bars.map((bar) => (
                  <Cell
                    key={bar.key}
                    fill={bar.isFirstOfMonth ? '#3b82f6' : '#93c5fd'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
