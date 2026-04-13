// src/app/colaborador/calendario/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarSkeleton } from '@/components/calendar/calendar-skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/auth-client';
import { getScheduledPosts, deleteScheduledPost, updateScheduledPost, type ScheduledPost } from '@/app/actions/posts';
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
  Zap,
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
  isBefore,
  isAfter,
} from 'date-fns';
import { useT, useLocale } from '@/lib/i18n/context';
import { getDateLocale } from '@/lib/i18n/date-utils';
import type { Dictionary } from '@/lib/i18n/dictionaries/pt-BR';
import { CalendarPostCard, type CalendarCardConfig } from '@/components/calendar/calendar-post-card';
import { CalendarDayCell } from '@/components/calendar/calendar-day-cell';

// ─── Types ──────
type CalendarMission = {
  id: string;
  name: string;
  description: string;
  points: number;
  startDate: Date | null;
  endDate: Date | null;
  calendarStatus: 'active' | 'scheduled';
  type: string;
};

type CalendarItem =
  | { kind: 'post'; data: ScheduledPost }
  | { kind: 'mission'; data: CalendarMission };

// ─── Config ──────
function getPostStatusConfig(t: Dictionary) {
  return {
    published: {
      tag: t.colabCalendar.tagPostPublished,
      color: 'bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20',
      cardBorder: 'border-l-4 border-l-[#0A66C2]',
      badge: 'bg-[#0A66C2]/10 text-[#0A66C2]',
      dot: 'bg-[#0A66C2]',
      icon: CheckCircle2,
    },
    scheduled: {
      tag: t.colabCalendar.tagPostScheduled,
      color: 'bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20',
      cardBorder: 'border-l-4 border-l-[#0A66C2]/60',
      badge: 'bg-[#0A66C2]/10 text-[#0A66C2]',
      dot: 'bg-[#0A66C2]/60',
      icon: Clock,
    },
    in_progress: {
      tag: t.colabCalendar.tagPostInProgress,
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      cardBorder: 'border-l-4 border-l-yellow-500',
      badge: 'bg-yellow-100 text-yellow-700',
      dot: 'bg-yellow-500',
      icon: Edit3,
    },
    draft: {
      tag: t.colabCalendar.tagPostIdea,
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      cardBorder: 'border-l-4 border-l-gray-400',
      badge: 'bg-gray-100 text-gray-600',
      dot: 'bg-gray-400',
      icon: Edit3,
    },
    failed: {
      tag: t.colabCalendar.tagPostFailed,
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      cardBorder: 'border-l-4 border-l-red-500',
      badge: 'bg-red-100 text-red-700',
      dot: 'bg-red-500',
      icon: AlertCircle,
    },
  };
}

// ─── Helpers ──────
const toDate = (d: { toDate?: () => Date } | string | null | undefined): Date | null => {
  if (!d) return null;
  if (typeof d === 'object' && d !== null && 'toDate' in d && typeof d.toDate === 'function') return d.toDate();
  return new Date(d as string);
};

type StatusFilter = 'all' | 'missions' | 'published' | 'scheduled' | 'in_progress' | 'draft' | 'failed';

