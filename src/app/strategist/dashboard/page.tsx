// src/app/strategist/dashboard/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import {
  getAllPipelinePostsForStrategist,
  getRecentActivitiesForStrategist,
  type CalendarPipelinePost,
  type Activity,
} from '@/app/actions/content-pipeline';
import { STATUS_CONFIG } from '@/lib/pipeline-config';
import { CalendarPostCard, type CalendarCardConfig } from '@/components/calendar/calendar-post-card';

import {
  Activity as ActivityIcon,
  MessageSquare,
  Calendar,
} from 'lucide-react';
import {
  startOfWeek,
  addDays,
  format,
  isToday,
} from 'date-fns';

// ─── Helpers ──────────────────────────────────────────

function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const date = new Date(isoDate).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function getCardConfig(status: string): CalendarCardConfig {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.backlog;
  return { label: cfg.label, badge: cfg.badge, dot: cfg.dot };
}

const DAY_LABELS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];

// ─── Skeleton ─────────────────────────────────────────

function getActivityDescription(activity: Activity): JSX.Element {
  const firstName = activity.authorName.split(' ')[0];
  switch (activity.type) {
    case 'comment':
      return (
        <>
          <span className="font-medium">{firstName}</span>
          {' '}comentou em{' '}
          <span className="font-medium">{activity.postTitle}</span>
        </>
      );
    case 'approval':
      return (
        <>
          <span className="font-medium">{firstName}</span>
          {' '}aprovou{' '}
          <span className="font-medium">{activity.postTitle}</span>
        </>
      );
    case 'published':
      return (
        <>
          <span className="font-medium">{activity.postTitle}</span>
          {' '}foi publicado
        </>
      );
    case 'status_change':
      return (
        <>
          <span className="font-medium">{activity.postTitle}</span>
          {' '}movido para{' '}
          <span className="font-medium">{activity.content.replace('Status: ', '')}</span>
        </>
      );
    default:
      return (
        <>
          <span className="font-medium">{firstName}</span>
          {' '}{activity.content}{' '}
          <span className="font-medium">{activity.postTitle}</span>
        </>
      );
  }
}

function getActivityIcon(type: Activity['type']): string {
  switch (type) {
    case 'comment': return '💬';
    case 'approval': return '✅';
    case 'published': return '🚀';
    case 'status_change': return '🔄';
    default: return '📌';
  }
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card>
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────

export default function StrategistDashboardPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [allPosts, setAllPosts] = useState<CalendarPipelinePost[]>([]);

  // Fetch both in parallel on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const token = await getAuthToken();
        const [activitiesResult, postsResult] = await Promise.all([
          getRecentActivitiesForStrategist(token),
          getAllPipelinePostsForStrategist(token),
        ]);

        if (cancelled) return;

        if (activitiesResult.activities) {
          setActivities(activitiesResult.activities);
        }
        if (postsResult.posts) {
          setAllPosts(postsResult.posts);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        if (!cancelled) {
          toast({ variant: 'destructive', title: 'Erro ao carregar dashboard.' });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [toast]);

  // Current week days (Mon-Fri)
  const weekDays = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, []);

  // Group posts by day within current week
  const postsByWeekDay = useMemo(() => {
    const map = new Map<string, CalendarPipelinePost[]>();

    weekDays.forEach(day => {
      map.set(format(day, 'yyyy-MM-dd'), []);
    });

    allPosts.forEach(post => {
      if (!post.scheduledFor || post.status === 'arquivado') return;
      const postDay = post.scheduledFor.substring(0, 10);
      if (map.has(postDay)) {
        map.get(postDay)!.push(post);
      }
    });

    return map;
  }, [allPosts, weekDays]);


  const handlePostClick = (post: CalendarPipelinePost) => {
    router.push(`/post/${post.companySlug}/${post.tlSlug}/${post.id}`);
  };

  const handleActivityClick = (activity: Activity) => {
    router.push(`/post/${activity.companySlug}/${activity.tlSlug}/${activity.postId}`);
  };

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Top row: Activities (1/3) + Weekly Pipeline (2/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* ── Activities Feed (1/3) ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ActivityIcon className="h-4 w-4 text-muted-foreground" />
                    Atividades Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhuma atividade recente
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
                      {activities.map((activity, idx) => (
                        <button
                          key={`${activity.postId}-${activity.createdAt}-${idx}`}
                          type="button"
                          onClick={() => handleActivityClick(activity)}
                          className="w-full text-left flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors"
                        >
                          {/* Activity icon */}
                          <span className="text-sm shrink-0 mt-0.5">
                            {getActivityIcon(activity.type)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs leading-snug">
                              {getActivityDescription(activity)}
                            </p>
                            {activity.type === 'comment' && activity.content && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                {activity.content}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {getRelativeTime(activity.createdAt)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Weekly Pipeline (2/3) ── */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Pipeline Semanal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2">
                    {weekDays.map((day, idx) => {
                      const dayKey = format(day, 'yyyy-MM-dd');
                      const dayPosts = postsByWeekDay.get(dayKey) || [];
                      const isCurrentDay = isToday(day);

                      return (
                        <div key={dayKey} className="space-y-1.5">
                          {/* Day header */}
                          <div className={`text-center py-1.5 rounded-md text-xs font-medium ${
                            isCurrentDay
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground'
                          }`}>
                            {DAY_LABELS[idx]}
                            <div className="text-[10px] font-normal">
                              {format(day, 'dd/MM')}
                            </div>
                            {isCurrentDay && (
                              <div className="text-[9px] font-normal opacity-80">hoje</div>
                            )}
                          </div>

                          {/* Posts */}
                          <div className="space-y-1 min-h-[60px]">
                            {dayPosts.length === 0 && (
                              <div className="text-[10px] text-muted-foreground/40 text-center py-4">
                                —
                              </div>
                            )}
                            {dayPosts.slice(0, 4).map(post => (
                              <CalendarPostCard
                                key={`${post.tlUserId}-${post.id}`}
                                post={post}
                                statusConfig={getCardConfig(post.status)}
                                onClick={() => handlePostClick(post)}
                                showProfile
                              />
                            ))}
                            {dayPosts.length > 4 && (
                              <div className="text-[10px] text-muted-foreground text-center font-medium">
                                +{dayPosts.length - 4} mais
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>


          </>
        )}
      </main>
    </>
  );
}
