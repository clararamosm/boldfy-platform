// src/app/colaborador/calendario/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/auth-client';
import { getScheduledPosts, deleteScheduledPost, type ScheduledPost } from '@/app/actions/posts';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit3,
  Linkedin,
  ImageIcon,
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
  isToday,
  parseISO,
} from 'date-fns';
import { useT, useLocale } from '@/lib/i18n/context';
import { getDateLocale } from '@/lib/i18n/date-utils';
import type { Dictionary } from '@/lib/i18n/dictionaries/pt-BR';

function getStatusConfig(t: Dictionary) {
  return {
    published: {
      label: t.colabCalendar.statusPublished,
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      cardBorder: 'border-l-4 border-l-purple-500',
      calendarDot: 'bg-purple-500',
      icon: CheckCircle2,
    },
    scheduled: {
      label: t.colabCalendar.statusScheduled,
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      cardBorder: 'border-l-4 border-l-blue-500',
      calendarDot: 'bg-blue-500',
      icon: Clock,
    },
    in_progress: {
      label: t.colabCalendar.filterInProgress,
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      cardBorder: 'border-l-4 border-l-yellow-500',
      calendarDot: 'bg-yellow-500',
      icon: Edit3,
    },
    draft: {
      label: t.colabCalendar.statusIdea,
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      cardBorder: 'border-l-4 border-l-gray-400',
      calendarDot: 'bg-gray-400',
      icon: Edit3,
    },
    failed: {
      label: t.colabCalendar.statusFailed,
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      cardBorder: 'border-l-4 border-l-red-500',
      calendarDot: 'bg-red-500',
      icon: AlertCircle,
    },
  };
}

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

type StatusFilter = 'all' | 'published' | 'scheduled' | 'in_progress' | 'draft' | 'failed';

