'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS_CONFIG, PIPELINE_STATUSES } from '@/lib/pipeline-config';
import { CalendarPostCard, type CalendarCardConfig } from '@/components/calendar/calendar-post-card';
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell';
import type { CalendarPipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';
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

/**
 * Calendário mensal reutilizável de posts do pipeline.
 * Usado no Backlog (visão geral da equipe) e na página de Calendário por líder.
 * Recebe os posts já no escopo desejado (todos ou de um único TL) e cuida de
 * filtrar arquivados/sem data, navegação de mês e filtro de status.
 */
export function TeamCalendar({
  posts,
  isProfileView = false,
  heading,
}: {
  posts: CalendarPipelinePost[];
  isProfileView?: boolean;
  heading?: string;
}) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Ativos (sem arquivados)
  const activePosts = useMemo(
    () => posts.filter(p => p.status !== 'arquivado'),
    [posts]
  );

  // Só posts com data plotável
  const scheduledPosts = useMemo(
    () => activePosts.filter(p => p.scheduledFor || (p.status === 'postado' && p.publishedAt)),
    [activePosts]
  );

  const filteredPosts = useMemo(() => {
    if (statusFilter === 'all') return scheduledPosts;
    return scheduledPosts.filter(p => p.status === statusFilter);
  }, [scheduledPosts, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scheduledPosts.length };
    scheduledPosts.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [scheduledPosts]);

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

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const handlePostClick = (post: CalendarPipelinePost) => {
    router.push(`/post/${post.companySlug}/${post.tlSlug}/${post.id}`);
  };

  const getCardConfig = (status: string): CalendarCardConfig => {
    const cfg = STATUS_CONFIG[status as PipelineStatus] || STATUS_CONFIG.backlog;
    return { label: cfg.label, badge: cfg.badge, dot: cfg.dot };
  };

  const statusFilterButtons: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Todos', color: 'bg-muted text-foreground' },
    ...PIPELINE_STATUSES
      .filter(s => s !== 'arquivado')
      .map(s => ({ key: s as StatusFilter, label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].badge })),
  ];

  return (
    <div className="space-y-3">
      {/* Month navigation + optional heading */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {heading && <span className="text-sm font-medium mr-2">{heading}</span>}
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-base font-semibold capitalize min-w-[150px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Status filter chips */}
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
  );
}
