'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Plus, Calendar as CalIcon, Users, Clock,
  User, ChevronDown, ChevronUp, GripVertical, ArrowRight,
} from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import { STATUS_CONFIG, PIPELINE_STATUSES, buildGetStatusLabel } from '@/lib/pipeline-config';
import { resolveSlugs, type PipelinePost, type PipelineStatus } from '@/app/actions/content-pipeline';
import { generateSlug } from '@/lib/slugify';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

type TLSummary = {
  id: string;
  slug: string;
  name: string;
  companyId: string;
  companySlug: string;
  companyName: string;
};

const MAX_VISIBLE_POSTS = 10;

export default function StrategistPipelinePage() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCompanySlug = searchParams.get('c');
  const urlTlSlug = searchParams.get('tl');
  const appliedUrlParams = useRef(false);
  const { toast } = useToast();

  const [thoughtLeaders, setThoughtLeaders] = useState<TLSummary[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [tlFilter, setTlFilter] = useState<string>('all');
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(false);

  // Dynamic content pillars from TL's strategy
  const [contentPillars, setContentPillars] = useState<string[]>([]);

  // Create post loading
  const [isCreating, setIsCreating] = useState(false);

  // Agendados toggle
  const [showAgendados, setShowAgendados] = useState(true);

  // "Ver todos" dialog
  const [dialogStatus, setDialogStatus] = useState<PipelineStatus | null>(null);

  // ─── Selection state ──────
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [isMoving, setIsMoving] = useState(false);

  // ─── Drag & drop state ──────
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<PipelineStatus | null>(null);

  // ─── Fetch TLs ──────
  useEffect(() => {
    if (!user?.uid) return;

    const fetchTLs = async () => {
      setIsLoading(true);
      try {
        let assignedCompanyIds: string[] = [];
        const rawAssigned = (user.rawData?.assignedCompanies) as string[] | undefined;
        if (rawAssigned && Array.isArray(rawAssigned) && rawAssigned.length > 0) {
          assignedCompanyIds = rawAssigned;
        } else {
          const userDocSnap = await getDoc(doc(db, 'users', user.uid));
          assignedCompanyIds = (userDocSnap.data()?.assignedCompanies as string[]) || [];
        }

        if (assignedCompanyIds.length === 0) {
          setThoughtLeaders([]);
          setIsLoading(false);
          return;
        }

        const allTLs: TLSummary[] = [];

        for (const companyId of assignedCompanyIds) {
          const compDoc = await getDoc(doc(db, 'companies', companyId));
          const compData = compDoc.data();
          const companyName = compData?.companyName || '';
          const companySlug = (compData?.slug as string) || generateSlug(companyName, companyId);

          const tlQuery = query(
            collection(db, 'users'),
            where('companyId', '==', companyId),
            where('role', '==', 'thoughtleader')
          );
          const tlSnap = await getDocs(tlQuery);

          for (const tlDoc of tlSnap.docs) {
            const data = tlDoc.data();
            if (data.pendingSetup) continue; // Skip placeholder TLs not yet invited
            const tlName = data.name || data.profile?.name || '';
            allTLs.push({
              id: tlDoc.id,
              slug: (data.slug as string) || generateSlug(tlName, tlDoc.id),
              name: tlName,
              companyId,
              companySlug,
              companyName,
            });
          }
        }

        setThoughtLeaders(allTLs);

        // Resolve URL slugs to IDs for pre-selection
        if (!appliedUrlParams.current) {
          if (urlCompanySlug) {
            const matchedCompany = allTLs.find(tl => tl.companySlug === urlCompanySlug);
            if (matchedCompany) {
              setSelectedCompany(matchedCompany.companyId);
              if (urlTlSlug) {
                const matchedTl = allTLs.find(tl => tl.slug === urlTlSlug && tl.companyId === matchedCompany.companyId);
                if (matchedTl) setTlFilter(matchedTl.id);
              }
            }
          } else if (allTLs.length > 0) {
            setSelectedCompany(allTLs[0].companyId);
          }
          appliedUrlParams.current = true;
        }
      } catch (error) {
        console.error('Error fetching TLs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTLs();
  }, [user?.uid]);

  // ─── Derived: unique companies ──────
  const companies = useMemo(() => {
    const map = new Map<string, { name: string; slug: string }>();
    thoughtLeaders.forEach(tl => {
      if (!map.has(tl.companyId)) map.set(tl.companyId, { name: tl.companyName, slug: tl.companySlug });
    });
    return Array.from(map.entries()).map(([id, info]) => ({ id, name: info.name, slug: info.slug }));
  }, [thoughtLeaders]);

  // ─── Derived: TLs for selected company ──────
  const companyTLs = useMemo(() => {
    if (!selectedCompany) return [];
    return thoughtLeaders.filter(tl => tl.companyId === selectedCompany);
  }, [thoughtLeaders, selectedCompany]);

  // ─── The effective TL IDs to fetch posts for ──────
  const activeTlIds = useMemo(() => {
    if (tlFilter !== 'all') return [tlFilter];
    return companyTLs.map(tl => tl.id);
  }, [tlFilter, companyTLs]);

  // ─── Fetch content pillars ──────
  useEffect(() => {
    if (activeTlIds.length === 0) {
      setContentPillars([]);
      return;
    }

    const fetchPillars = async () => {
      try {
        const token = await getAuthToken();
        const { getContentStrategy } = await import('@/app/actions/content-strategy');
        const result = await getContentStrategy(token, activeTlIds[0]);
        if (result.data?.pillars) {
          const names = result.data.pillars.map(p => p.name).filter(Boolean);
          setContentPillars(names);
        } else {
          setContentPillars([]);
        }
      } catch {
        setContentPillars([]);
      }
    };

    fetchPillars();
  }, [activeTlIds]);

  // ─── Fetch posts for active TLs ──────
  const fetchPosts = useCallback(async () => {
    if (activeTlIds.length === 0) {
      setPosts([]);
      return;
    }
    setIsPostsLoading(true);
    try {
      const token = await getAuthToken();
      const { getPipelinePosts } = await import('@/app/actions/content-pipeline');

      const allPosts: PipelinePost[] = [];
      for (const tlId of activeTlIds) {
        const result = await getPipelinePosts(token, tlId, null);
        if (result.posts) {
          result.posts.forEach(p => {
            (p as PipelinePost & { _tlId?: string })._tlId = tlId;
          });
          allPosts.push(...result.posts);
        }
      }
      setPosts(allPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsPostsLoading(false);
    }
  }, [activeTlIds]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Deep link: redirect to dedicated post page
  useEffect(() => {
    const urlPostId = searchParams.get('postId');
    if (!urlPostId || isPostsLoading || posts.length === 0) return;
    const targetPost = posts.find(p => p.id === urlPostId);
    if (targetPost) {
      const tl = getTlForPost(targetPost);
      const cSlug = tl?.companySlug || selectedCompanySlug;
      const tlSlug = tl?.slug || '';
      router.replace(`/post/${cSlug}/${tlSlug}/${targetPost.id}`);
    }
  }, [searchParams, isPostsLoading, posts]);

  // ─── Posts grouped by status ──────
  const postsByStatus = useMemo(() => {
    const map: Record<string, PipelinePost[]> = {};
    PIPELINE_STATUSES.forEach(s => { map[s] = []; });
    posts.forEach(post => {
      if (map[post.status]) {
        map[post.status].push(post);
      } else {
        map[post.status] = [post];
      }
    });
    return map;
  }, [posts]);

  // ─── Get TL info from post ──────
  const getTlForPost = (post: PipelinePost) => {
    const tlId = (post as PipelinePost & { _tlId?: string })._tlId;
    return thoughtLeaders.find(t => t.id === tlId);
  };

  const getTlName = (post: PipelinePost) => {
    const tl = getTlForPost(post);
    return tl ? tl.name.split(' ')[0] : '';
  };

  // ─── Get selected company slug ──────
  const selectedCompanySlug = useMemo(() => {
    if (!selectedCompany) return '';
    const comp = companies.find(c => c.id === selectedCompany);
    return comp?.slug || '';
  }, [selectedCompany, companies]);


  // ─── Create post directly ──────
  const createPostDirect = useCallback(async () => {
    const effectiveTlId = tlFilter !== 'all' ? tlFilter : companyTLs[0]?.id;
    if (!effectiveTlId || isCreating) return;

    setIsCreating(true);
    try {
      const token = await getAuthToken();
      const { createPipelinePost } = await import('@/app/actions/content-pipeline');
      const result = await createPipelinePost(token, effectiveTlId, {
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
        const tl = thoughtLeaders.find(t => t.id === effectiveTlId);
        router.push(`/post/${selectedCompanySlug}/${tl?.slug || effectiveTlId}/${result.postId}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
    } finally {
      setIsCreating(false);
    }
  }, [tlFilter, companyTLs, selectedCompany, isCreating, router]);

  const getStatusLabel = buildGetStatusLabel(t);

  // ─── Navigate to post ──────
  const handlePostClick = (post: PipelinePost) => {
    const tl = getTlForPost(post);
    const cSlug = tl?.companySlug || selectedCompanySlug;
    const tlSlug = tl?.slug || '';
    router.push(`/post/${cSlug}/${tlSlug}/${post.id}`);
  };

  // ─── Selection helpers ──────
  const toggleSelect = (postId: string) => {
    setSelectedPosts(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const clearSelection = () => setSelectedPosts(new Set());

  // ─── Move posts to a new status ──────
  const movePostsToStatus = async (postIds: string[], newStatus: PipelineStatus) => {
    setIsMoving(true);
    try {
      const token = await getAuthToken();
      const { updatePipelinePost } = await import('@/app/actions/content-pipeline');

      for (const postId of postIds) {
        const post = posts.find(p => p.id === postId);
        if (!post || post.status === newStatus) continue;
        const tlId = (post as PipelinePost & { _tlId?: string })._tlId;
        if (!tlId) continue;
        await updatePipelinePost(token, tlId, postId, { status: newStatus });
      }

      // Update local state optimistically
      setPosts(prev => prev.map(p =>
        postIds.includes(p.id) ? { ...p, status: newStatus } : p
      ));

      clearSelection();
      toast({ title: `${postIds.length} post${postIds.length > 1 ? 's' : ''} movido${postIds.length > 1 ? 's' : ''}.` });
    } catch (error) {
      console.error('Error moving posts:', error);
      toast({ variant: 'destructive', title: 'Erro ao mover posts.' });
    } finally {
      setIsMoving(false);
    }
  };

  // ─── Drag & drop handlers ──────
  const handleDragStart = (e: React.DragEvent, postId: string) => {
    setDraggedPostId(postId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', postId);
  };

  const handleDragOver = (e: React.DragEvent, status: PipelineStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: PipelineStatus) => {
    e.preventDefault();
    setDragOverStatus(null);

    const postId = draggedPostId || e.dataTransfer.getData('text/plain');
    setDraggedPostId(null);

    if (!postId) return;

    // If there are selected posts and the dragged one is selected, move all selected
    const idsToMove = selectedPosts.has(postId) && selectedPosts.size > 0
      ? Array.from(selectedPosts)
      : [postId];

    await movePostsToStatus(idsToMove, targetStatus);
  };

  const handleDragEnd = () => {
    setDraggedPostId(null);
    setDragOverStatus(null);
  };

  // ─── Statuses for grid and agendado ──────
  const gridStatuses = PIPELINE_STATUSES.filter(s => s !== 'agendado' && s !== 'arquivado');
  const agendadoPosts = postsByStatus['agendado'] || [];

  // ─── All available move targets (for bulk move) ──────
  const moveTargetStatuses = PIPELINE_STATUSES.filter(s => s !== 'arquivado');

  // ─── Loading state ──────
  if (isLoading) {
    return (
      <>
        <Header title={t.contentPipeline.title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  if (thoughtLeaders.length === 0) {
    return (
      <>
        <Header title={t.contentPipeline.title} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t.strategist.noTLs}</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t.contentPipeline.title} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {/* Top bar: Company + TL filter + new post */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Company selector */}
          {companies.length > 1 && (
            <Select value={selectedCompany || ''} onValueChange={(v) => { setSelectedCompany(v); setTlFilter('all'); clearSelection(); }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* TL / profile filter */}
          <Select value={tlFilter} onValueChange={(v) => { setTlFilter(v); clearSelection(); }}>
            <SelectTrigger className="w-[200px]">
              <User className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Perfil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Perfis</SelectItem>
              {companyTLs.map(tl => (
                <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={createPostDirect} disabled={companyTLs.length === 0 || isCreating} size="sm">
            {isCreating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            {t.contentPipeline.newPost}
          </Button>
        </div>

        {/* Selection action bar */}
        {selectedPosts.size > 0 && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
            <span className="text-sm font-medium">
              {selectedPosts.size} selecionado{selectedPosts.size > 1 ? 's' : ''}
            </span>

            <Select
              value=""
              onValueChange={(v) => movePostsToStatus(Array.from(selectedPosts), v as PipelineStatus)}
              disabled={isMoving}
            >
              <SelectTrigger className="w-[180px] h-8 text-xs">
                {isMoving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                <SelectValue placeholder="Mover para..." />
              </SelectTrigger>
              <SelectContent>
                {moveTargetStatuses.map(s => (
                  <SelectItem key={s} value={s}>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${STATUS_CONFIG[s].dot}`} />
                      {getStatusLabel(s)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground ml-auto"
            >
              Limpar
            </button>
          </div>
        )}

        {isPostsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Grid of status boxes — 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {gridStatuses.map(status => {
                const cfg = STATUS_CONFIG[status];
                const columnPosts = postsByStatus[status] || [];
                const showBox = columnPosts.length > 0 || ['backlog', 'aprovar_ideia', 'em_producao', 'aprovar_post', 'post_aprovado', 'pronto_pra_postar'].includes(status);

                if (!showBox) return null;

                const visiblePosts = columnPosts.slice(0, MAX_VISIBLE_POSTS);
                const hasMore = columnPosts.length > MAX_VISIBLE_POSTS;
                const isDragTarget = dragOverStatus === status;

                return (
                  <div
                    key={status}
                    className={`rounded-lg border bg-card overflow-hidden border-t-2 ${cfg.kanbanBorder} transition-all ${
                      isDragTarget ? 'ring-2 ring-primary/40 bg-primary/5' : ''
                    }`}
                    onDragOver={(e) => handleDragOver(e, status)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    {/* Box header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{getStatusLabel(status)}</span>
                        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                          {columnPosts.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={createPostDirect}
                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        title="Adicionar post"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Post list — compact horizontal rows */}
                    <div className="divide-y">
                      {visiblePosts.length === 0 && (
                        <div className="px-3 py-4 text-center">
                          <p className="text-xs text-muted-foreground">Nenhum post</p>
                        </div>
                      )}
                      {visiblePosts.map(post => (
                        <PostRow
                          key={post.id}
                          post={post}
                          tlName={getTlName(post)}
                          showTl={tlFilter === 'all'}
                          onClick={() => handlePostClick(post)}
                          isSelected={selectedPosts.has(post.id)}
                          onToggleSelect={() => toggleSelect(post.id)}
                          isDragging={draggedPostId === post.id}
                          onDragStart={(e) => handleDragStart(e, post.id)}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </div>

                    {/* "Ver todos" button */}
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

            {/* Agendados section — horizontal box below */}
            {agendadoPosts.length > 0 && (
              <div
                className={`rounded-lg border bg-card overflow-hidden border-t-2 ${STATUS_CONFIG.agendado.kanbanBorder} transition-all ${
                  dragOverStatus === 'agendado' ? 'ring-2 ring-primary/40 bg-primary/5' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, 'agendado')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'agendado')}
              >
                {/* Toggle header */}
                <button
                  type="button"
                  onClick={() => setShowAgendados(prev => !prev)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{getStatusLabel('agendado')}</span>
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                      {agendadoPosts.length}
                    </span>
                  </div>
                  {showAgendados ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {/* Agendados list */}
                {showAgendados && (
                  <div className="divide-y">
                    {agendadoPosts.map(post => (
                      <PostRow
                        key={post.id}
                        post={post}
                        tlName={getTlName(post)}
                        showTl={tlFilter === 'all'}
                        onClick={() => handlePostClick(post)}
                        isSelected={selectedPosts.has(post.id)}
                        onToggleSelect={() => toggleSelect(post.id)}
                        isDragging={draggedPostId === post.id}
                        onDragStart={(e) => handleDragStart(e, post.id)}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                  key={post.id}
                  post={post}
                  tlName={getTlName(post)}
                  showTl={tlFilter === 'all'}
                  onClick={() => { setDialogStatus(null); handlePostClick(post); }}
                  isSelected={selectedPosts.has(post.id)}
                  onToggleSelect={() => toggleSelect(post.id)}
                  isDragging={false}
                  onDragStart={(e) => handleDragStart(e, post.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

// ─── Compact Post Row Component ──────

function PostRow({
  post,
  tlName,
  showTl,
  onClick,
  isSelected,
  onToggleSelect,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  post: PipelinePost;
  tlName: string;
  showTl: boolean;
  onClick: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
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

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-1.5 px-2 py-2 hover:bg-muted/50 transition-all cursor-grab active:cursor-grabbing group ${
        isDragging ? 'opacity-40 bg-muted/30' : ''
      } ${isSelected ? 'bg-primary/5' : ''}`}
    >
      {/* Drag handle */}
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />

      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggleSelect()}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 h-3.5 w-3.5"
      />

      {/* Title — clickable, takes remaining space */}
      <button
        type="button"
        onClick={onClick}
        className="flex-1 text-left text-sm leading-tight truncate font-medium min-w-0 hover:text-primary transition-colors"
      >
        {post.title || 'Sem título'}
      </button>

      {/* Meta: tags + date + profile */}
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
        {showTl && tlName && (
          <span className="hidden md:inline-flex items-center gap-0.5">
            <User className="h-3 w-3" />
            {tlName}
          </span>
        )}
      </div>
    </div>
  );
}