export default function CalendarioPage() {
  const t = useT();
  const locale = useLocale();
  const dateFnsLocale = getDateLocale(locale);
  const statusConfig = useMemo(() => getStatusConfig(t), [t]);
  const { user: authUser } = useAuth();
  const userId = authUser?.uid || null;
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { toast } = useToast();
  const router = useRouter();

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const token = await getAuthToken();
    const result = await getScheduledPosts(token, userId);
    if (result.posts) {
      setPosts(result.posts);
    } else if (result.error) {
      toast({ variant: 'destructive', title: t.common.error, description: result.error });
    }
    setIsLoading(false);
  }, [userId, toast]);

  useEffect(() => {
    if (userId) fetchPosts();
  }, [userId, fetchPosts]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { all: posts.length, published: 0, scheduled: 0, in_progress: 0, draft: 0, failed: 0 };
    posts.forEach(post => {
      if (post.status in counts) counts[post.status as keyof typeof counts]++;
    });
    return counts;
  }, [posts]);

  // Filtered posts by selected status
  const filteredPosts = useMemo(() => {
    if (statusFilter === 'all') return posts;
    return posts.filter(p => p.status === statusFilter);
  }, [posts, statusFilter]);

  // Upcoming posts (next scheduled, not yet published)
  const upcomingPosts = useMemo(() => {
    const now = new Date();
    return posts
      .filter(p => p.status === 'scheduled' && parseISO(p.scheduledFor) > now)
      .sort((a, b) => parseISO(a.scheduledFor).getTime() - parseISO(b.scheduledFor).getTime())
      .slice(0, 5);
  }, [posts]);

  // Calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Posts grouped by day (respects filter)
  const postsByDay = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    filteredPosts.forEach(post => {
      const dayKey = format(parseISO(post.scheduledFor), 'yyyy-MM-dd');
      const existing = map.get(dayKey) || [];
      existing.push(post);
      map.set(dayKey, existing);
    });
    return map;
  }, [filteredPosts]);

  // Selected day posts
  const selectedDayPosts = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return postsByDay.get(key) || [];
  }, [selectedDay, postsByDay]);

  const handleDeletePost = async (postId: string) => {
    if (!userId) return;
    const token = await getAuthToken();
    const result = await deleteScheduledPost(token, userId, postId);
    if (result.success) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: t.colabCalendar.postRemoved });
    } else {
      toast({ variant: 'destructive', title: t.common.error, description: result.error });
    }
  };

  const handleNewPost = (date?: Date) => {
    const params = new URLSearchParams();
    if (date) {
      params.set('date', date.toISOString());
    }
    router.push(`/colaborador/calendario/novo?${params.toString()}`);
  };

  const weekDays = t.colabCalendar.dayNames;

  if (isLoading && !userId) {
    return (
      <>
        <Header title={t.colabCalendar.title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <CalendarSkeleton />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Calendário" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          {/* CALENDAR */}
          <div className="space-y-4">
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
              <Button onClick={() => handleNewPost()} className="gap-2">
                <Plus className="h-4 w-4" />
                {t.colabCalendar.newPost}
              </Button>
            </div>

            {/* Status filters */}
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: 'all' as StatusFilter, label: t.colabCalendar.filterAll, color: 'bg-muted text-foreground' },
                { key: 'published' as StatusFilter, label: t.colabCalendar.filterPublished, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
                { key: 'scheduled' as StatusFilter, label: t.colabCalendar.filterScheduled, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                { key: 'in_progress' as StatusFilter, label: t.colabCalendar.filterInProgress, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
                { key: 'draft' as StatusFilter, label: t.colabCalendar.filterIdeas, color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
                { key: 'failed' as StatusFilter, label: t.colabCalendar.filterFailed, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
              ]).map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                    ${statusFilter === f.key ? f.color + ' ring-2 ring-primary/30 shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}
                  `}
                >
                  {f.label}
                  <span className={`
                    inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
                    ${statusFilter === f.key ? 'bg-white/60 dark:bg-black/20' : 'bg-muted-foreground/10'}
                  `}>
                    {statusCounts[f.key]}
                  </span>
                </button>
              ))}
            </div>

            {/* Calendar grid */}
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
                  const inMonth = isSameMonth(day, currentMonth);
                  const today = isToday(day);
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDay(day)}
                      className={`
                        min-h-[90px] p-1.5 border-b border-r text-left transition-colors
                        hover:bg-muted/30
                        ${!inMonth ? 'bg-muted/10' : ''}
                        ${isSelected ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''}
                      `}
                    >
                      <span
                        className={`
                          inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium
                          ${today ? 'bg-primary text-primary-foreground' : ''}
                          ${!inMonth ? 'text-muted-foreground/50' : 'text-foreground'}
                        `}
                      >
                        {format(day, 'd')}
                      </span>

                      {/* Post indicators */}
                      <div className="mt-1 space-y-0.5">
                        {dayPosts.slice(0, 2).map(post => {
                          const config = statusConfig[post.status];
                          return (
                            <div
                              key={post.id}
                              className={`text-[10px] px-1 py-0.5 rounded truncate ${config.color}`}
                            >
                              {format(parseISO(post.scheduledFor), 'HH:mm')} · {post.caption.slice(0, 20)}...
                            </div>
                          );
                        })}
                        {dayPosts.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayPosts.length - 2}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SIDEBAR — Selected day details */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {selectedDay
                  ? format(selectedDay, "d 'de' MMMM", { locale: dateFnsLocale })
                  : t.colabCalendar.selectDay}
              </h3>
              {selectedDay && (
                <Button size="sm" variant="outline" onClick={() => handleNewPost(selectedDay)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  {t.colabCalendar.schedule}
                </Button>
              )}
            </div>

            {selectedDay ? (
              selectedDayPosts.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayPosts.map(post => {
                    const config = statusConfig[post.status] || statusConfig.draft;
                    const StatusIcon = config.icon;
                    return (
                      <Card key={post.id} className={`overflow-hidden ${config.cardBorder}`}>
                        <CardContent className="p-4 space-y-3">
                          {/* Status + time */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={`${config.color} text-xs gap-1`}>
                                <StatusIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(post.scheduledFor), 'HH:mm')}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {post.status !== 'published' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => router.push(`/colaborador/calendario/novo?edit=${post.id}`)}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeletePost(post.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {/* Caption preview */}
                          <p className="text-sm line-clamp-4 whitespace-pre-line">{post.caption}</p>

                          {/* Media indicator */}
                          {post.mediaUrl && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <ImageIcon className="h-3.5 w-3.5" />
                              {t.colabCalendar.mediaAttached}
                            </div>
                          )}

                          {/* LinkedIn link for published posts */}
                          {post.linkedinPostUrl && (
                            <a
                              href={post.linkedinPostUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-[#0A66C2] hover:underline font-medium"
                            >
                              <Linkedin className="h-3.5 w-3.5" />
                              {t.colabCalendar.viewOnLinkedin} ↗
                            </a>
                          )}

                          {/* Published date */}
                          {post.status === 'published' && post.publishedAt && (
                            <p className="text-[11px] text-muted-foreground">
                              {t.colabCalendar.statusPublished} {format(parseISO(post.publishedAt), "d MMM, HH:mm", { locale: dateFnsLocale })}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="rounded-full bg-muted p-3 mb-3">
                      <Linkedin className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t.colabCalendar.noPostsScheduled}</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleNewPost(selectedDay)}
                      className="mt-1 text-xs"
                    >
                      {t.colabCalendar.createForDay}
                    </Button>
                  </CardContent>
                </Card>
              )
            ) : (
              <div className="space-y-3">
                {upcomingPosts.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">{t.colabCalendar.nextScheduled}</p>
                    {upcomingPosts.map(post => {
                      const config = statusConfig[post.status] || statusConfig.draft;
                      const StatusIcon = config.icon;
                      return (
                        <Card key={post.id} className={`overflow-hidden ${config.cardBorder}`}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className={`${config.color} text-xs gap-1`}>
                                <StatusIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(post.scheduledFor), "d MMM, HH:mm", { locale: dateFnsLocale })}
                              </span>
                            </div>
                            <p className="text-sm line-clamp-2 whitespace-pre-line">{post.caption}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        {t.colabCalendar.emptyState}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
