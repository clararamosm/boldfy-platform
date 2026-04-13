// src/components/linkedin-performance/metrics-kpi-cards.tsx
'use client';

import { Send, Heart, MessageCircle, TrendingUp } from 'lucide-react';
import type { DashboardMetrics } from '@/app/actions/linkedin';

type MetricsKPICardsProps = {
  totals: DashboardMetrics['totals'];
};

const KPI_CONFIG = [
  {
    key: 'totalPosts',
    label: 'Posts publicados',
    icon: Send,
    bg: 'bg-[#0A66C2]/5',
    text: 'text-[#0A66C2]',
    iconBg: 'bg-[#0A66C2]/10',
  },
  {
    key: 'totalReactions',
    label: 'Total de reacoes',
    icon: Heart,
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    text: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30',
  },
  {
    key: 'totalComments',
    label: 'Total de comentarios',
    icon: MessageCircle,
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    key: 'avgReactionsPerPost',
    label: 'Media reacoes/post',
    icon: TrendingUp,
    bg: 'bg-green-50 dark:bg-green-950/20',
    text: 'text-green-600 dark:text-green-400',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
  },
] as const;

export function MetricsKPICards({ totals }: MetricsKPICardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {KPI_CONFIG.map((kpi) => {
        const Icon = kpi.icon;
        const value = totals[kpi.key as keyof typeof totals];
        return (
          <div
            key={kpi.key}
            className={`${kpi.bg} rounded-lg p-3 flex flex-col items-center gap-1.5`}
          >
            <div className={`${kpi.iconBg} rounded-full p-1.5`}>
              <Icon className={`h-3.5 w-3.5 ${kpi.text}`} />
            </div>
            <span className={`text-2xl font-bold ${kpi.text}`}>{value}</span>
            <span className="text-[11px] text-muted-foreground text-center">{kpi.label}</span>
          </div>
        );
      })}
    </div>
  );
}
