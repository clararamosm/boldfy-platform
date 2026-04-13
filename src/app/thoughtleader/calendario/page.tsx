// src/app/thoughtleader/calendario/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthToken } from '@/lib/auth-client';
import type { PipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';
import { getStatusConfig, buildGetStatusLabel } from '@/lib/pipeline-config';
import { CalendarPostCard, type CalendarCardConfig } from '@/components/calendar/calendar-post-card';
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell';
import { PostListTable } from '@/components/calendar/post-list-table';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar as CalIcon,
  ExternalLink,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday as dateIsToday,
  parseISO,
} from 'date-fns';
import { useT, useLocale } from '@/lib/i18n/context';
import { getDateLocale } from '@/lib/i18n/date-utils';

// ─── Status filters ──────────────────────────────────────
type StatusFilter = 'all' | PipelineStatus;

const FILTER_STATUSES: PipelineStatus[] = [
  'backlog', 'aprovar_ideia', 'em_producao', 'aprovar_post',
  'pronto_pra_postar', 'agendado', 'postado',
];

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-8" />
        ))}
        {[...Array(35)].map((_, i) => (
          <Skeleton key={`d-${i}`} className="h-24" />
        ))}
      </div>
    </div>
  );
}

export default function ThoughtLeaderCalendarioPage() {
  const t = useT();
  const locale = useLocale();
  const dateFnsLocale = getDateLocale(locale);
  const { user: authUser } = useAuth();
  const userId = authUser?.uid || null;
  const router = useRouter();

  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Slugs for post navigation
  const [companySlug, setCompanySlug] = useState('');
  const [tlSlug, setTlSlug] = useState('');

  const getStatusLabel = buildGetStatusLabel(t);

  // ─── Fetch slugs ─────────────────────────────────────────
  useEffect(() => {
    if (!userId || !authUser?.companyId) return;
    const fetchSlugs = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const { generateSlug } = await import('@/lib/slugify');

        const tlDoc = await getDoc(doc(db, 'users', userId));
        const tlData = tlDoc.data();
        const tlName = tlData?.name || tlData?.profile?.name || '';
        setTlSlug((tlData?.slug as string) || generateSlug(tlName, userId));

        const compDoc = await getDoc(doc(db, 'companies', authUser.companyId!));
        const compData = compDoc.data();
        const compName = compData?.companyName || '';
        setCompanySlug((compData?.slug as string) || generateSlug(compName, authUser.companyId!));
      } catch {
        setCompanySlug(authUser.companyId || '');
        setTlSlug(userId);
      }
    };
    fetchSlugs();
  }, [userId, authUser?.companyId]);

  // ─── Fetch pipeline posts ────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const { getPipelinePosts } = await import('@/app/actions/content-pipeline');
      const result = await getPipelinePosts(token, userId, null);
      if (result.posts) {
        setPosts(result.posts);
      }
    } catch (err) {
      console.error('Calendar fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ─── Filter posts ────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    if (statusFilter === 'all') return posts;
    return posts.filter(p => p.status === statusFilter);
  }, [posts, statusFilter]);

  // ─── Posts only with scheduledFor — grouped by day ───────
  const postsByDay = useMemo(() => {
    const map = new Map<string, PipelinePost[]>();
    filteredPosts.forEach(post => {
      if (!post.scheduledFor) return;
      const dayKey = post.scheduledFor.substring(0, 10);
      const existing = map.get(dayKey) || [];
      existing.push(post);
      map.set(dayKey, existing);
    });
    return map;
  }, [filteredPosts]);

  // ─── Status counts ──────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: posts.length };
    for (const s of FILTER_STATUSES) counts[s] = 0;
    posts.forEach(p => {
      if (p.status in counts) counts[p.status]++;
    });
    return counts;
  }, [posts]);

  // ─── Calendar days ──────────────────────────────────────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // ─── Selected day posts ─────────────────────────────────
  const selectedDayPosts = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return postsByDay.get(key) || [];
  }, [selectedDay, postsByDay]);

  // ─── Posts without a date (unscheduled) ─────────────────
  const unscheduledPosts = useMemo(() => {
    return filteredPosts.filter(p => !p.scheduledFor);
  }, [filteredPosts]);

  // ─── Card config adapter ────────────────────────────────
  const getCardConfig = (status: PipelineStatus): CalendarCardConfig => {
    const cfg = getStatusConfig(status);
    return { label: getStatusLabel(status), badge: cfg.badge, dot: cfg.dot };
  };

  const navigateToPost = (postId: string) => {
    router.push(`/post/${companySlug || authUser?.companyId}/${tlSlug || userId}/${postId}`);
  };

  const weekDays = t.colabCalendar.dayNames;

  if (isLoading) {
    return (
      <>
        <Header title={t.thoughtLeader.calendarTitle} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <CalendarSkeleton />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t.thoughtLeader.calendarTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <p className="text-muted-foreground text-sm">{t.thoughtLeader.calendarDescription}</p>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold capitalize min-w-[180px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: dateFnsLocale })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Status filters */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'all' as StatusFilter, label: t.contentPipeline.allStatuses },
            ...FILTER_STATUSES.map(s => ({
              key: s as StatusFilter,
              label: getStatusLabel(s),
            })),
          ].map(f => {
            const cfg = f.key === 'all' ? null : getStatusConfig(f.key as PipelineStatus);
            const colorActive = cfg ? cfg.badge : 'bg-muted text-foreground';
            const count = statusCounts[f.key] || 0;

            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  statusFilter === f.key
                    ? `${colorActive} ring-2 ring-primary/30 shadow-sm`
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                )}
              >
                {f.label}
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                  statusFilter === f.key ? 'bg-white/60 dark:bg-black/20' : 'bg-muted-foreground/10',
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Calendar grid + sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
          {/* CALENDAR GRID */}
          <div className="border rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-7 bg-muted/50">
              {weekDays.map(day => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayPosts = postsByDay.get(dayKey) || [];
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

                return (
                  <CalendarDayCell
                    key={idx}
                    day={day}
                    inMonth={isSameMonth(day, currentMonth)}
                    isToday={dateIsToday(day)}
                    isSelected={isSelected}
                    onClick={() => setSelectedDay(day)}
                    droppable={false}
                    minHeight="min-h-[100px]"
                  >
                    {dayPosts.slice(0, 3).map(post => (
                      <CalendarPostCard
                        key={post.id}
                        post={{
                          id: post.id,
                          title: post.title,
                          caption: post.caption,
                          scheduledFor: post.scheduledFor,
                          status: post.status,
                        }}
                        statusConfig={getCardConfig(post.status)}
                        draggable={false}
                        onClick={() => navigateToPost(post.id)}
                      />
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayPosts.length - 3}
                      </div>
                    )}
                  </CalendarDayCell>
                );
              })}
            </div>
          </div>

          {/* SIDEBAR — Selected day details */}
          <div className="space-y-4">
            <h3 className="font-semibold">
              {selectedDay
                ? format(selectedDay, "d 'de' MMMM", { locale: dateFnsLocale })
                : t.colabCalendar.selectDay}
            </h3>

            {selectedDay ? (
              selectedDayPosts.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayPosts.map(post => {
                    const cfg = getStatusConfig(post.status);
                    return (
                      <Card key={post.id} className="overflow-hidden">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge className={cn('text-[10px] h-5', cfg.badge)}>
                              {getStatusLabel(post.status)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => navigateToPost(post.id)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <h4 className="text-sm font-medium line-clamp-2">
                            {post.title || 'Sem titulo'}
                          </h4>
                          {post.caption && (
                            <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-line">
                              {post.caption}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            {post.scheduledFor && (
                              <span className="flex items-center gap-1">
                                <CalIcon className="h-3 w-3" />
                                {format(parseISO(post.scheduledFor), 'HH:mm')}
                              </span>
                            )}
                            {post.formato && <span>{post.formato}</span>}
                            {post.etapa && <span>{post.etapa}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum post neste dia</p>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                  <CalIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Selecione um dia no calendário</p>
                </CardContent>
              </Card>
            )}

            {/* Unscheduled posts */}
            {unscheduledPosts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Sem data ({unscheduledPosts.length})
                </h4>
                {unscheduledPosts.slice(0, 5).map(post => {
                  const cfg = getStatusConfig(post.status);
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigateToPost(post.id)}
                      className="w-full text-left rounded-md border bg-card p-2.5 transition-all hover:ring-1 hover:ring-primary/40 space-y-1"
                    >
                      <p className="text-xs font-medium line-clamp-1">
                        {post.title || 'Sem titulo'}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
                        <span className={cn('text-[9px] font-semibold px-1 py-px rounded', cfg.badge)}>
                          {getStatusLabel(post.status)}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {unscheduledPosts.length > 5 && (
                  <p className="text-[11px] text-muted-foreground">
                    +{unscheduledPosts.length - 5} mais
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Post list table — all posts with filters */}
        <PostListTable
          posts={posts}
          getStatusLabel={getStatusLabel}
          onPostClick={navigateToPost}
        />
      </main>
    </>
  );
}
