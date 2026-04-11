'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, XCircle, FileText, Calendar as CalIcon, ExternalLink } from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';

export default function ThoughtLeaderBacklogPage() {
  const { user } = useAuth();
  const t = useT();
  const router = useRouter();
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | 'all'>('all');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingPostId, setRejectingPostId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Also support strategist viewing TL backlog via ?userId=
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const targetUserId = searchParams?.get('userId') || user?.uid;

  const fetchPosts = useCallback(async () => {
    if (!targetUserId) return;
    setIsLoading(true);
    try {
      const token = await getAuthToken();
      const { getPipelinePosts } = await import('@/app/actions/content-pipeline');
      const filter = statusFilter === 'all' ? null : statusFilter;
      const result = await getPipelinePosts(token, targetUserId, filter);
      if (result.posts) {
        setPosts(result.posts);
      }
    } catch (error) {
      console.error('Error fetching pipeline posts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [targetUserId, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleApproveIdea = async (postId: string) => {
    setActionLoading(postId);
    try {
      const token = await getAuthToken();
      const { approvePipelineIdea } = await import('@/app/actions/content-pipeline');
      const result = await approvePipelineIdea(token, postId);
      if (result.success) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Error approving idea:', error);
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
      if (result.success) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Error approving post:', error);
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
    } catch (error) {
      console.error('Error requesting adjustment:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (postId: string) => {
    setRejectingPostId(postId);
    setFeedback('');
    setRejectDialogOpen(true);
  };

  const getStatusBadgeVariant = (status: PipelineStatus) => {
    switch (status) {
      case 'aprovar_ideia':
      case 'aprovar_post':
        return 'default';
      case 'em_producao':
        return 'secondary';
      case 'pronto_pra_postar':
      case 'post_aprovado':
        return 'default';
      case 'postado':
        return 'default';
      case 'ajuste':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: PipelineStatus) => {
    const map: Record<PipelineStatus, string> = {
      backlog: t.contentPipeline.status.backlog,
      aprovar_ideia: t.contentPipeline.status.aprovarIdeia,
      em_producao: t.contentPipeline.status.emProducao,
      aprovar_post: t.contentPipeline.status.aprovarPost,
      post_aprovado: t.contentPipeline.status.postAprovado,
      pronto_pra_postar: t.contentPipeline.status.prontoPraPostar,
      postado: t.contentPipeline.status.postado,
      ajuste: 'Ajuste',
      arquivado: 'Arquivado',
    };
    return map[status] || status;
  };

  // TL-relevant statuses to show in filter
  const filterStatuses: { value: PipelineStatus | 'all'; label: string }[] = [
    { value: 'all', label: t.contentPipeline.allStatuses },
    { value: 'aprovar_ideia', label: t.contentPipeline.status.aprovarIdeia },
    { value: 'em_producao', label: t.contentPipeline.status.emProducao },
    { value: 'aprovar_post', label: t.contentPipeline.status.aprovarPost },
    { value: 'pronto_pra_postar', label: t.contentPipeline.status.prontoPraPostar },
    { value: 'postado', label: t.contentPipeline.status.postado },
  ];

  return (
    <>
      <Header title={t.thoughtLeader.backlogTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-muted-foreground text-sm">{t.thoughtLeader.backlogDescription}</p>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PipelineStatus | 'all')}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={t.contentPipeline.filterByStatus} />
            </SelectTrigger>
            <SelectContent>
              {filterStatuses.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t.contentPipeline.noPostsInStatus}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {posts.map(post => (
              <Card key={post.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex-1">{post.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => router.push(`/post/${user?.companyId}/${targetUserId}/${post.id}`)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ver
                      </Button>
                      <Badge variant={getStatusBadgeVariant(post.status)}>
                        {getStatusLabel(post.status)}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-3 text-xs">
                    {post.editorial && <span>{post.editorial}</span>}
                    {post.etapa && <span>• {post.etapa}</span>}
                    {post.formato && <span>• {post.formato}</span>}
                    {post.scheduledFor && (
                      <span className="flex items-center gap-1">
                        <CalIcon className="h-3 w-3" />
                        {new Date(post.scheduledFor).toLocaleDateString()}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {post.caption && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{post.caption}</p>
                  )}
                  {post.tlFeedback && (
                    <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
                      <strong>Feedback:</strong> {post.tlFeedback}
                    </div>
                  )}

                  {/* Action buttons for TL */}
                  {post.status === 'aprovar_ideia' && user?.role === 'thoughtleader' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleApproveIdea(post.id)}
                        disabled={actionLoading === post.id}
                      >
                        {actionLoading === post.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                        )}
                        {t.contentPipeline.approveIdea}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectDialog(post.id)}
                        disabled={actionLoading === post.id}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {t.contentPipeline.requestChanges}
                      </Button>
                    </div>
                  )}

                  {post.status === 'aprovar_post' && user?.role === 'thoughtleader' && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprovePost(post.id)}
                        disabled={actionLoading === post.id}
                      >
                        {actionLoading === post.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                        )}
                        {t.contentPipeline.approvePost}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openRejectDialog(post.id)}
                        disabled={actionLoading === post.id}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {t.contentPipeline.requestChanges}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Rejection/Adjustment Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t.contentPipeline.requestChanges}</DialogTitle>
              <DialogDescription>{t.contentPipeline.changeNotes}</DialogDescription>
            </DialogHeader>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
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
