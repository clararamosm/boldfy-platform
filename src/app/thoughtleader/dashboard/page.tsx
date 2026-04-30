'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2, CheckCircle2, XCircle, FileText,
  Calendar as CalIcon, ExternalLink, Plus,
  ThumbsUp, CircleDot, ClipboardList,
  ChevronDown, ChevronUp, Clock, TrendingUp,
} from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n/interpolate';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { completeOnboardingItem } from '@/hooks/use-onboarding';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';
import { buildGetStatusLabel, getStatusConfig } from '@/lib/pipeline-config';
import { cn } from '@/lib/utils';

// ─── Box configuration ────────────────────────────────────────
type BoxKey = 'aprovar_post' | 'aprovar_ideia' | 'backlog';

const BOX_CONFIG: { key: BoxKey; statuses: PipelineStatus[]; icon: typeof ThumbsUp }[] = [
  { key: 'aprovar_post', statuses: ['aprovar_post'], icon: ThumbsUp },
  { key: 'aprovar_ideia', statuses: ['aprovar_ideia'], icon: CircleDot },
  { key: 'backlog', statuses: ['backlog'], icon: ClipboardList },
];

// Statuses that go into the "Outros posts" section (grouped by month)
const SECONDARY_STATUSES: PipelineStatus[] = [
  'em_producao', 'post_aprovado', 'pronto_pra_postar', 'agendado', 'postado', 'ajuste',
];

