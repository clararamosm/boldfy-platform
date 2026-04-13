'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CalendarDays, Clock, TrendingUp, Loader2 } from "lucide-react";
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n/interpolate';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { completeOnboardingItem } from '@/hooks/use-onboarding';
import { LinkedInPerformance } from '@/components/linkedin-performance/linkedin-performance';
import type { PipelinePost } from '@/app/actions/content-pipeline';

export default function ThoughtLeaderDashboardPage() {
  const t = useT();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
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

  // Handle LinkedIn OAuth redirect (?linkedin=success)
  useEffect(() => {
    const linkedinStatus = searchParams.get('linkedin');
    if (linkedinStatus === 'success') {
      toast({ title: 'LinkedIn conectado!', description: 'Sua conta do LinkedIn foi vinculada com sucesso.' });
      completeOnboardingItem(user?.uid, 'connect-linkedin');
      router.replace(window.location.pathname);
    } else if (linkedinStatus === 'error') {
      const message = searchParams.get('message') || 'Erro ao conectar com LinkedIn.';
      toast({ variant: 'destructive', title: 'Erro no LinkedIn', description: message });
      router.replace(window.location.pathname);
    }
  }, [searchParams, user?.uid, toast, router]);

  // Compute KPIs
  const published = posts.filter(p => p.status === 'postado').length;
  const scheduled = posts.filter(p => p.status === 'agendado').length;
  const pendingApproval = posts.filter(p => p.status === 'aprovar_post' || p.status === 'aprovar_ideia').length;
  const totalPosts = posts.length;

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

            {/* LinkedIn Performance */}
            {user?.uid && (
              <LinkedInPerformance userId={user.uid} hideIfNotConnected={false} />
            )}
          </>
        )}
      </main>
    </>
  );
}