export default function CalendarioPage() {
  const t = useT();
  const locale = useLocale();
  const dateFnsLocale = getDateLocale(locale);
  const postStatusConfig = useMemo(() => getPostStatusConfig(t), [t]);
  const { user: authUser } = useAuth();
  const userId = authUser?.uid || null;
  const [isLoading, setIsLoading] = useState(true);
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [missions, setMissions] = useState<CalendarMission[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { toast } = useToast();
  const router = useRouter();

  // ─── Drag & drop state ──────
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // ─── Fetch posts + missions ──────
  const fetchData = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const [postsResult, userDocSnap] = await Promise.all([
        getAuthToken().then(token => getScheduledPosts(token, uid)),
        getDoc(doc(db, 'users', uid)),
      ]);

      // Posts
      if (postsResult.posts) {
        setPosts(postsResult.posts);
      } else if (postsResult.error) {
        toast({ variant: 'destructive', title: t.common.error, description: postsResult.error });
      }

      // Missions
      if (userDocSnap.exists()) {
        const companyId = userDocSnap.data()?.companyId;
        if (companyId) {
          const [missionsSnap, subsSnap] = await Promise.all([
            getDocs(collection(db, 'companies', companyId, 'missions')),
            getDocs(collection(db, 'companies', companyId, 'missionSubmissions')),
          ]);

          // Build user submissions map
          const userSubs: Record<string, string> = {};
          subsSnap.docs.forEach(d => {
            const data = d.data();
            if (data.userId === uid) {
              const existing = userSubs[data.missionId];
              if (!existing || data.status === 'approved') {
                userSubs[data.missionId] = data.status;
              }
            }
          });

          const now = new Date();
          const calMissions: CalendarMission[] = [];

          missionsSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            // Skip trail missions assigned to other users
            const isTrailMission = data.type === 'trail_content' || data.type === 'trail_trigger';
            if (isTrailMission && data.assignedTo && data.assignedTo !== uid) return;

            const start = toDate(data.startDate);
            const end = toDate(data.endDate);

            // Only show missions that have dates (timed missions)
            if (!start && !end) return;

            // Skip completed/expired
            const sub = userSubs[docSnap.id];
            if (sub === 'approved') return;
            if (end && isBefore(end, now) && sub !== 'approved') return; // expired

            const isScheduled = start && isAfter(start, now);

            calMissions.push({
              id: docSnap.id,
              name: data.name || 'Sem titulo',
              description: data.description || '',
              points: data.points || 0,
              startDate: start,
              endDate: end,
              calendarStatus: isScheduled ? 'scheduled' : 'active',
              type: data.type || 'timed',
            });
          });

          setMissions(calMissions);
        }
      }
    } catch (err) {
      console.error('Calendar fetch error:', err);
      toast({ variant: 'destructive', title: t.common.error, description: t.colabCalendar.loadError });
    } finally {
      setIsLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    if (userId) fetchData(userId);
  }, [userId, fetchData]);

  // ─── Status counts ──────
  const statusCounts = useMemo(() => {
    const counts = { all: posts.length + missions.length, missions: missions.length, published: 0, scheduled: 0, in_progress: 0, draft: 0, failed: 0 };
    posts.forEach(post => {
      if (post.status in counts) counts[post.status as keyof typeof counts]++;
    });
    return counts;
  }, [posts, missions]);

  // ─── Unified calendar items grouped by day ──────
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    const addItem = (key: string, item: CalendarItem) => {
      const existing = map.get(key) || [];
      existing.push(item);
      map.set(key, existing);
    };

    // Posts: filter by status if needed
    const filteredPosts = statusFilter === 'all' ? posts
      : statusFilter === 'missions' ? []
      : posts.filter(p => p.status === statusFilter);

    filteredPosts.forEach(post => {
      const dayKey = format(parseISO(post.scheduledFor), 'yyyy-MM-dd');
      addItem(dayKey, { kind: 'post', data: post });
    });

    // Missions: show on each day within their date range
    const showMissions = statusFilter === 'all' || statusFilter === 'missions';
    if (showMissions) {
      missions.forEach(mission => {
        const start = mission.startDate || mission.endDate;
        const end = mission.endDate || mission.startDate;
        if (!start || !end) return;

        const days = eachDayOfInterval({ start, end });
        days.forEach(day => {
          const dayKey = format(day, 'yyyy-MM-dd');
          addItem(dayKey, { kind: 'mission', data: mission });
        });
      });
    }

    return map;
  }, [posts, missions, statusFilter]);

  // ─── Selected day items ──────
  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return itemsByDay.get(key) || [];
  }, [selectedDay, itemsByDay]);

  // ─── Upcoming (sidebar default) ──────
  const upcomingItems = useMemo(() => {
    const now = new Date();
    const upcoming: CalendarItem[] = [];

    // Upcoming posts
    posts
      .filter(p => p.status === 'scheduled' && parseISO(p.scheduledFor) > now)
      .sort((a, b) => parseISO(a.scheduledFor).getTime() - parseISO(b.scheduledFor).getTime())
      .slice(0, 3)
      .forEach(p => upcoming.push({ kind: 'post', data: p }));

    // Active missions
    missions
      .filter(m => m.calendarStatus === 'active')
      .slice(0, 3)
      .forEach(m => upcoming.push({ kind: 'mission', data: m }));

    return upcoming;
  }, [posts, missions]);

  // ─── Calendar days ──────
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // ─── Handlers ──────
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
    if (date) params.set('date', date.toISOString());
    router.push(`/colaborador/calendario/novo?${params.toString()}`);
  };

  // ─── Drag & drop handlers ──────
  const handleDragStart = (post: ScheduledPost, e: React.DragEvent) => {
    setDraggedPostId(post.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', post.id);
  };

  const handleDragEnd = () => {
    setDraggedPostId(null);
    setDragOverDay(null);
  };

  const handleDrop = async (dayKey: string) => {
    if (!draggedPostId || !userId) return;

    const post = posts.find(p => p.id === draggedPostId);
    if (!post) return;

    // Keep original time, change only the date
    const originalTime = post.scheduledFor.substring(10);
    const newScheduledFor = dayKey + originalTime;

    if (newScheduledFor === post.scheduledFor) {
      handleDragEnd();
      return;
    }

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === draggedPostId ? { ...p, scheduledFor: newScheduledFor } : p
    ));

    handleDragEnd();

    try {
      const token = await getAuthToken();
      const result = await updateScheduledPost(token, userId, post.id, {
        scheduledFor: newScheduledFor,
      });
      if (result.error) {
        setPosts(prev => prev.map(p =>
          p.id === post.id ? { ...p, scheduledFor: post.scheduledFor } : p
        ));
        toast({ variant: 'destructive', title: t.common.error, description: result.error });
      }
    } catch {
      setPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, scheduledFor: post.scheduledFor } : p
      ));
      toast({ variant: 'destructive', title: t.common.error });
    }
  };

  // ─── Card config adapter ──────
  const getCardConfig = (status: string): CalendarCardConfig => {
    const cfg = postStatusConfig[status as keyof typeof postStatusConfig] || postStatusConfig.draft;
    return { label: cfg.tag, badge: cfg.badge, dot: cfg.dot };
  };

  // ─── Calendar cell indicator helpers ──────
  const getCalendarCellLabel = (item: CalendarItem): string => {
    if (item.kind === 'post') {
      return `${format(parseISO(item.data.scheduledFor), 'HH:mm')} · ${item.data.caption.slice(0, 18)}`;
    }
    return item.data.name.slice(0, 22);
  };

  const getCalendarCellColor = (item: CalendarItem): string => {
    if (item.kind === 'post') {
      const config = postStatusConfig[item.data.status as keyof typeof postStatusConfig];
      return config ? `${config.badge}` : 'bg-gray-100 text-gray-600';
    }
    return item.data.calendarStatus === 'active'
      ? 'bg-primary/15 text-primary'
      : 'bg-primary/8 text-primary/60';
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

  // ─── Sidebar card render ──────
  const renderSidebarCard = (item: CalendarItem, idx: number) => {
    if (item.kind === 'post') {
      const post = item.data;
      const config = postStatusConfig[post.status as keyof typeof postStatusConfig] || postStatusConfig.draft;
      const StatusIcon = config.icon;

      return (
        <Card key={`post-${post.id}`} className={`overflow-hidden ${config.cardBorder}`}>
          <CardContent className="p-4 space-y-3">
            {/* Tag + Status + time */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={`${config.color} text-[10px] gap-1 h-5`}>
                  <StatusIcon className="h-3 w-3" />
                  {config.tag}
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

            {/* LinkedIn link */}
            {post.linkedinPostUrl && (
              <a
                href={post.linkedinPostUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#0A66C2] hover:underline font-medium"
              >
                <Linkedin className="h-3.5 w-3.5" />
                {t.colabCalendar.viewOnLinkedin}
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
    }

    // Mission card
    const mission = item.data;
    const isActive = mission.calendarStatus === 'active';
    const borderClass = isActive
      ? 'border-l-4 border-l-primary'
      : 'border-l-4 border-l-primary/40';
    const tagColor = isActive
      ? 'bg-primary/10 text-primary'
      : 'bg-primary/5 text-primary/60';
    const tagLabel = isActive ? t.colabCalendar.tagMissionActive : t.colabCalendar.tagMissionScheduled;

    return (
      <Card key={`mission-${mission.id}`} className={`overflow-hidden ${borderClass}`}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className={`${tagColor} text-[10px] gap-1 h-5`}>
              <Zap className="h-3 w-3" />
              {tagLabel}
            </Badge>
            <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] h-5 px-1.5">
              {mission.points} pts
            </Badge>
          </div>
          <h4 className="text-sm font-medium">{mission.name}</h4>
          {mission.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{mission.description}</p>
          )}
          {(mission.startDate || mission.endDate) && (
            <p className="text-[11px] text-muted-foreground">
              {mission.startDate && format(mission.startDate, "d MMM", { locale: dateFnsLocale })}
              {mission.startDate && mission.endDate && ' — '}
              {mission.endDate && format(mission.endDate, "d MMM", { locale: dateFnsLocale })}
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Header title={t.colabCalendar.title} />
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
                { key: 'missions' as StatusFilter, label: t.colabCalendar.filterMissions, color: 'bg-primary/10 text-primary' },
                { key: 'published' as StatusFilter, label: t.colabCalendar.filterPublished, color: 'bg-[#0A66C2]/10 text-[#0A66C2]' },
                { key: 'scheduled' as StatusFilter, label: t.colabCalendar.filterScheduled, color: 'bg-[#0A66C2]/10 text-[#0A66C2]' },
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
                  const dayItems = itemsByDay.get(dayKey) || [];
                  // Deduplicate missions
                  const seen = new Set<string>();
                  const uniqueItems = dayItems.filter(item => {
                    const key = item.kind === 'post' ? `p-${item.data.id}` : `m-${item.data.id}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

                  // Separate posts and missions for rendering
                  const postItems = uniqueItems.filter((i): i is { kind: 'post'; data: ScheduledPost } => i.kind === 'post');
                  const missionItems = uniqueItems.filter((i): i is { kind: 'mission'; data: CalendarMission } => i.kind === 'mission');

                  return (
                    <CalendarDayCell
                      key={idx}
                      day={day}
                      inMonth={isSameMonth(day, currentMonth)}
                      isToday={isToday(day)}
                      isSelected={isSelected}
                      onClick={() => setSelectedDay(day)}
                      droppable={!!draggedPostId}
                      isDragOver={dragOverDay === dayKey}
                      onDragOver={() => setDragOverDay(dayKey)}
                      onDragLeave={() => { if (dragOverDay === dayKey) setDragOverDay(null); }}
                      onDrop={() => handleDrop(dayKey)}
                      minHeight="min-h-[90px]"
                    >
                      {/* Post cards — draggable */}
                      {postItems.slice(0, 2).map(item => (
                        <CalendarPostCard
                          key={`p-${item.data.id}`}
                          post={{
                            id: item.data.id,
                            caption: item.data.caption,
                            scheduledFor: item.data.scheduledFor,
                            status: item.data.status,
                          }}
                          statusConfig={getCardConfig(item.data.status)}
                          draggable={item.data.status !== 'published'}
                          onDragStart={(e) => handleDragStart(item.data, e)}
                          onDragEnd={handleDragEnd}
                          isDragging={draggedPostId === item.data.id}
                          onClick={() => setSelectedDay(day)}
                        />
                      ))}
                      {/* Mission indicators (not draggable) */}
                      {missionItems.slice(0, postItems.length > 0 ? 1 : 2).map(item => (
                        <div
                          key={`m-${item.data.id}`}
                          className={`text-[10px] px-1 py-0.5 rounded truncate ${getCalendarCellColor(item)}`}
                        >
                          <Zap className="h-2.5 w-2.5 inline mr-0.5 -mt-px" />
                          {getCalendarCellLabel(item)}
                        </div>
                      ))}
                      {uniqueItems.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{uniqueItems.length - 2}
                        </div>
                      )}
                    </CalendarDayCell>
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
              selectedDayItems.length > 0 ? (
                <div className="space-y-3">
                  {(() => {
                    const seen = new Set<string>();
                    return selectedDayItems.filter(item => {
                      const key = item.kind === 'post' ? `p-${item.data.id}` : `m-${item.data.id}`;
                      if (seen.has(key)) return false;
                      seen.add(key);
                      return true;
                    }).map((item, idx) => renderSidebarCard(item, idx));
                  })()}
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
                {upcomingItems.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">{t.colabCalendar.nextScheduled}</p>
                    {upcomingItems.map((item, idx) => renderSidebarCard(item, idx))}
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
