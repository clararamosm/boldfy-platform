'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CalendarDays, Clock, TrendingUp, Loader2, ArrowRight } from "lucide-react";
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n/interpolate';
import { useAuth } from '@/contexts/auth-context';
import { getAuthToken } from '@/lib/auth-client';
import type { PipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';
import { buildGetStatusLabel, getStatusConfig } from '@/lib/pipeline-config';
import { cn } from '@/lib/utils';

export default function ThoughtLeaderDashboardPage() {
  const t = useT();
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setIsLoading(true);
      const token = await getAuthToken();
      const { getPipelinePosts } = await import('@/app/actions/content-pipeline');
      const result = await getPipelinePosts(token, user.uid, null);
      if (result.posts) {
        setPosts(result.posts);
      }
    } catch (error) {
      console.error('Error fetching pipeline posts for dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Compute KPIs
  const published = posts.filter(p => p.status === 'postado').length;
  const scheduled = posts.filter(p => p.status === 'agendado').length;
  const pendingApproval = posts.filter(p => p.status === 'aprovar_post' || p.status === 'aprovar_ideia').length;
  const totalPosts = posts.length;

  // Recent posts needing attention (pending approval + adjustments)
  const actionNeeded = posts.filter(p =>
    p.status === 'aprovar_post' || p.status === 'aprovar_ideia' || p.status === 'ajuste'
  ).slice(0, 5);

  const getStatusLabel = buildGetStatusLabel(t);

  return (
    <>
      <Header title={t.thoughtLeader.dashboardTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">{interpolate(t.thoughtLeader.greeting, { name: (user?.name || '').split(' ')[0] })}</h2>
          <p className="text-muted-foreground">{t.thoughtLeader.subtitle}</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t.thoughtLeader.postsPublished}</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{published}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t.thoughtLeader.postsScheduled}</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{scheduled}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t.thoughtLeader.pendingApproval}</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingApproval}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{t.thoughtLeader.impressionsTotal}</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalPosts}</div>
                </CardContent>
              </Card>
            </div>

            {/* Action-needed posts */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{t.thoughtLeader.backlogTitle}</CardTitle>
                {actionNeeded.length > 0 && (
                  <button
                    onClick={() => router.push('/thoughtleader/backlog')}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {t.common.viewAll} <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </CardHeader>
              <CardContent>
                {actionNeeded.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t.contentPipeline.noPostsInStatus}</p>
                ) : (
                  <div className="space-y-3">
                    {actionNeeded.map(post => {
                      const config = getStatusConfig(post.status);
                      return (
                        <div
                          key={post.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => router.push('/thoughtleader/backlog')}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{post.title || 'Sem título'}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {post.formato || ''}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn('ml-2 shrink-0 text-xs', config.badge)}
                          >
                            {getStatusLabel(post.status)}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
