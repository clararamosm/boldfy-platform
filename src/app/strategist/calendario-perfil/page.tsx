// src/app/strategist/calendario-perfil/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { CalendarSkeleton } from '@/components/calendar/calendar-skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { getPipelinePosts, resolveSlugs, updatePipelinePost, deletePipelinePost, type PipelinePost, type PipelineStatus } from '@/app/actions/content-pipeline';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
} from 'lucide-react';
import { STATUS_CONFIG, PIPELINE_STATUSES } from '@/lib/pipeline-config';
import { CalendarPostCard, type CalendarCardConfig } from '@/components/calendar/calendar-post-card';
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell';
import { CalendarPreviewToggle, useCalendarMediaPreview } from '@/components/calendar/calendar-preview-toggle';
import { PostListTable } from '@/components/calendar/post-list-table';
import { getContentStrategy } from '@/app/actions/content-strategy';
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


const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function StrategistCalendarioPerfilPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companySlug = searchParams.get('c');
  const tlSlug = searchParams.get('tl');

  // Resolved Firestore IDs from slugs
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [tlId, setTlId] = useState<string | null>(null);
  const [tlName, setTlName] = useState('Perfil');

  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // Preview de mídia nos cards do calendário (toggle, persistido em localStorage)
  const [showMediaPreview, setShowMediaPreview] = useCalendarMediaPreview();
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | 'all'>('all');
  const [isCreating, setIsCreating] = useState(false);

  // Pillar color map: pillarName → colorKey
  const [pillarColorMap, setPillarColorMap] = useState<Record<string, string>>({});

  // ─── Drag & drop state ──────
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // ─── Resolve slugs to IDs ──────
  useEffect(() => {
    if (!companySlug || !tlSlug) return;
    const resolve = async () => {
      try {
        const token = await getAuthToken();
        const result = await resolveSlugs(token, companySlug, tlSlug);
        if (result.companyId) setCompanyId(result.companyId);
        if (result.tlId) setTlId(result.tlId);
        if (result.tlName) setTlName(result.tlName);
      } catch {
        // silent
      }
    };
    resolve();
  }, [companySlug, tlSlug]);

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

  // Fetch pillar colors from content strategy
  useEffect(() => {
    if (!tlId) return;
    const fetchPillarColors = async () => {
      try {
        const token = await getAuthToken();
        const result = await getContentStrategy(token, tlId);
        if (result.data?.pillars) {
          const map: Record<string, string> = {};
          result.data.pillars.forEach(p => {
            if (p.name && p.color) map[p.name] = p.color;
          });
          setPillarColorMap(map);
        }
      } catch {
        // silent — colors are a nice-to-have
      }
    };
    fetchPillarColors();
  }, [tlId]);

  // ─── Create post directly (no dialog) ──────
  const createPostDirect = useCallback(async () => {
    if (!tlId || isCreating) return;

    setIsCreating(true);
    try {
      const token = await getAuthToken();
      const { createPipelinePost } = await import('@/app/actions/content-pipeline');
      const result = await createPipelinePost(token, tlId, {
        title: '',
        caption: '',
        scheduledFor: null,
        status: 'backlog',
        editorial: '',
        etapa: '',
        formato: '',
        contentPillar: '',
        leadMagnet: false,
      });

      if (result.postId) {
        router.push(`/post/${companySlug}/${tlSlug}/${result.postId}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsCreating(false);
    }
  }, [tlId, companySlug, tlSlug, isCreating, router]);

  // ─── Posts with a placeable date ──────
  // Posts postados sem scheduledFor usam publishedAt como fallback de data no calendário
  const scheduledPosts = useMemo(() => {
    return posts.filter(p =>
      p.scheduledFor || (p.status === 'postado' && p.publishedAt)
    );
  }, [posts]);

  // ─── Apply status filter ──────
  const filteredPosts = useMemo(() => {
    if (statusFilter === 'all') return scheduledPosts;
    return scheduledPosts.filter(p => p.status === statusFilter);
  }, [scheduledPosts, statusFilter]);

  // ─── Posts grouped by day ──────
  // Posts postados sem scheduledFor usam publishedAt como fallback de data
  const postsByDay = useMemo(() => {
    const map = new Map<string, PipelinePost[]>();
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

  // ─── Navigate to dedicated post page ──────
  const handlePostClick = (post: PipelinePost) => {
    router.push(`/post/${companySlug}/${tlSlug}/${post.id}`);
  };

  // ─── Delete post ──────
  const handleDeletePost = async (postId: string) => {
    if (!tlId) return;
    // Optimistic removal
    setPosts(prev => prev.filter(p => p.id !== postId));
    try {
      const token = await getAuthToken();
      const result = await deletePipelinePost(token, tlId, postId);
      if (result.error) {
        toast({ title: 'Erro ao excluir', description: result.error, variant: 'destructive' });
        // Reload posts on error
        const reloadToken = await getAuthToken();
        const reload = await getPipelinePosts(reloadToken, tlId);
        if (reload.posts) setPosts(reload.posts);
      } else {
        toast({ title: 'Post excluído' });
      }
    } catch {
      toast({ title: 'Erro ao excluir', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  // ─── Status counts ──────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: scheduledPosts.length };
    scheduledPosts.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [scheduledPosts]);

  // ─── Status config helper ──────
  const getCardConfig = (status: string): CalendarCardConfig => {
    const cfg = STATUS_CONFIG[status as PipelineStatus] || STATUS_CONFIG.backlog;
    return { label: cfg.label, badge: cfg.badge, dot: cfg.dot };
  };

  // ─── Drag & Drop handlers ──────
  const handleDragStart = (post: PipelinePost, e: React.DragEvent) => {
    setDraggedPostId(post.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', post.id);
  };

  const handleDragEnd = () => {
    setDraggedPostId(null);
    setDragOverDay(null);
  };

  const handleDrop = async (dayKey: string) => {
    if (!draggedPostId || !tlId) return;

    const post = posts.find(p => p.id === draggedPostId);
    if (!post || !post.scheduledFor) return;

    // Keep the original time, change only the date
    const originalTime = post.scheduledFor.substring(10); // "T12:00:00..." part
    const newScheduledFor = dayKey + originalTime;

    if (newScheduledFor === post.scheduledFor) {
      handleDragEnd();
      return;
    }

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === draggedPostId
        ? { ...p, scheduledFor: newScheduledFor }
        : p
    ));

    handleDragEnd();

    try {
      const token = await getAuthToken();
      const result = await updatePipelinePost(token, tlId, post.id, {
        scheduledFor: newScheduledFor,
      });
      if (result.error) {
        // Revert
        setPosts(prev => prev.map(p =>
          p.id === post.id
            ? { ...p, scheduledFor: post.scheduledFor }
            : p
        ));
        toast({ variant: 'destructive', title: 'Erro ao mover post', description: result.error });
      } else {
        // Add bot comment about the reschedule
        const { addBotComment } = await import('@/app/actions/post-editor');
        const newDate = new Date(newScheduledFor);
        const dateStr = newDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const hh = String(newDate.getHours()).padStart(2, '0');
        const mm = String(newDate.getMinutes()).padStart(2, '0');
        const timeStr = `${hh}:${mm}` !== '00:00' ? ` às ${hh}:${mm}` : '';
        const userName = tlName?.split(' ')[0] || 'Thought Leader';
        const botMessage = `📅 ${userName} ajustou o conteúdo para ${dateStr}${timeStr}.`;
        addBotComment(token, tlId, post.id, botMessage).catch(() => {});
      }
    } catch {
      // Revert
      setPosts(prev => prev.map(p =>
        p.id === post.id
          ? { ...p, scheduledFor: post.scheduledFor }
          : p
      ));
      toast({ variant: 'destructive', title: 'Erro ao mover post' });
    }
  };

  if (!tlSlug) {
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
          <CalendarSkeleton cellHeight="h-40" showHeaderAction={false} />
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
      <Header title={`Calendário — ${tlName}`} />
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
            <div className="flex items-center gap-4">
              <CalendarPreviewToggle enabled={showMediaPreview} onChange={setShowMediaPreview} />
              <Button size="sm" onClick={createPostDirect} disabled={isCreating}>
                {isCreating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                Novo Post
              </Button>
            </div>
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

                return (
                  <CalendarDayCell
                    key={idx}
                    day={day}
                    inMonth={isSameMonth(day, currentMonth)}
                    isToday={isToday(day)}
                    droppable={!!draggedPostId}
                    isDragOver={dragOverDay === dayKey}
                    onDragOver={() => setDragOverDay(dayKey)}
                    onDragLeave={() => { if (dragOverDay === dayKey) setDragOverDay(null); }}
                    onDrop={() => handleDrop(dayKey)}
                  >
                    {dayPosts.slice(0, 3).map(post => (
                      <CalendarPostCard
                        key={post.id}
                        post={{
                          ...post,
                          title: post.title || 'Sem título',
                          tlUserId: tlId || undefined,
                          tlName,
                        }}
                        showMediaPreview={showMediaPreview}
                        statusConfig={getCardConfig(post.status)}
                        onClick={() => handlePostClick(post)}
                        showProfile={false}
                        draggable
                        onDragStart={(e) => handleDragStart(post, e)}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedPostId === post.id}
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

        {/* Post list table — all posts for this TL */}
        <PostListTable
          posts={posts.map(p => ({
            ...p,
            contentPillar: p.contentPillar || '',
            formato: p.formato || '',
          }))}
          getStatusLabel={(status) => STATUS_CONFIG[status]?.label || status}
          onPostClick={(postId) => {
            const post = posts.find(p => p.id === postId);
            if (post) handlePostClick(post);
          }}
          onDeletePost={handleDeletePost}
        />

      </main>
    </>
  );
}
