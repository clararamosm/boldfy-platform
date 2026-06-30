'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/dashboard/header';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Users, User, Calendar as CalIcon, Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import { useToast } from '@/hooks/use-toast';
import {
  STATUS_CONFIG,
  PIPELINE_STATUSES,
  PIPELINE_GRID_STATUSES,
  PIPELINE_TOGGLE_STATUSES,
  buildGetStatusLabel,
} from '@/lib/pipeline-config';
import {
  getAllPipelinePostsForAdmin,
  type CalendarPipelinePost,
  type PipelineStatus,
} from '@/app/actions/content-pipeline';

const MAX_VISIBLE_POSTS = 10;

export default function AdminBacklogPage() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();

  const [posts, setPosts] = useState<CalendarPipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tlFilter, setTlFilter] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [dialogStatus, setDialogStatus] = useState<PipelineStatus | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        const result = await getAllPipelinePostsForAdmin(token);
        if (result.posts) {
          setPosts(result.posts);
        } else if (result.error) {
          toast({ variant: 'destructive', title: 'Erro', description: result.error });
        }
      } catch (error) {
        console.error('Error fetching admin backlog:', error);
        toast({ variant: 'destructive', title: 'Erro ao carregar backlog.' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user?.uid, toast]);

  // ─── Unique TLs for the filter dropdown ──────
  const tls = useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>();
    posts.forEach(p => {
      if (!map.has(p.tlUserId)) map.set(p.tlUserId, { name: p.tlName, slug: p.tlSlug });
    });
    return Array.from(map.entries())
      .map(([id, info]) => ({ id, name: info.name, slug: info.slug }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [posts]);

  // ─── Apply TL filter ──────
  const filteredPosts = useMemo(() => {
    if (tlFilter === 'all') return posts;
    return posts.filter(p => p.tlUserId === tlFilter);
  }, [posts, tlFilter]);

  // ─── Posts grouped by status ──────
  const postsByStatus = useMemo(() => {
    const map: Record<string, CalendarPipelinePost[]> = {};
    PIPELINE_STATUSES.forEach(s => { map[s] = []; });
    filteredPosts.forEach(post => {
      if (map[post.status]) map[post.status].push(post);
      else map[post.status] = [post];
    });
    return map;
  }, [filteredPosts]);

  const getStatusLabel = buildGetStatusLabel(t);

  const handlePostClick = (post: CalendarPipelinePost) => {
    router.push(`/post/${post.companySlug}/${post.tlSlug}/${post.id}`);
  };

  const gridStatuses = PIPELINE_GRID_STATUSES;
  const toggleStatuses = PIPELINE_TOGGLE_STATUSES;

  if (isLoading) {
    return (
      <>
        <Header title="Backlog" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  if (posts.length === 0) {
    return (
      <>
        <Header title="Backlog" />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum conteúdo dos executivos ainda.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Backlog" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* TL filter */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select value={tlFilter} onValueChange={setTlFilter}>
            <SelectTrigger className="w-[220px]">
              <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Perfis</SelectItem>
              {tls.map(tl => (
                <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {/* Grid of status boxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {gridStatuses.map(status => {
              const cfg = STATUS_CONFIG[status];
              const columnPosts = postsByStatus[status] || [];
              const showBox = columnPosts.length > 0 || ['backlog', 'aprovar_ideia', 'em_producao', 'aprovar_post', 'post_aprovado', 'ajuste'].includes(status);
              if (!showBox) return null;

              const visiblePosts = columnPosts.slice(0, MAX_VISIBLE_POSTS);
              const hasMore = columnPosts.length > MAX_VISIBLE_POSTS;

              return (
                <div
                  key={status}
                  className={`rounded-lg border bg-card overflow-hidden border-t-2 ${cfg.kanbanBorder}`}
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{getStatusLabel(status)}</span>
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        {columnPosts.length}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {visiblePosts.length === 0 && (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-muted-foreground">Nenhum post</p>
                      </div>
                    )}
                    {visiblePosts.map(post => (
                      <PostRow
                        key={`${post.tlUserId}-${post.id}`}
                        post={post}
                        showTl={tlFilter === 'all'}
                        onClick={() => handlePostClick(post)}
                      />
                    ))}
                  </div>
                  {hasMore && (
                    <div className="border-t px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setDialogStatus(status)}
                        className="w-full text-center text-xs font-medium text-primary hover:underline"
                      >
                        Ver todos ({columnPosts.length})
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Completed section */}
          {(() => {
            const completedCount = toggleStatuses.reduce((sum, s) => sum + (postsByStatus[s]?.length || 0), 0);
            if (completedCount === 0) return null;
            return (
              <div className="rounded-lg border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCompleted(prev => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.contentPipeline.completedPosts}</span>
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {completedCount}
                    </span>
                  </div>
                </button>
                {showCompleted && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                    {toggleStatuses.map(status => {
                      const cfg = STATUS_CONFIG[status];
                      const columnPosts = postsByStatus[status] || [];
                      if (columnPosts.length === 0) return null;
                      const visiblePosts = columnPosts.slice(0, MAX_VISIBLE_POSTS);
                      const hasMore = columnPosts.length > MAX_VISIBLE_POSTS;
                      return (
                        <div key={status} className={`rounded-lg border bg-card overflow-hidden border-t-2 ${cfg.kanbanBorder}`}>
                          <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{getStatusLabel(status)}</span>
                              <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                                {columnPosts.length}
                              </span>
                            </div>
                          </div>
                          <div className="divide-y">
                            {visiblePosts.map(post => (
                              <PostRow
                                key={`${post.tlUserId}-${post.id}`}
                                post={post}
                                showTl={tlFilter === 'all'}
                                onClick={() => handlePostClick(post)}
                              />
                            ))}
                          </div>
                          {hasMore && (
                            <div className="border-t px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setDialogStatus(status)}
                                className="w-full text-center text-xs font-medium text-primary hover:underline"
                              >
                                Ver todos ({columnPosts.length})
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* "Ver todos" dialog */}
        <Dialog open={!!dialogStatus} onOpenChange={() => setDialogStatus(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {dialogStatus && getStatusLabel(dialogStatus)} ({dialogStatus ? (postsByStatus[dialogStatus]?.length || 0) : 0})
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto divide-y border rounded-md">
              {dialogStatus && (postsByStatus[dialogStatus] || []).map(post => (
                <PostRow
                  key={`${post.tlUserId}-${post.id}`}
                  post={post}
                  showTl={tlFilter === 'all'}
                  onClick={() => { setDialogStatus(null); handlePostClick(post); }}
                />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

// ─── Compact, read-only Post Row ──────

function PostRow({
  post,
  showTl,
  onClick,
}: {
  post: CalendarPipelinePost;
  showTl: boolean;
  onClick: () => void;
}) {
  let dateStr = '';
  let timeStr = '';
  if (post.scheduledFor) {
    const d = new Date(post.scheduledFor);
    dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (`${hh}:${mm}` !== '00:00') timeStr = `${hh}:${mm}`;
  }

  const tlFirstName = post.tlName ? post.tlName.split(' ')[0] : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-1.5 px-2 py-2 hover:bg-muted/50 transition-all text-left group"
    >
      <span className="flex-1 text-sm leading-tight truncate font-medium min-w-0 group-hover:text-primary transition-colors">
        {post.title || 'Sem título'}
      </span>
      <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-muted-foreground">
        {post.formato && (
          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
            {post.formato}
          </span>
        )}
        {post.scheduledFor && (
          <span className="inline-flex items-center gap-0.5">
            <CalIcon className="h-3 w-3" />
            {dateStr}
            {timeStr && (
              <>
                <Clock className="h-3 w-3 ml-0.5" />
                {timeStr}
              </>
            )}
          </span>
        )}
        {showTl && tlFirstName && (
          <span className="hidden md:inline-flex items-center gap-1">
            {post.tlPhotoUrl ? (
              <img src={post.tlPhotoUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
            ) : (
              <User className="h-3 w-3" />
            )}
            {tlFirstName}
          </span>
        )}
      </div>
    </button>
  );
}
