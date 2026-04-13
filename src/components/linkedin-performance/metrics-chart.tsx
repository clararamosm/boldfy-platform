// src/components/linkedin-performance/metrics-chart.tsx
'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import type { PostWithMetrics } from '@/app/actions/linkedin';

type MetricsChartProps = {
  posts: PostWithMetrics[];
};

type ChartDataPoint = {
  date: string;
  label: string;
  reactions: number;
  comments: number;
};

export function MetricsChart({ posts }: MetricsChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!posts.length) return [];

    // Sort posts by date ascending
    const sorted = [...posts]
      .filter((p) => p.publishedAt)
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());

    // Group by day
    const byDay = new Map<string, { reactions: number; comments: number }>();
    for (const post of sorted) {
      const dayKey = format(parseISO(post.publishedAt), 'yyyy-MM-dd');
      const current = byDay.get(dayKey) || { reactions: 0, comments: 0 };
      current.reactions += post.metrics.totalReactions;
      current.comments += post.metrics.comments;
      byDay.set(dayKey, current);
    }

    return Array.from(byDay.entries()).map(([dateKey, data]) => ({
      date: dateKey,
      label: format(parseISO(dateKey), 'dd MMM', { locale: ptBR }),
      reactions: data.reactions,
      comments: data.comments,
    }));
  }, [posts]);

  if (chartData.length < 2) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
        Dados insuficientes para exibir o grafico. Publique mais posts!
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradReactions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradComments" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--popover))',
              color: 'hsl(var(--popover-foreground))',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
            }}
            labelFormatter={(label) => label}
            formatter={(value: number, name: string) => [
              value,
              name === 'reactions' ? 'Reacoes' : 'Comentarios',
            ]}
          />
          <Area
            type="monotone"
            dataKey="reactions"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#gradReactions)"
            dot={{ fill: '#f43f5e', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="comments"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#gradComments)"
            dot={{ fill: '#3b82f6', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
