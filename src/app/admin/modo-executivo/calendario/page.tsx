'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { CalendarSkeleton } from '@/components/calendar/calendar-skeleton';
import { TeamCalendar } from '@/components/calendar/team-calendar';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { useAuth } from '@/contexts/auth-context';
import { getAllPipelinePostsForAdmin, type CalendarPipelinePost } from '@/app/actions/content-pipeline';

export default function AdminCalendarioPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const urlTlSlug = searchParams.get('tl');

  const [isLoading, setIsLoading] = useState(true);
  const [allPosts, setAllPosts] = useState<CalendarPipelinePost[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const result = await getAllPipelinePostsForAdmin(token);
      if (result.posts) {
        setAllPosts(result.posts);
      } else if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err) {
      console.error('Admin calendar fetch error:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar calendário.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!user?.uid) return;
    fetchData();
  }, [user?.uid, fetchData]);

  // Escopo: todos os líderes (geral) ou só o líder do ?tl=.
  const scopedPosts = useMemo(() => {
    if (!urlTlSlug) return allPosts;
    return allPosts.filter(p => p.tlSlug === urlTlSlug);
  }, [allPosts, urlTlSlug]);

  const profileName = useMemo(() => {
    if (!urlTlSlug) return null;
    return allPosts.find(p => p.tlSlug === urlTlSlug)?.tlName ?? null;
  }, [urlTlSlug, allPosts]);

  const title = profileName ? `Calendário — ${profileName}` : 'Calendário';

  return (
    <>
      <Header title={title} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <CalendarSkeleton cellHeight="h-36" />
        ) : (
          <TeamCalendar posts={scopedPosts} isProfileView={!!urlTlSlug} />
        )}
      </main>
    </>
  );
}
