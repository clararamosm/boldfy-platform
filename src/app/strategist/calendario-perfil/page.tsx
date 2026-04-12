// src/app/strategist/calendario-perfil/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { getPipelinePosts, type PipelinePost, type PipelineStatus } from '@/app/actions/content-pipeline';
import { PipelineCreateDialog } from '@/components/pipeline/create-dialog';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
} from 'lucide-react';
import { STATUS_CONFIG, PIPELINE_STATUSES } from '@/lib/pipeline-config';
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
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';


function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-8" />
        ))}
        {[...Array(35)].map((_, i) => (
          <Skeleton key={`d-${i}`} className="h-40" />
        ))}
      </div>
    </div>
  );
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function StrategistCalendarioPerfilPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get('companyId');
  const tlId = searchParams.get('tlId');
  const tlName = searchParams.get('tlName') || 'Perfil';

  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  // ─── Fetch posts for this TL ──────
  const fetchData = useCallback(async () => {
    if (!tlId) return;
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const result = await getPipelinePosts(token, tlId, null);
      if (result.posts) {
        setPosts(result.posts);
      } else if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err) {
      console.error('Calendar profile fetch error:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar calendário.' });
    } finally {
      setIsLoading(false);
    }
  }, [tlId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Only posts with scheduledFor ──────
  const scheduledPosts = useMemo(() => {
    return posts.filter(p => p.scheduledFor);
  }, [posts]);

  // ─── Apply status filter ──────
  const filteredPosts = useMemo(() => {
    if (statusFilter === 'all') return scheduledPosts;
    return scheduledPosts.filter(p => p.status === statusFilter);
  }, [scheduledPosts, statusFilter]);

  // ─── Posts grouped by day ──────
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

  // ─── Calendar days ──────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // ─── Navigate to dedicated post page ──────
  const handlePostClick = (post: PipelinePost) => {
    router.push(`/post/${companyId}/${tlId}/${post.id}`);
  };

  // ─── Status counts ──────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scheduledPosts.length };
    scheduledPosts.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [scheduledPosts]);

  if (!tlId) {
    return (
      <>
        <Header title="Calendário" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <p className="text-muted-foreground">Nenhum perfil selecionado.</p>
        </main>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <Header title={`Calendário — ${tlName}`} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <CalendarSkeleton />
        </main>
      </>
    );
  }

  const statusFilterButtons: { key: PipelineStatus | 'all'; label: string; color: string }[] = [
    { key: 'all', label: 'Todos', color: 'bg-muted text-foreground' },
    ...PIPELINE_STATUSES
      .filter(s => s !== 'arquivado')
      .map(s => ({ key: s as PipelineStatus | 'all', label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].badge })),
  ];

  return (
    <>
      <Header title={`Calendário — ${decodeURIComponent(tlName)}`} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-4">
          {/* Month navigation + New Post */}
          <div className="flex items-center justify-between">
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
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Post
            </Button>
          </div>

          {/* Status filters */}
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
            {/* Header row */}
            <div className="grid grid-cols-7 bg-muted/50">
              {WEEK_DAYS.map(day => (
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

                return (
                  <div
                    key={idx}
                    className={`
                      min-h-[150px] p-1.5 border-b border-r text-left
                      ${!inMonth ? 'bg-muted/10' : ''}
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

                    {/* Post cards — detailed for profile view */}
                    <div className="mt-1 space-y-1">
                      {dayPosts.slice(0, 3).map(post => {
                        const cfg = STATUS_CONFIG[post.status] || STATUS_CONFIG.backlog;
                        const time = post.scheduledFor ? format(parseISO(post.scheduledFor), 'HH:mm') : '';
                        const showTime = time && time !== '00:00';

                        return (
                          <button
                            key={post.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePostClick(post);
                            }}
                            className="w-full text-left rounded-md border bg-card p-1.5 transition-all hover:ring-1 hover:ring-primary/40 hover:shadow-sm cursor-pointer space-y-1"
                            title={post.title || 'Sem título'}
                          >
                            {/* Title + status dot */}
                            <div className="flex items-start gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 mt-[5px] ${cfg.dot}`} />
                              <span className="text-[11px] font-medium leading-tight line-clamp-2 text-foreground">
                                {post.title || 'Sem título'}
                              </span>
                            </div>

                            {/* Tags: status + formato + etapa + pilar */}
                            <div className="flex flex-wrap gap-0.5 pl-2.5">
                              <span className={`inline-flex items-center px-1.5 py-px rounded text-[8px] font-semibold ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                              {post.formato && (
                                <span className="inline-flex items-center px-1.5 py-px rounded text-[8px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                  {post.formato}
                                </span>
                              )}
                              {post.etapa && (
                                <span className="inline-flex items-center px-1.5 py-px rounded text-[8px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                  {post.etapa}
                                </span>
                              )}
                              {post.contentPillar && (
                                <span className="inline-flex items-center px-1.5 py-px rounded text-[8px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                  {post.contentPillar}
                                </span>
                              )}
                              {post.leadMagnet && (
                                <span className="inline-flex items-center px-1.5 py-px rounded text-[8px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                  Lead
                                </span>
                              )}
                            </div>

                            {/* Time row */}
                            {showTime && (
                              <div className="flex items-center gap-1 text-[9px] text-muted-foreground pl-2.5">
                                <Clock className="h-2.5 w-2.5" />
                                <span>{time}</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1 font-medium">
                          +{dayPosts.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Create Post Dialog */}
        <PipelineCreateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          companyId={companyId}
          defaultTlId={tlId}
          tlOptions={tlId ? [{ id: tlId, name: decodeURIComponent(tlName) }] : []}
          showTlSelector={false}
          initialStatus="backlog"
          onCreated={fetchData}
          labels={{ statusLabel: (s: PipelineStatus) => STATUS_CONFIG[s]?.label || s }}
        />
      </main>
    </>
  );
}
