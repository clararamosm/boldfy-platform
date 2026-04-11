// src/app/strategist/calendario/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { getAllPipelinePostsForStrategist, type CalendarPipelinePost, type PipelineStatus } from '@/app/actions/content-pipeline';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Edit3,
  FileText,
  User,
  Building2,
  AlertTriangle,
  Archive,
  CircleDot,
  Send,
  ThumbsUp,
} from 'lucide-react';
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

// ─── Status config ──────
const pipelineStatusConfig: Record<PipelineStatus, {
  label: string;
  color: string;
  calendarBg: string;
  calendarText: string;
  dotColor: string;
  icon: typeof Clock;
}> = {
  backlog: {
    label: 'Backlog',
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    calendarBg: 'bg-gray-50 dark:bg-gray-800/50',
    calendarText: 'text-gray-600 dark:text-gray-400',
    dotColor: 'bg-gray-400',
    icon: FileText,
  },
  aprovar_ideia: {
    label: 'Aprovar Ideia',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    calendarBg: 'bg-amber-50 dark:bg-amber-900/20',
    calendarText: 'text-amber-700 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    icon: CircleDot,
  },
  em_producao: {
    label: 'Em Produção',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    calendarBg: 'bg-blue-50 dark:bg-blue-900/20',
    calendarText: 'text-blue-700 dark:text-blue-400',
    dotColor: 'bg-blue-500',
    icon: Edit3,
  },
  aprovar_post: {
    label: 'Aprovar Post',
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    calendarBg: 'bg-orange-50 dark:bg-orange-900/20',
    calendarText: 'text-orange-700 dark:text-orange-400',
    dotColor: 'bg-orange-500',
    icon: ThumbsUp,
  },
  post_aprovado: {
    label: 'Aprovado',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    calendarBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    calendarText: 'text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  pronto_pra_postar: {
    label: 'Pronto',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    calendarBg: 'bg-green-50 dark:bg-green-900/20',
    calendarText: 'text-green-700 dark:text-green-400',
    dotColor: 'bg-green-600',
    icon: Send,
  },
  postado: {
    label: 'Postado',
    color: 'bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20',
    calendarBg: 'bg-[#0A66C2]/5 dark:bg-[#0A66C2]/10',
    calendarText: 'text-[#0A66C2]',
    dotColor: 'bg-[#0A66C2]',
    icon: CheckCircle2,
  },
  ajuste: {
    label: 'Ajuste',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    calendarBg: 'bg-red-50 dark:bg-red-900/20',
    calendarText: 'text-red-700 dark:text-red-400',
    dotColor: 'bg-red-500',
    icon: AlertTriangle,
  },
  arquivado: {
    label: 'Arquivado',
    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
    calendarBg: 'bg-gray-50/50 dark:bg-gray-800/30',
    calendarText: 'text-gray-400',
    dotColor: 'bg-gray-300',
    icon: Archive,
  },
};

// ─── Skeleton ──────
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
          <Skeleton key={`d-${i}`} className="h-28" />
        ))}
      </div>
    </div>
  );
}