// ─── Month grouping helpers ───────────────────────────────────
function getMonthKey(post: PipelinePost): string {
  const date = post.scheduledFor
    ? new Date(post.scheduledFor)
    : null;
  if (!date || isNaN(date.getTime())) return 'sem-data';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string): string {
  if (key === 'sem-data') return 'Sem data';
  const [year, month] = key.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// ─── Main Page ────────────────────────────────────────────────
export default function ThoughtLeaderDashboardPage() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingPostId, setRejectingPostId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newIdeaTitle, setNewIdeaTitle] = useState('');
  const [showIdeaInput, setShowIdeaInput] = useState(false);
  const [addingIdea, setAddingIdea] = useState(false);
  // Track which months are expanded in "Outros posts"
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Slugs for post navigation
  const [companySlug, setCompanySlug] = useState('');
  const [tlSlug, setTlSlug] = useState('');

  // Support strategist viewing TL backlog via ?userId=
  const targetUserId = searchParams.get('userId') || user?.uid;

  const getStatusLabel = buildGetStatusLabel(t);

  // ─── LinkedIn OAuth redirect ─────────────────────────────
  useEffect(() => {
    const linkedinStatus = searchParams.get('linkedin');
    if (linkedinStatus === 'success') {
      toast({ title: 'LinkedIn conectado!', description: 'Sua conta do LinkedIn foi vinculada com sucesso.' });
      completeOnboardingItem(user?.uid, 'connect-linkedin');
      router.replace(window.location.pathname);
    } else if (linkedinStatus === 'error') {
      const message = searchParams.get('message') || 'Erro ao conectar com LinkedIn.';
      toast({ variant: 'destructive', title: 'Erro no LinkedIn', description: message });
      router.replace(window.location.pathname);
    }
  }, [searchParams, user?.uid, toast, router]);

  // ─── Slugs ───────────────────────────────────────────────
  useEffect(() => {
    if (!targetUserId || !user?.companyId) return;
    const fetchSlugs = async () => {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const { generateSlug } = await import('@/lib/slugify');
        const tlDoc = await getDoc(doc(db, 'users', targetUserId));
        const tlData = tlDoc.data();
        const tlName = tlData?.name || tlData?.profile?.name || '';
        setTlSlug((tlData?.slug as string) || generateSlug(tlName, targetUserId));
        const compDoc = await getDoc(doc(db, 'companies', user.companyId!));
        const compData = compDoc.data();
        const compName = compData?.companyName || '';
        setCompanySlug((compData?.slug as string) || generateSlug(compName, user.companyId!));
      } catch {
        setCompanySlug(user?.companyId || '');
        setTlSlug(targetUserId);
      }
    };
    fetchSlugs();
  }, [targetUserId, user?.companyId]);

  // ─── Fetch posts ─────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!targetUserId) return;
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const { getPipelinePosts } = await import('@/app/actions/content-pipeline');
      const result = await getPipelinePosts(token, targetUserId, null);
      if (result.posts) setPosts(result.posts);
    } catch (error) {
      console.error('Error fetching pipeline posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // ─── Actions ─────────────────────────────────────────────
  const handleApproveIdea = async (postId: string) => {
    setActionLoading(postId);
    try {
      const token = await getAuthToken();
      const { approvePipelineIdea } = await import('@/app/actions/content-pipeline');
      const result = await approvePipelineIdea(token, postId);
      if (result.success) fetchPosts();
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprovePost = async (postId: string) => {
    setActionLoading(postId);
    try {
      const token = await getAuthToken();
      const { approvePipelinePost } = await import('@/app/actions/content-pipeline');
      const result = await approvePipelinePost(token, postId);
      if (result.success) fetchPosts();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestAdjustment = async () => {
    if (!rejectingPostId) return;
    setActionLoading(rejectingPostId);
    try {
      const token = await getAuthToken();
      const { requestPipelineAdjustment } = await import('@/app/actions/content-pipeline');
      const result = await requestPipelineAdjustment(token, rejectingPostId, feedback);
      if (result.success) {
        setRejectDialogOpen(false);
        setRejectingPostId(null);
        setFeedback('');
        fetchPosts();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddIdea = async () => {
    if (!newIdeaTitle.trim()) return;
    setAddingIdea(true);
    try {
      const token = await getAuthToken();
      const { createPipelineIdea } = await import('@/app/actions/content-pipeline');
      const result = await createPipelineIdea(token, newIdeaTitle.trim());
      if (result.success) {
        setNewIdeaTitle('');
        setShowIdeaInput(false);
        fetchPosts();
      }
    } finally {
      setAddingIdea(false);
    }
  };

  const openRejectDialog = (postId: string) => {
    setRejectingPostId(postId);
    setFeedback('');
    setRejectDialogOpen(true);
  };

  const navigateToPost = (postId: string) => {
    router.push(`/post/${companySlug || user?.companyId}/${tlSlug || targetUserId}/${postId}`);
  };

  const toggleMonth = (key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─── Group posts ──────────────────────────────────────────
  const grouped: Record<BoxKey, PipelinePost[]> = {
    aprovar_post: [],
    aprovar_ideia: [],
    backlog: [],
  };
  const secondaryPosts: PipelinePost[] = [];

  for (const post of posts) {
    if (post.status === 'aprovar_post') grouped.aprovar_post.push(post);
    else if (post.status === 'aprovar_ideia') grouped.aprovar_ideia.push(post);
    else if (post.status === 'backlog') grouped.backlog.push(post);
    else if (SECONDARY_STATUSES.includes(post.status)) secondaryPosts.push(post);
  }

  // Group secondary posts by month (scheduledFor), sorted newest first
  const secondaryByMonth = secondaryPosts.reduce<Record<string, PipelinePost[]>>((acc, post) => {
    const key = getMonthKey(post);
    if (!acc[key]) acc[key] = [];
    acc[key].push(post);
    return acc;
  }, {});

  // Sort months newest first, with 'sem-data' at the end
  const sortedMonthKeys = Object.keys(secondaryByMonth).sort((a, b) => {
    if (a === 'sem-data') return 1;
    if (b === 'sem-data') return -1;
    return b.localeCompare(a);
  });

  // ─── KPI counts ───────────────────────────────────────────
  const published = posts.filter(p => p.status === 'postado').length;
  const scheduled = posts.filter(p => p.status === 'agendado').length;
  const pendingApproval = grouped.aprovar_post.length + grouped.aprovar_ideia.length;
  const inProduction = posts.filter(p => p.status === 'em_producao' || p.status === 'pronto_pra_postar' || p.status === 'post_aprovado').length;

  // ─── Box label helpers ────────────────────────────────────
  const boxLabel = (key: BoxKey) => {
    switch (key) {
      case 'aprovar_post': return t.contentPipeline.status.aprovarPost;
      case 'aprovar_ideia': return t.contentPipeline.status.aprovarIdeia;
      case 'backlog': return t.contentPipeline.status.backlog;
    }
  };

  const isTL = user?.role === 'thoughtleader';

  // ─── Loading state ────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <Header title={t.thoughtLeader.backlogTitle} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title={t.thoughtLeader.backlogTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">

        {/* ─── Top bar: greeting + botão Adicionar Ideia ──── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold leading-tight">
              {interpolate(t.thoughtLeader.greeting, { name: (user?.name || '').split(' ')[0] })}
            </h2>
            <p className="text-muted-foreground text-sm">{t.thoughtLeader.backlogDescription}</p>
          </div>
          {isTL && (
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => setShowIdeaInput(v => !v)}
            >
              <Plus className="h-4 w-4" />
              Adicionar Ideia
            </Button>
          )}
        </div>

        {/* ─── Inline add idea input ────────────────────── */}
        {showIdeaInput && (
          <div className="flex gap-2">
            <Input
              value={newIdeaTitle}
              onChange={e => setNewIdeaTitle(e.target.value)}
              placeholder="Título da ideia..."
              className="h-9 text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleAddIdea(); }}
              disabled={addingIdea}
              autoFocus
            />
            <Button
              size="sm"
              className="h-9 px-4"
              onClick={handleAddIdea}
              disabled={!newIdeaTitle.trim() || addingIdea}
            >
              {addingIdea ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={() => { setShowIdeaInput(false); setNewIdeaTitle(''); }}
              disabled={addingIdea}
            >
              Cancelar
            </Button>
          </div>
        )}

        {/* ─── KPI mini-cards ───────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50">
              <FileText className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">{t.thoughtLeader.postsPublished}</p>
              <p className="text-xl font-bold leading-none">{published}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-50">
              <CalIcon className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">{t.thoughtLeader.postsScheduled}</p>
              <p className="text-xl font-bold leading-none">{scheduled}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-50">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">{t.thoughtLeader.pendingApproval}</p>
              <p className="text-xl font-bold leading-none">{pendingApproval}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-50">
              <TrendingUp className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground leading-none mb-1">Em produção</p>
              <p className="text-xl font-bold leading-none">{inProduction}</p>
            </div>
          </div>
        </div>

        {/* ─── 3 Boxes ─────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BOX_CONFIG.map(({ key, icon: Icon }) => {
            const items = grouped[key];
            const config = getStatusConfig(key === 'backlog' ? 'backlog' : key);

            return (
              <Card key={key} className="flex flex-col">
                {/* Box header */}
                <div className="flex items-center gap-2 px-4 pt-4 pb-2">
                  <span className={cn('flex items-center justify-center h-7 w-7 rounded-md', config.badge)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="font-semibold text-sm">{boxLabel(key)}</h3>
                  {items.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {items.length}
                    </Badge>
                  )}
                </div>

                {/* Cards */}
                <CardContent className="flex-1 space-y-2 px-3 pb-3 pt-0">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                      <FileText className="h-8 w-8 mb-2" />
                      <span className="text-xs">Nenhum item</span>
                    </div>
                  ) : (
                    items.map(post => (
                      <BacklogCard
                        key={post.id}
                        post={post}
                        statusLabel={getStatusLabel(post.status)}
                        statusConfig={config}
                        isTL={!!isTL}
                        actionLoading={actionLoading}
                        onNavigate={() => navigateToPost(post.id)}
                        onApproveIdea={() => handleApproveIdea(post.id)}
                        onApprovePost={() => handleApprovePost(post.id)}
                        onReject={() => openRejectDialog(post.id)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ─── Outros posts por mês ─────────────────────── */}
        {sortedMonthKeys.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Outros posts
            </h3>
            {sortedMonthKeys.map(monthKey => {
              const monthPosts = secondaryByMonth[monthKey].sort((a, b) => {
                // Ordenar por scheduledFor dentro do mês (mais recente primeiro)
                const da = a.scheduledFor ? new Date(a.scheduledFor).getTime() : 0;
                const db2 = b.scheduledFor ? new Date(b.scheduledFor).getTime() : 0;
                return db2 - da;
              });
              const isExpanded = expandedMonths.has(monthKey);

              return (
                <div key={monthKey} className="rounded-lg border bg-card overflow-hidden">
                  {/* Month header — sempre visível, clicável */}
                  <button
                    type="button"
                    onClick={() => toggleMonth(monthKey)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {formatMonthLabel(monthKey)}
                      </span>
                      <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {monthPosts.length} {monthPosts.length === 1 ? 'post' : 'posts'}
                      </span>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {/* Posts do mês — só aparecem quando expandido */}
                  {isExpanded && (
                    <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 border-t">
                      {monthPosts.map(post => {
                        const cfg = getStatusConfig(post.status);
                        return (
                          <button
                            key={post.id}
                            type="button"
                            onClick={() => navigateToPost(post.id)}
                            className="text-left rounded-md border bg-background p-3 transition-all hover:ring-1 hover:ring-primary/40 hover:shadow-sm space-y-1.5 mt-3"
                          >
                            <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
                              {post.title || post.caption?.slice(0, 60) || 'Sem título'}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
                                <span className={cn('inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold', cfg.badge)}>
                                  {getStatusLabel(post.status)}
                                </span>
                              </div>
                              {post.scheduledFor && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <CalIcon className="h-3 w-3" />
                                  {new Date(post.scheduledFor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </span>
                              )}
                              {post.formato && (
                                <span className="text-[10px] text-muted-foreground">{post.formato}</span>
                              )}
                            </div>
                            {post.tlFeedback && post.status === 'ajuste' && (
                              <p className="text-[10px] text-red-500 line-clamp-1">↩ {post.tlFeedback}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Empty state ─────────────────────────────── */}
        {posts.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t.contentPipeline.noPostsInStatus}</p>
            </CardContent>
          </Card>
        )}

        {/* ─── Rejection Dialog ────────────────────────── */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.contentPipeline.requestChanges}</DialogTitle>
              <DialogDescription>{t.contentPipeline.changeNotes}</DialogDescription>
            </DialogHeader>
            <Textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder={t.contentPipeline.rejectionReason}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleRequestAdjustment}
                disabled={!feedback.trim() || actionLoading !== null}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                {t.contentPipeline.requestChanges}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

// ─── Backlog Card Component ───────────────────────────────────

function BacklogCard({
  post,
  statusLabel,
  statusConfig,
  isTL,
  actionLoading,
  onNavigate,
  onApproveIdea,
  onApprovePost,
  onReject,
}: {
  post: PipelinePost;
  statusLabel: string;
  statusConfig: { badge: string; dot: string };
  isTL: boolean;
  actionLoading: string | null;
  onNavigate: () => void;
  onApproveIdea: () => void;
  onApprovePost: () => void;
  onReject: () => void;
}) {
  const loading = actionLoading === post.id;
  const displayTitle = post.title || post.caption?.slice(0, 50) || 'Sem título';

  return (
    <div className="rounded-md border bg-card p-3 space-y-2 transition-all hover:shadow-sm">
      {/* Title + View button */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onNavigate}
          className="text-left flex-1 min-w-0 group"
        >
          <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {displayTitle}
          </p>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onNavigate}
          title="Ver post"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>

      {/* Status + Date */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusConfig.dot)} />
          <span className={cn('inline-flex items-center px-1.5 py-px rounded text-[10px] font-semibold', statusConfig.badge)}>
            {statusLabel}
          </span>
        </div>
        {post.scheduledFor && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <CalIcon className="h-3 w-3" />
            {new Date(post.scheduledFor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
        {post.formato && (
          <span className="text-[10px] text-muted-foreground">{post.formato}</span>
        )}
      </div>

      {/* Feedback banner */}
      {post.tlFeedback && (
        <div className="p-2 bg-destructive/10 rounded text-xs text-destructive">
          <strong>Feedback:</strong> {post.tlFeedback}
        </div>
      )}

      {/* Action buttons (TL only) */}
      {isTL && post.status === 'aprovar_ideia' && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={onApproveIdea} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Aprovar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onReject} disabled={loading}>
            <XCircle className="h-3.5 w-3.5" />
            Ajuste
          </Button>
        </div>
      )}

      {isTL && post.status === 'aprovar_post' && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs gap-1" onClick={onApprovePost} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Aprovar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onReject} disabled={loading}>
            <XCircle className="h-3.5 w-3.5" />
            Ajuste
          </Button>
        </div>
      )}
    </div>
  );
}
