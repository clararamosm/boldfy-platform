// src/app/colaborador/calendario/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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
import { ptBR } from 'date-fns/locale';

const statusConfig = {
  scheduled: { label: 'Agendado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  published: { label: 'Publicado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  draft: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400', icon: Edit3 },
};

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

type StatusFilter = 'all' | 'scheduled' | 'published' | 'draft' | 'failed';

export default function CalendarioPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { toast } = useToast();
  const router = useRouter();

  // Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }
      setUserId(firebaseUser.uid);
    });
    return () => unsubscribe();
  }, [router]);

  // Fetch posts
  const fetchPosts = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const token = await getAuthToken();
    const result = await getScheduledPosts(token, userId);
    if (result.posts) {
      setPosts(result.posts);
    } else if (result.error) {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
    setIsLoading(false);
  }, [userId, toast]);

  useEffect(() => {
    if (userId) fetchPosts();
  }, [userId, fetchPosts]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { all: posts.length, scheduled: 0, published: 0, draft: 0, failed: 0 };
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
      toast({ title: 'Post removido.' });
    } else {
      toast({ variant: 'destructive', title: 'Erro', description: result.error });
    }
  };

  const handleNewPost = (date?: Date) => {
    const params = new URLSearchParams();
    if (date) {
      params.set('date', date.toISOString());
    }
    router.push(`/colaborador/calendario/novo?${params.toString()}`);
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  if (isLoading && !userId) {
    return (
      <>
        <Header title="Calendário" />
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
                  {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <Button onClick={() => handleNewPost()} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Post
              </Button>
            </div>

            {/* Status filters */}
            <div className="flex flex-wrap items-center gap-2">
              {([
                { key: 'all' as StatusFilter, label: 'Todos', color: 'bg-muted text-foreground' },
                { key: 'scheduled' as StatusFilter, label: 'Agendados', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                { key: 'published' as StatusFilter, label: 'Publicados', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                { key: 'draft' as StatusFilter, label: 'Rascunhos', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
                { key: 'failed' as StatusFilter, label: 'Falhou', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
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
                            +{dayPosts.length - 2} mais
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
                  ? format(selectedDay, "d 'de' MMMM", { locale: ptBR })
                  : 'Selecione um dia'}
              </h3>
              {selectedDay && (
                <Button size="sm" variant="outline" onClick={() => handleNewPost(selectedDay)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Agendar
                </Button>
              )}
            </div>

            {selectedDay ? (
              selectedDayPosts.length > 0 ? (
                <div className="space-y-3">
                  {selectedDayPosts.map(post => {
                    const config = statusConfig[post.status];
                    const StatusIcon = config.icon;
                    return (
                      <Card key={post.id} className="overflow-hidden">
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
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => router.push(`/colaborador/calendario/novo?edit=${post.id}`)}
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
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
                              Mídia anexada
                            </div>
                          )}

                          {/* LinkedIn link */}
                          {post.linkedinPostUrl && (
                            <a
                              href={post.linkedinPostUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-[#0A66C2] hover:underline"
                            >
                              <Linkedin className="h-3.5 w-3.5" />
                              Ver no LinkedIn
                            </a>
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
                    <p className="text-sm text-muted-foreground">Nenhum post agendado</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => handleNewPost(selectedDay)}
                      className="mt-1 text-xs"
                    >
                      Criar post para este dia
                    </Button>
                  </CardContent>
                </Card>
              )
            ) : (
              <div className="space-y-3">
                {upcomingPosts.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">Próximos agendamentos:</p>
                    {upcomingPosts.map(post => {
                      const config = statusConfig[post.status];
                      const StatusIcon = config.icon;
                      return (
                        <Card key={post.id} className="overflow-hidden">
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary" className={`${config.color} text-xs gap-1`}>
                                <StatusIcon className="h-3 w-3" />
                                {config.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(post.scheduledFor), "d MMM, HH:mm", { locale: ptBR })}
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
                        Nenhum post agendado. Clique em um dia ou use o botão "Novo Post".
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
