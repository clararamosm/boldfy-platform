'use client';

import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { LinkedInSnapshot } from '@/lib/linkedin-analytics-types';
import { MONTH_NAMES_PT } from '@/lib/linkedin-analytics-utils';
import { buildMonthBars, ChartXAxisTick, type MonthBarBase } from './chart-shared';

interface FollowersMonthlyChartProps {
  snapshots: Record<string, Pick<LinkedInSnapshot, 'mesAno' | 'totalNewFollowers'>>;
}

interface MonthBar extends MonthBarBase {
  followers: number;
}

export function FollowersMonthlyChart({ snapshots }: FollowersMonthlyChartProps) {
  const bars = useMemo<MonthBar[]>(() => {
    const sortedKeys = Object.keys(snapshots).sort();
    return buildMonthBars(sortedKeys).map(base => ({
      ...base,
      followers: snapshots[base.mesAno]?.totalNewFollowers ?? 0,
    }));
  }, [snapshots]);

  if (!bars.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem dados de seguidores disponíveis.
      </div>
    );
  }

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
                tick={<ChartXAxisTick bars={bars} />}
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
                  const [year, month] = label.split('-');
                  return `${MONTH_NAMES_PT[month] ?? month} ${year}`;
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="followers" fill="#8b5cf6" radius={[3, 3, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
