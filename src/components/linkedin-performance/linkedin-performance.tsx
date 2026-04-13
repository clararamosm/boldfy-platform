// src/components/linkedin-performance/linkedin-performance.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Linkedin, ExternalLink, Heart, MessageCircle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthToken } from '@/lib/auth-client';
import {
  getLinkedInDashboardMetrics,
  type DashboardMetrics,
  type PostWithMetrics,
} from '@/app/actions/linkedin';
import { PeriodFilter, getPeriodRange, type PeriodKey, type ProfileOption } from './period-filter';
import { MetricsKPICards } from './metrics-kpi-cards';
import { MetricsChart } from './metrics-chart';

// ─── Types ───────────────────────────────────────────────────

type LinkedInPerformanceProps = {
  /** ID of the user whose metrics to display */
  userId: string;
  /** Hide component entirely when LinkedIn is not connected (default true) */
  hideIfNotConnected?: boolean;
  /** Show profile selector (strategist view) */
  showProfileFilter?: boolean;
  /** Profile options for strategist filter */
  profiles?: ProfileOption[];
  /** Callback with loaded metrics so parent can use them (e.g., calendar cards) */
  onMetricsLoaded?: (metricsMap: Map<string, { reactions: number; comments: number }>) => void;
  /** Caller role for auth — 'strategist' or 'admin' bypasses requireSelf */
  callerRole?: 'self' | 'strategist' | 'admin';
};

// ─── Skeleton ────────────────────────────────────────────────

function PerformanceSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[220px] rounded-lg" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Post Card ───────────────────────────────────────────────

function PostMetricCard({ post }: { post: PostWithMetrics }) {
  const captionPreview = post.caption
    ? post.caption.length > 120
      ? post.caption.slice(0, 120) + '...'
      : post.caption
    : 'Sem legenda';

  const publishDate = post.publishedAt
    ? format(parseISO(post.publishedAt), 'dd MMM', { locale: ptBR })
    : '';

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A66C2]/10">
        <Linkedin className="h-4 w-4 text-[#0A66C2]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground line-clamp-2">{captionPreview}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span>{publishDate}</span>
          <span className="flex items-center gap-1 text-rose-500">
            <Heart className="h-3 w-3" />
            {post.metrics.totalReactions}
          </span>
          <span className="flex items-center gap-1 text-blue-500">
            <MessageCircle className="h-3 w-3" />
            {post.metrics.comments}
          </span>
          {post.linkedinPostUrl && (
            <a
              href={post.linkedinPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function LinkedInPerformance({
  userId,
  hideIfNotConnected = true,
  showProfileFilter = false,
  profiles,
  onMetricsLoaded,
  callerRole = 'self',
}: LinkedInPerformanceProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(userId);

  // When profiles change, default to first profile
  useEffect(() => {
    if (showProfileFilter && profiles?.length) {
      setSelectedProfileId(profiles[0].id);
    } else {
      setSelectedProfileId(userId);
    }
  }, [showProfileFilter, profiles, userId]);

  const fetchMetrics = useCallback(async () => {
    const targetUserId = showProfileFilter ? selectedProfileId : userId;
    if (!targetUserId) return;

    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const dateRange = getPeriodRange(period);
      const result = await getLinkedInDashboardMetrics(token, targetUserId, dateRange, callerRole);
      setMetrics(result);

      // Notify parent of loaded metrics for calendar card enrichment
      if (onMetricsLoaded && result.posts.length > 0) {
        const map = new Map<string, { reactions: number; comments: number }>();
        for (const post of result.posts) {
          if (post.linkedinPostId) {
            map.set(post.id, {
              reactions: post.metrics.totalReactions,
              comments: post.metrics.comments,
            });
          }
        }
        onMetricsLoaded(map);
      }
    } catch (err) {
      console.error('Error fetching LinkedIn metrics:', err);
      setMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId, selectedProfileId, period, showProfileFilter, callerRole, onMetricsLoaded]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ─── Render states ──────────────────────────────────────────

  // Not connected — hide or show message
  if (!isLoading && metrics?.error === 'LinkedIn nao conectado.') {
    if (hideIfNotConnected) return null;
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="rounded-full bg-[#0A66C2]/10 p-3 mb-3">
            <Linkedin className="h-6 w-6 text-[#0A66C2]" />
          </div>
          <p className="text-sm text-muted-foreground">
            LinkedIn nao conectado. Conecte sua conta para ver as metricas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (!isLoading && metrics?.error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-destructive">{metrics.error}</p>
        </CardContent>
      </Card>
    );
  }

  const hasPosts = metrics && !metrics.error && metrics.totals.totalPosts > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-full bg-[#0A66C2]/10 p-1.5">
              <Linkedin className="h-4 w-4 text-[#0A66C2]" />
            </div>
            LinkedIn Performance
          </CardTitle>
          <PeriodFilter
            period={period}
            onPeriodChange={setPeriod}
            showProfileFilter={showProfileFilter}
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onProfileChange={setSelectedProfileId}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <PerformanceSkeleton />
        ) : hasPosts ? (
          <>
            <MetricsKPICards totals={metrics!.totals} />

            <MetricsChart posts={metrics!.posts} />

            {/* Recent posts */}
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Posts recentes
              </p>
              {metrics!.posts.slice(0, 5).map((post) => (
                <PostMetricCard key={post.id} post={post} />
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Linkedin className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhum post publicado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Publique conteudo no LinkedIn para ver suas metricas aqui.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
