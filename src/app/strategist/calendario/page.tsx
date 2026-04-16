// src/app/strategist/calendario/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { CalendarSkeleton } from '@/components/calendar/calendar-skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import {
  getAllPipelinePostsForStrategist,
  updatePipelinePost,
  deletePipelinePost,
  type CalendarPipelinePost,
  type PipelineStatus,
} from '@/app/actions/content-pipeline';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Building2,
} from 'lucide-react';
import { STATUS_CONFIG, PIPELINE_STATUSES } from '@/lib/pipeline-config';
import { LinkedInBadge } from '@/components/ui/linkedin-badge';
import { CalendarPostCard, type CalendarCardPost, type CalendarCardConfig } from '@/components/calendar/calendar-post-card';
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell';
import { PostListTable } from '@/components/calendar/post-list-table';
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

export default function StrategistCalendarioPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCompanySlug = searchParams.get('c');
  const urlTlSlug = searchParams.get('tl');

  const [isLoading, setIsLoading] = useState(true);
  const [allPosts, setAllPosts] = useState<CalendarPipelinePost[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [tlFilter, setTlFilter] = useState<string>('all');

  // Tab state
  const [activeTab, setActiveTab] = useState<'em_producao' | 'postados'>('em_producao');

  // Pagination state
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Drag & drop state ──────
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [draggedTlUserId, setDraggedTlUserId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // ─── Fetch all pipeline posts ──────
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const result = await getAllPipelinePostsForStrategist(token);
      if (result.posts) {
        setAllPosts(result.posts);
      } else if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (err) {
      console.error('Calendar fetch error:', err);
      toast({ variant: 'destructive', title: 'Erro ao carregar calendario.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Apply URL slug params after posts are loaded ──────
  useEffect(() => {
    if (allPosts.length === 0) return;
    if (urlCompanySlug) {
      const matchedPost = allPosts.find(p => p.companySlug === urlCompanySlug);
      if (matchedPost) {
        setCompanyFilter(matchedPost.companyId);
        if (urlTlSlug) {
          const matchedTl = allPosts.find(p => p.tlSlug === urlTlSlug && p.companyId === matchedPost.companyId);
          if (matchedTl) setTlFilter(matchedTl.tlUserId);
        }
      }
    }
  }, [allPosts, urlCompanySlug, urlTlSlug]);

  // ─── Derive companies and TLs for filters ──────
  const { companies, tls } = useMemo(() => {
    const compMap = new Map<string, string>();
    const tlMap = new Map<string, { name: string; companyId: string; photoUrl?: string; linkedinConnected?: boolean }>();

    allPosts.forEach(p => {
      if (!compMap.has(p.companyId)) compMap.set(p.companyId, p.companyName);
      if (!tlMap.has(p.tlUserId)) tlMap.set(p.tlUserId, {
        name: p.tlName,
        companyId: p.companyId,
        photoUrl: p.tlPhotoUrl,
        linkedinConnected: p.tlLinkedinConnected,
      });
    });

    const companies = Array.from(compMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const tls = Array.from(tlMap.entries())
      .map(([id, info]) => ({ id, name: info.name, companyId: info.companyId, photoUrl: info.photoUrl, linkedinConnected: info.linkedinConnected }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { companies, tls };
  }, [allPosts]);

  // Filter TLs based on company selection
  const filteredTlOptions = useMemo(() => {
    if (companyFilter === 'all') return tls;
    return tls.filter(tl => tl.companyId === companyFilter);
  }, [tls, companyFilter]);

  // Reset TL filter when company changes and TL no longer in filtered list
  useEffect(() => {
    if (tlFilter !== 'all' && companyFilter !== 'all') {
      const tlInCompany = filteredTlOptions.some(tl => tl.id === tlFilter);
      if (!tlInCompany) setTlFilter('all');
    }
  }, [companyFilter, filteredTlOptions, tlFilter]);

  // ─── Posts by tab ──────
  const emProducaoPosts = useMemo(() =>
    allPosts.filter(p => p.status !== 'postado' && p.status !== 'arquivado'),
    [allPosts]
  );
  const postadosPosts = useMemo(() =>
    allPosts.filter(p => p.status === 'postado'),
    [allPosts]
  );
  const activeTabPosts = activeTab === 'em_producao' ? emProducaoPosts : postadosPosts;

  // ─── Only posts with scheduledFor ──────
  const scheduledPosts = useMemo(() => {
    return activeTabPosts.filter(p => p.scheduledFor);
  }, [activeTabPosts]);

  // ─── Apply filters ──────
  const filteredPosts = useMemo(() => {
    let filtered = scheduledPosts;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }
    if (companyFilter !== 'all') {
      filtered = filtered.filter(p => p.companyId === companyFilter);
    }
    if (tlFilter !== 'all') {
      filtered = filtered.filter(p => p.tlUserId === tlFilter);
    }

    return filtered;
  }, [scheduledPosts, statusFilter, companyFilter, tlFilter]);

  // ─── Status counts ──────
  const statusCounts = useMemo(() => {
    const base = companyFilter === 'all' && tlFilter === 'all'
      ? scheduledPosts
      : scheduledPosts.filter(p => {
          if (companyFilter !== 'all' && p.companyId !== companyFilter) return false;
          if (tlFilter !== 'all' && p.tlUserId !== tlFilter) return false;
          return true;
        });

    const counts: Record<string, number> = { all: base.length };
    base.forEach(p => {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    return counts;
  }, [scheduledPosts, companyFilter, tlFilter]);

  // ─── Posts grouped by day ──────
  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPipelinePost[]>();
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

  // ─── Navigate to post editor ──────
  const handlePostClick = (post: CalendarPipelinePost) => {
    router.push(`/post/${post.companySlug}/${post.tlSlug}/${post.id}`);
  };

  // ─── Delete post ──────
  const handleDeletePost = async (postId: string) => {
    const post = allPosts.find(p => p.id === postId);
    if (!post) return;
    // Optimistic removal
    setAllPosts(prev => prev.filter(p => p.id !== postId));
    try {
      const token = await getAuthToken();
      const result = await deletePipelinePost(token, post.tlUserId, postId);
      if (result.error) {
        toast({ title: 'Erro ao excluir', description: result.error, variant: 'destructive' });
        // Reload all posts on error
        const reloadToken = await getAuthToken();
        const reload = await getAllPipelinePostsForStrategist(reloadToken);
        if (reload.posts) setAllPosts(reload.posts);
      } else {
        toast({ title: 'Post excluído' });
      }
    } catch {
      toast({ title: 'Erro ao excluir', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  // ─── Drag & drop handlers ──────
  const handleDragStart = (post: CalendarPipelinePost, e: React.DragEvent) => {
    setDraggedPostId(post.id);
    setDraggedTlUserId(post.tlUserId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', post.id);
  };

  const handleDragEnd = () => {
    setDraggedPostId(null);
    setDraggedTlUserId(null);
    setDragOverDay(null);
  };

  const handleDrop = async (dayKey: string) => {
    if (!draggedPostId || !draggedTlUserId) return;

    const post = allPosts.find(p => p.id === draggedPostId && p.tlUserId === draggedTlUserId);
    if (!post || !post.scheduledFor) return;

    // Keep the original time, change only the date
    const originalTime = post.scheduledFor.substring(10); // "T12:00:00..." part
    const newScheduledFor = dayKey + originalTime;

    if (newScheduledFor === post.scheduledFor) {
      handleDragEnd();
      return;
    }

    // Optimistic update
    setAllPosts(prev => prev.map(p =>
      p.id === draggedPostId && p.tlUserId === draggedTlUserId
        ? { ...p, scheduledFor: newScheduledFor }
        : p
    ));

    handleDragEnd();

    try {
      const token = await getAuthToken();
      const result = await updatePipelinePost(token, post.tlUserId, post.id, {
        scheduledFor: newScheduledFor,
      });
      if (result.error) {
        // Revert
        setAllPosts(prev => prev.map(p =>
          p.id === post.id && p.tlUserId === post.tlUserId
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
        const userName = post.tlName?.split(' ')[0] || 'Thought Leader';
        const botMessage = `📅 ${userName} ajustou o conteúdo para ${dateStr}${timeStr}.`;
        addBotComment(token, post.tlUserId, post.id, botMessage).catch(() => {});
      }
    } catch {
      // Revert
      setAllPosts(prev => prev.map(p =>
        p.id === post.id && p.tlUserId === post.tlUserId
          ? { ...p, scheduledFor: post.scheduledFor }
          : p
      ));
      toast({ variant: 'destructive', title: 'Erro ao mover post' });
    }
  };

  // ─── Config adapter ──────
  const getCardConfig = (status: string): CalendarCardConfig => {
    const cfg = STATUS_CONFIG[status as PipelineStatus] || STATUS_CONFIG.backlog;
    return { label: cfg.label, badge: cfg.badge, dot: cfg.dot };
  };

  if (isLoading) {
    return (
      <>
        <Header title="Calendario" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <CalendarSkeleton cellHeight="h-36" />
        </main>
      </>
    );
  }

  // ─── Status filter buttons ──────
  const statusFilterButtons: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Todos', color: 'bg-muted text-foreground' },
    ...PIPELINE_STATUSES
      .filter(s => s !== 'arquivado')
      .map(s => ({ key: s as StatusFilter, label: STATUS_CONFIG[s].label, color: STATUS_CONFIG[s].badge })),
  ];

  const isProfileView = tlFilter !== 'all';

  return (
    <>
      <Header title="Calendario" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-4">
          {/* Month navigation + filters */}
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

            {/* Company + TL dropdowns */}
            <div className="flex items-center gap-2">
              {companies.length > 1 && (
                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger className="w-[180px] h-9">
                    <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Empresas</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filteredTlOptions.length > 1 && (
                <Select value={tlFilter} onValueChange={setTlFilter}>
                  <SelectTrigger className="w-[170px] h-9">
                    <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Perfis</SelectItem>
                    {filteredTlOptions.map(tl => (
                      <SelectItem key={tl.id} value={tl.id}>{tl.name.split(' ').slice(0, 2).join(' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Tabs: Em produção / Já postados */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'em_producao' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActiveTab('em_producao'); setStatusFilter('all'); setCurrentPage(1); }}
            >
              Em produção ({emProducaoPosts.length})
            </Button>
            <Button
              variant={activeTab === 'postados' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setActiveTab('postados'); setStatusFilter('all'); setCurrentPage(1); }}
            >
              Já postados ({postadosPosts.length})
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
                  onClick={() => { setStatusFilter(f.key); setCurrentPage(1); }}
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
                        key={`${post.tlUserId}-${post.id}`}
                        post={post}
                        statusConfig={getCardConfig(post.status)}
                        onClick={() => handlePostClick(post)}
                        showProfile={!isProfileView}
                        draggable
                        onDragStart={(e) => handleDragStart(post, e)}
                        onDragEnd={handleDragEnd}
                        isDragging={draggedPostId === post.id && draggedTlUserId === post.tlUserId}
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

          {/* Post list table — filtered by tab + company + pagination */}
          {(() => {
            const tablePosts = activeTabPosts
              .filter(p => {
                if (companyFilter !== 'all' && p.companyId !== companyFilter) return false;
                if (tlFilter !== 'all' && p.tlUserId !== tlFilter) return false;
                return true;
              })
              .map(p => ({ ...p, _tlId: p.tlUserId }));
            const start = (currentPage - 1) * pageSize;
            const paginatedPosts = tablePosts.slice(start, start + pageSize);
            const totalPgs = Math.max(1, Math.ceil(tablePosts.length / pageSize));

            return (
              <>
                <PostListTable
                  posts={paginatedPosts}
                  tlProfiles={filteredTlOptions.map(tl => ({ id: tl.id, name: tl.name }))}
                  getStatusLabel={(status) => STATUS_CONFIG[status]?.label || status}
                  onPostClick={(postId) => {
                    const post = allPosts.find(p => p.id === postId);
                    if (post) handlePostClick(post);
                  }}
                  onDeletePost={handleDeletePost}
                />

                {/* Pagination controls */}
                {tablePosts.length > 20 && (
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Por página:</span>
                      {[20, 50, 100].map(size => (
                        <Button
                          key={size}
                          variant={pageSize === size ? 'default' : 'ghost'}
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => { setPageSize(size); setCurrentPage(1); }}
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage(p => p - 1)}
                      >
                        Anterior
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        {currentPage} de {totalPgs}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7"
                        disabled={currentPage >= totalPgs}
                        onClick={() => setCurrentPage(p => p + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

        </div>
      </main>
    </>
  );
}
