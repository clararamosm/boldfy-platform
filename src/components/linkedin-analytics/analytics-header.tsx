'use client';

import { Users, TrendingUp, TrendingDown, FileText } from 'lucide-react';
import { LINKEDIN_CPM_BRL } from '@/lib/constants';
import type { LinkedInSnapshot } from '@/lib/linkedin-analytics-types';

const MONTH_NAMES_PT: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
};

function formatMesAno(mesAno: string): string {
  const [, month] = mesAno.split('-');
  return MONTH_NAMES_PT[month] ?? mesAno;
}

function formatNumber(n: number): string {
  return n.toLocaleString('pt-BR');
}

function formatCurrency(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

interface AnalyticsHeaderProps {
  userName?: string;
  userAvatarUrl?: string;
  snapshot: LinkedInSnapshot;
  prevSnapshot?: LinkedInSnapshot;
  showMediaValue?: boolean;   // apenas admin
  monthSelector: React.ReactNode;
  /** Exibir contagem de posts publicados junto ao seletor de mês */
  showPostsCount?: boolean;
}

export function AnalyticsHeader({
  userName,
  snapshot,
  prevSnapshot,
  showMediaValue = false,
  monthSelector,
  showPostsCount = true,
}: AnalyticsHeaderProps) {
  const mediaValue = (snapshot.totalImpressions / 1000) * LINKEDIN_CPM_BRL;

  const followerDelta = prevSnapshot
    ? snapshot.totalNewFollowers - prevSnapshot.totalNewFollowers
    : null;

  const prevMonthName = prevSnapshot ? formatMesAno(prevSnapshot.mesAno) : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      {/* Esquerda: info de seguidores */}
      <div className="space-y-1">
        {userName && (
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{userName}</p>
        )}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-xl font-bold">{formatNumber(snapshot.totalFollowers)}</span>
          <span className="text-sm text-muted-foreground">seguidores</span>
        </div>
        {followerDelta !== null && prevMonthName && (
          <div className={`flex items-center gap-1 text-sm ${followerDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {followerDelta >= 0
              ? <TrendingUp className="h-3.5 w-3.5" />
              : <TrendingDown className="h-3.5 w-3.5" />
            }
            <span>
              {followerDelta >= 0 ? '+' : ''}{formatNumber(followerDelta)} este mês
              {' '}vs{' '}
              {formatNumber(prevSnapshot!.totalNewFollowers)} em {prevMonthName}
              {prevSnapshot!.totalNewFollowers > 0 && (
                <span className="text-muted-foreground text-xs ml-1">
                  ({followerDelta >= 0 ? '+' : ''}
                  {(((snapshot.totalNewFollowers - prevSnapshot!.totalNewFollowers) / prevSnapshot!.totalNewFollowers) * 100).toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Valor de mídia — apenas admin */}
        {showMediaValue && (
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 w-fit">
            💰 Valor de Mídia: {formatCurrency(mediaValue)}
          </div>
        )}
      </div>

      {/* Direita: posts publicados + seletor de mês */}
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {showPostsCount && snapshot.totalPostsPublished > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>
              <strong className="text-foreground font-semibold">{snapshot.totalPostsPublished}</strong>
              {' '}post{snapshot.totalPostsPublished !== 1 ? 's' : ''} publicado{snapshot.totalPostsPublished !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {monthSelector}
      </div>
    </div>
  );
}