type StatusFilter = PipelineStatus | 'all';

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function StrategistCalendarioPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCompanyId = searchParams.get('companyId');
  const urlTlId = searchParams.get('tlId');

  const [isLoading, setIsLoading] = useState(true);
  const [allPosts, setAllPosts] = useState<CalendarPipelinePost[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [companyFilter, setCompanyFilter] = useState<string>(urlCompanyId || 'all');
  const [tlFilter, setTlFilter] = useState<string>(urlTlId || 'all');

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
      toast({ variant: 'destructive', title: 'Erro ao carregar calendário.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Apply URL params on mount ──────
  useEffect(() => {
    if (urlCompanyId) setCompanyFilter(urlCompanyId);
    if (urlTlId) setTlFilter(urlTlId);
  }, [urlCompanyId, urlTlId]);

  // ─── Derive companies and TLs for filters ──────
  const { companies, tls } = useMemo(() => {
    const compMap = new Map<string, string>();
    const tlMap = new Map<string, { name: string; companyId: string }>();

    allPosts.forEach(p => {
      if (!compMap.has(p.companyId)) compMap.set(p.companyId, p.companyName);
      if (!tlMap.has(p.tlUserId)) tlMap.set(p.tlUserId, { name: p.tlName, companyId: p.companyId });
    });

    const companies = Array.from(compMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const tls = Array.from(tlMap.entries())
      .map(([id, info]) => ({ id, name: info.name, companyId: info.companyId }))
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

  // ─── Only posts with scheduledFor ──────
  const scheduledPosts = useMemo(() => {
    return allPosts.filter(p => p.scheduledFor);
  }, [allPosts]);

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
      const dayKey = post.scheduledFor.substring(0, 10); // yyyy-MM-dd
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

  // ─── Navigate to pipeline ──────
  const handlePostClick = (post: CalendarPipelinePost) => {
    router.push(`/strategist/pipeline?companyId=${post.companyId}&tlId=${post.tlUserId}`);
  };

  if (isLoading) {
    return (
      <>
        <Header title="Calendário" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <CalendarSkeleton />
        </main>
      </>
    );
  }

  // ─── Status filter buttons config ──────
  const statusFilterButtons: { key: StatusFilter; label: string; color: string }[] = [
    { key: 'all', label: 'Todos', color: 'bg-muted text-foreground' },
    { key: 'backlog', label: 'Backlog', color: pipelineStatusConfig.backlog.color },
    { key: 'aprovar_ideia', label: 'Aprovar Ideia', color: pipelineStatusConfig.aprovar_ideia.color },
    { key: 'em_producao', label: 'Em Produção', color: pipelineStatusConfig.em_producao.color },
    { key: 'aprovar_post', label: 'Aprovar Post', color: pipelineStatusConfig.aprovar_post.color },
    { key: 'post_aprovado', label: 'Aprovado', color: pipelineStatusConfig.post_aprovado.color },
    { key: 'pronto_pra_postar', label: 'Pronto', color: pipelineStatusConfig.pronto_pra_postar.color },
    { key: 'postado', label: 'Postado', color: pipelineStatusConfig.postado.color },
    { key: 'ajuste', label: 'Ajuste', color: pipelineStatusConfig.ajuste.color },
  ];

  return (
    <>
      <Header title="Calendário" />
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

          {/* Calendar grid — FULL WIDTH */}
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
                      min-h-[120px] p-1.5 border-b border-r text-left
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

                    {/* Post mini-cards */}
                    <div className="mt-1 space-y-0.5">
                      {dayPosts.slice(0, 4).map(post => {
                        const cfg = pipelineStatusConfig[post.status] || pipelineStatusConfig.backlog;
                        const time = post.scheduledFor ? format(parseISO(post.scheduledFor), 'HH:mm') : '';
                        const showTime = time && time !== '00:00';
                        const firstName = post.tlName.split(' ')[0];

                        return (
                          <button
                            key={`${post.tlUserId}-${post.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePostClick(post);
                            }}
                            className={`
                              w-full text-left rounded px-1.5 py-0.5 transition-all
                              hover:ring-1 hover:ring-primary/40 hover:shadow-sm cursor-pointer
                              ${cfg.calendarBg}
                            `}
                            title={`${post.title || 'Sem título'} — ${firstName} · ${post.companyName} — ${cfg.label}`}
                          >
                            <div className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dotColor}`} />
                              <span className={`text-[10px] font-medium truncate ${cfg.calendarText}`}>
                                {post.title || 'Sem título'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground pl-2.5">
                              {showTime && <span>{time}</span>}
                              {showTime && <span>·</span>}
                              <span className="truncate">{firstName}</span>
                              <span>·</span>
                              <span className="truncate">{post.companyName}</span>
                            </div>
                          </button>
                        );
                      })}
                      {dayPosts.length > 4 && (
                        <div className="text-[10px] text-muted-foreground px-1 font-medium">
                          +{dayPosts.length - 4} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
