'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Button } from '@/components/ui/button';
import { CalendarSkeleton } from '@/components/calendar/calendar-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { useAuth } from '@/contexts/auth-context';
import {
  getAllPipelinePostsForAdmin,
  type CalendarPipelinePost,
  type PipelineStatus,
} from '@/app/actions/content-pipeline';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { STATUS_CONFIG, PIPELINE_STATUSES } from '@/lib/pipeline-config';
import { CalendarPostCard, type CalendarCardConfig } from '@/components/calendar/calendar-post-card';
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

type StatusFilter = PipelineStatus | 'all';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function AdminCalendarioPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTlSlug = searchParams.get('tl');

  const [isLoading, setIsLoading] = useState(true);
  const [allPosts, setAllPosts] = useState<CalendarPipelinePost[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ─── Fetch all pipeline posts for the admin's company ──────
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

  // ─── Profile name (when ?tl= present) ──────
  const profileName = useMemo(() => {
    if (!urlTlSlug) return null;
    const match = allPosts.find(p => p.tlSlug === urlTlSlug);
    return match?.tlName ?? null;
  }, [urlTlSlug, allPosts]);

  const isProfileView = !!urlTlSlug;

  // ─── Posts scoped to the selected TL (or all) ──────
  const scopedPosts = useMemo(() => {
    if (!urlTlSlug) return allPosts;
    return allPosts.filter(p => p.tlSlug === urlTlSlug);
  }, [allPosts, urlTlSlug]);

  // ─── Todos os posts exceto arquivados ──────
  const activePosts = useMemo(
    () => scopedPosts.filter(p => p.status !== 'arquivado'),
    [scopedPosts]
  );

  // ─── Only posts with a placeable date ──────
  const scheduledPosts = useMemo(
    () => activePosts.filter(p => p.scheduledFor || (p.status === 'postado' && p.publishedAt)),
    [activePosts]
  );

  // ─── Apply status filter ──────
  const filteredPosts = useMemo(() => {
    if (statusFilter === 'all') return scheduledPosts;
    return scheduledPosts.filter(p => p.status === statusFilter);
  }, [scheduledPosts, statusFilter]);

  // ─── Status counts ──────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: activePosts.length };
    activePosts.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [activePosts]);

  // ─── Posts grouped by day ──────
  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPipelinePost[]>();
    filteredPosts.forEach(post => {
      const dateRef = post.scheduledFor || (post.status === 'postado' ? post.publishedAt ?? null : null);
      if (!dateRef) return;
      const dayKey = dateRef.substring(0, 10);
      const existing = map.get(dayKey) || [];
      existing.push(post);
      map.set(dayKey, existing);
    });
    return map;
  }, [filteredPosts]);

  // ─── Calendar days ──────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // ─── Navigate to shared post editor ──────
  const handlePostClick = (post: CalendarPipelinePost) => {
    router.push(`/post/${post.companySlug}/${post.tlSlug}/${post.id}`);
  };

  // ─── Config adapter ──────
  const getCardConfig = (status: string): CalendarCardConfig => {
    const cfg = STATUS_CONFIG[status as PipelineStatus] || STATUS_CONFIG.backlog;
    return { label: cfg.label, badge: cfg.badge, dot: cfg.dot };
  };

  const title = profileName ? `Calendário — ${profileName}` : 'Calendário';

  if (isLoading) {
    return (
      <>
        <Header title={title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <CalendarSkeleton cellHeight="h-36" />
        </main>
      </>
    );
  }

  const statusFilterButtons: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Todos', color: 'bg-muted text-foreground' },
    ...PIPELINE_STATUSES
      .filter(s => s !== 'arquivado')
      .map(s => ({ key: s as StatusFilter, label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].badge })),
  ];

  return (
    <>
      <Header title={title} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-4">
          {/* Month navigation + status filter dropdown */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-xl font-semibold capitalize min-w-[180px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {isProfileView && (
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[180px] h-9">
                  <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterButtons.map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Status filters (chips) */}
          <div className="flex flex-wrap items-center gap-2">
            {statusFilterButtons.map(f => {
              const count = statusCounts[f.key] || 0;
              if (f.key !== 'all' && count === 0) return null;
              return (
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
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Calendar grid */}
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-muted/50">
              {WEEK_DAYS.map(day => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const dayPosts = postsByDay.get(dayKey) || [];

                return (
                  <CalendarDayCell
                    key={idx}
                    day={day}
                    inMonth={isSameMonth(day, currentMonth)}
                    isToday={isToday(day)}
                  >
                    {dayPosts.slice(0, 3).map(post => (
                      <CalendarPostCard
                        key={`${post.tlUserId}-${post.id}`}
                        post={post}
                        statusConfig={getCardConfig(post.status)}
                        onClick={() => handlePostClick(post)}
                        showProfile={!isProfileView}
                      />
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1 font-medium">
                        +{dayPosts.length - 3} mais
                      </div>
                    )}
                  </CalendarDayCell>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
