'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PipelineCreateDialog } from '@/components/pipeline/create-dialog';
import {
  Loader2, Plus, Calendar as CalIcon, Users, Clock,
  User, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import { STATUS_CONFIG, PIPELINE_STATUSES, buildGetStatusLabel } from '@/lib/pipeline-config';
import type { PipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';

type TLSummary = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
};


export default function StrategistPipelinePage() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCompanyId = searchParams.get('companyId');
  const urlTlId = searchParams.get('tlId');
  const appliedUrlParams = useRef(false);

  const [thoughtLeaders, setThoughtLeaders] = useState<TLSummary[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [tlFilter, setTlFilter] = useState<string>('all');
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(false);

  // Dynamic content pillars from TL's strategy
  const [contentPillars, setContentPillars] = useState<string[]>([]);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitialStatus, setDialogInitialStatus] = useState<PipelineStatus>('backlog');

  // Kanban scroll
  const kanbanRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = kanbanRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollKanban = (direction: 'left' | 'right') => {
    const el = kanbanRef.current;
    if (!el) return;
    const amount = 300;
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    setTimeout(checkScroll, 350);
  };


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
          const companyName = compDoc.data()?.companyName || '';

          const tlQuery = query(
            collection(db, 'users'),
            where('companyId', '==', companyId),
            where('role', '==', 'thoughtleader')
          );
          const tlSnap = await getDocs(tlQuery);

          for (const tlDoc of tlSnap.docs) {
            const data = tlDoc.data();
            allTLs.push({
              id: tlDoc.id,
              name: data.name || data.profile?.name || '',
              companyId,
              companyName,
            });
          }
        }

        setThoughtLeaders(allTLs);

        if (!appliedUrlParams.current) {
          if (urlCompanyId) {
            setSelectedCompany(urlCompanyId);
            if (urlTlId && allTLs.some(tl => tl.id === urlTlId)) {
              setTlFilter(urlTlId);
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
    const map = new Map<string, string>();
    thoughtLeaders.forEach(tl => {
      if (!map.has(tl.companyId)) map.set(tl.companyId, tl.companyName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
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

  // ─── Fetch content pillars (uses first active TL) ──────
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
          // Tag each post with its TL id for display
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

  // Check scroll arrows after posts load
  useEffect(() => {
    if (!isPostsLoading) {
      setTimeout(checkScroll, 100);
    }
  }, [isPostsLoading, checkScroll]);

  // Deep link: redirect to dedicated post page
  useEffect(() => {
    const urlPostId = searchParams.get('postId');
    if (!urlPostId || isPostsLoading || posts.length === 0) return;
    const targetPost = posts.find(p => p.id === urlPostId);
    if (targetPost) {
      const postTlId = (targetPost as PipelinePost & { _tlId?: string })._tlId || activeTlIds[0];
      router.replace(`/post/${selectedCompany}/${postTlId}/${targetPost.id}`);
    }
  }, [searchParams, isPostsLoading, posts]);

  // ─── Posts grouped by status (for kanban) ──────
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

  // ─── Get TL name from id ──────
  const getTlName = (post: PipelinePost) => {
    const tlId = (post as PipelinePost & { _tlId?: string })._tlId;
    const tl = thoughtLeaders.find(t => t.id === tlId);
    return tl ? tl.name.split(' ')[0] : '';
  };


  // ─── Dialog handler ──────
  const openCreateDialog = (forStatus: PipelineStatus = 'backlog') => {
    setDialogInitialStatus(forStatus);
    setDialogOpen(true);
  };

  const getStatusLabel = buildGetStatusLabel(t);

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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Company selector */}
          {companies.length > 1 && (
            <Select value={selectedCompany || ''} onValueChange={(v) => { setSelectedCompany(v); setTlFilter('all'); }}>
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
          <Select value={tlFilter} onValueChange={setTlFilter}>
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

          <Button onClick={() => openCreateDialog('backlog')} disabled={companyTLs.length === 0} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            {t.contentPipeline.newPost}
          </Button>
        </div>

        {/* Kanban board */}
        {isPostsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="relative">
            {/* Scroll arrows */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollKanban('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/90 border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollKanban('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-background/90 border shadow-md flex items-center justify-center hover:bg-accent transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

          <div
            ref={kanbanRef}
            onScroll={checkScroll}
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
            style={{ height: 'calc(100vh - 180px)' }}
          >
            {PIPELINE_STATUSES.map(status => {
              const cfg = STATUS_CONFIG[status];
              const columnPosts = postsByStatus[status] || [];
              const showColumn = columnPosts.length > 0 || ['backlog', 'aprovar_ideia', 'em_producao', 'aprovar_post', 'post_aprovado', 'pronto_pra_postar'].includes(status);

              if (!showColumn) return null;

              return (
                <div
                  key={status}
                  className="flex-shrink-0 w-[280px] flex flex-col"
                >
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-t-2 bg-muted/30 ${cfg.kanbanBorder}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{getStatusLabel(status)}</span>
                      <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        {columnPosts.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateDialog(status)}
                      className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      title="Adicionar post"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Column cards */}
                  <div className="flex-1 bg-muted/10 rounded-b-lg p-1.5 space-y-1.5 overflow-y-auto">
                    {columnPosts.map(post => {
                      const tlName = getTlName(post);
                      const showDate = post.scheduledFor;
                      let dateStr = '';
                      let timeStr = '';
                      if (showDate) {
                        const d = new Date(post.scheduledFor!);
                        dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const hh = String(d.getHours()).padStart(2, '0');
                        const mm = String(d.getMinutes()).padStart(2, '0');
                        if (`${hh}:${mm}` !== '00:00') timeStr = `${hh}:${mm}`;
                      }

                      return (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => {
                            const postTlId = (post as PipelinePost & { _tlId?: string })._tlId || activeTlIds[0];
                            router.push(`/post/${selectedCompany}/${postTlId}/${post.id}`);
                          }}
                          className="w-full text-left rounded-lg border bg-card p-2.5 transition-all hover:ring-1 hover:ring-primary/40 hover:shadow-sm cursor-pointer space-y-1.5"
                        >
                          {/* Title */}
                          <p className="text-sm font-medium leading-tight line-clamp-2">{post.title || 'Sem título'}</p>

                          {/* Tags row */}
                          <div className="flex flex-wrap gap-1">
                            {post.formato && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                {post.formato}
                              </span>
                            )}
                            {post.etapa && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                {post.etapa}
                              </span>
                            )}
                            {post.contentPillar && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                {post.contentPillar}
                              </span>
                            )}
                          </div>

                          {/* Meta row: date, time, profile */}
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            {showDate && (
                              <>
                                <CalIcon className="h-3 w-3" />
                                <span>{dateStr}</span>
                                {timeStr && (
                                  <>
                                    <Clock className="h-3 w-3 ml-0.5" />
                                    <span>{timeStr}</span>
                                  </>
                                )}
                              </>
                            )}
                            {tlFilter === 'all' && tlName && (
                              <>
                                {showDate && <span className="mx-0.5">·</span>}
                                <User className="h-3 w-3" />
                                <span className="truncate">{tlName}</span>
                              </>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}

        {/* Create Dialog */}
        <PipelineCreateDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          companyId={selectedCompany}
          defaultTlId={tlFilter !== 'all' ? tlFilter : companyTLs[0]?.id || null}
          tlOptions={companyTLs}
          showTlSelector={tlFilter === 'all' && companyTLs.length > 1}
          initialStatus={dialogInitialStatus}
          onCreated={fetchPosts}
          labels={{ statusLabel: getStatusLabel }}
        />
      </main>
    </>
  );
}
