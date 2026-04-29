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
} from 'recharts';
import type { LinkedInSnapshot } from '@/lib/linkedin-analytics-types';

interface FollowersMonthlyChartProps {
  // Record<"YYYY-MM", snapshot>
  snapshots: Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalNewFollowers'>>;
}

const MONTH_ABBR_PT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

interface MonthBar {
  mesAno: string;
  label: string;  // "Jan", "Fev"...
  year: string;
  followers: number;
  hasData: boolean;
}

export function FollowersMonthlyChart({ snapshots }: FollowersMonthlyChartProps) {
  const bars = useMemo<MonthBar[]>(() => {
    const sortedKeys = Object.keys(snapshots).sort();
    if (!sortedKeys.length) return [];

    // Preencher meses sem dados (entre o primeiro e o último)
    const first = sortedKeys[0];
    const last = sortedKeys[sortedKeys.length - 1];

    const result: MonthBar[] = [];
    let [cy, cm] = first.split('-').map(Number);
    const [ey, em] = last.split('-').map(Number);

    while (cy < ey || (cy === ey && cm <= em)) {
      const mesAno = `${cy}-${String(cm).padStart(2, '0')}`;
      const snap = snapshots[mesAno];
      result.push({
        mesAno,
        label: MONTH_ABBR_PT[String(cm).padStart(2, '0')] ?? String(cm),
        year: String(cy),
        followers: snap?.totalNewFollowers ?? 0,
        hasData: !!snap,
      });

      cm++;
      if (cm > 12) { cm = 1; cy++; }
    }

    return result;
  }, [snapshots]);

  if (!bars.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem dados de seguidores disponíveis.
      </div>
    );
  }

  // Mostrar o ano quando muda
  const CustomXAxisTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) => {
    const bar = bars.find(b => b.mesAno === payload?.value);
    if (!bar) return null;
    const idx = bars.indexOf(bar);
    const showYear = idx === 0 || bars[idx - 1]?.year !== bar.year;
    return (
      <g transform={`translate(${x},${y})`}>
        {showYear && (
          <text x={0} y={-8} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight={600}>
            {bar.year}
          </text>
        )}
        <text x={0} y={12} textAnchor="middle" fontSize={10} fill={bar.hasData ? '#475569' : '#cbd5e1'}>
          {bar.label}
        </text>
      </g>
    );
  };

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">Novos Seguidores por Mês</h3>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <div style={{ minWidth: Math.max(400, bars.length * 40) }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bars} margin={{ top: 24, right: 8, left: 0, bottom: 8 }} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="mesAno"
                tick={<CustomXAxisTick />}
                axisLine={false}
                tickLine={false}
                height={32}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                width={36}
              />
              <Tooltip
                formatter={(value: number) => [value.toLocaleString('pt-BR'), 'Novos seguidores']}
                labelFormatter={(label: string) => {
                  const bar = bars.find(b => b.mesAno === label);
                  return bar ? `${bar.label} ${bar.year}` : label;
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar
                dataKey="followers"
                fill="#8b5cf6"
                radius={[3, 3, 0, 0]}
                opacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
