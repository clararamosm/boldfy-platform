'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Loader2, Plus, FileText, Calendar as CalIcon, Users, Clock, Tag,
  Layers, LayoutGrid, SquareCheck, Upload, X, Image as ImageIcon, File,
  User, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import type { PipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';

type TLSummary = {
  id: string;
  name: string;
  companyId: string;
  companyName: string;
};

// ─── Status display config ──────
const STATUS_CONFIG: Record<PipelineStatus, { label: string; color: string; headerBg: string }> = {
  backlog:            { label: 'Backlog',          color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',             headerBg: 'border-gray-300 dark:border-gray-600' },
  aprovar_ideia:      { label: 'Aprovar Ideia',    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',      headerBg: 'border-amber-400 dark:border-amber-500' },
  em_producao:        { label: 'Em Produção',      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',          headerBg: 'border-blue-400 dark:border-blue-500' },
  aprovar_post:       { label: 'Aprovar Post',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',  headerBg: 'border-orange-400 dark:border-orange-500' },
  post_aprovado:      { label: 'Aprovado',         color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', headerBg: 'border-emerald-400 dark:border-emerald-500' },
  pronto_pra_postar:  { label: 'Pronto',           color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',      headerBg: 'border-green-500 dark:border-green-500' },
  postado:            { label: 'Postado',          color: 'bg-[#0A66C2]/10 text-[#0A66C2]',                                           headerBg: 'border-[#0A66C2]' },
  ajuste:             { label: 'Ajuste',           color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',              headerBg: 'border-red-400 dark:border-red-500' },
  arquivado:          { label: 'Arquivado',        color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',             headerBg: 'border-gray-300 dark:border-gray-500' },
};

const KANBAN_STATUSES: PipelineStatus[] = [
  'backlog', 'aprovar_ideia', 'em_producao', 'aprovar_post',
  'post_aprovado', 'pronto_pra_postar', 'postado', 'ajuste', 'arquivado',
];

const ALL_STATUSES: PipelineStatus[] = [...KANBAN_STATUSES];

export default function StrategistPipelinePage() {
  const { user } = useAuth();
  const t = useT();
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

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PipelinePost | null>(null);
  const [dialogTlId, setDialogTlId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    caption: '',
    scheduledFor: '',
    scheduledTime: '10:00',
    status: 'backlog' as PipelineStatus,
    etapa: '',
    formato: '',
    contentPillar: '',
    leadMagnet: false,
  });
  const [formLoading, setFormLoading] = useState(false);

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

  // Media upload
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ─── Posts grouped by status (for kanban) ──────
  const postsByStatus = useMemo(() => {
    const map: Record<string, PipelinePost[]> = {};
    KANBAN_STATUSES.forEach(s => { map[s] = []; });
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

  // ─── Media handling ──────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return;
    }

    setMediaFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(null);
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadMedia = async (tlId: string, postId: string): Promise<{ url: string; type: string } | null> => {
    if (!mediaFile) return null;
    setIsUploading(true);
    try {
      const ext = mediaFile.name.split('.').pop() || 'file';
      const path = `pipeline/${tlId}/${postId}/media.${ext}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, mediaFile);
      const url = await getDownloadURL(storageRef);
      const type = mediaFile.type.startsWith('image/') ? 'image' : 'pdf';
      return { url, type };
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // ─── Dialog handlers ──────
  const openCreateDialog = (forStatus: PipelineStatus = 'backlog') => {
    setEditingPost(null);
    // Use the first active TL or the filter value
    const targetTl = tlFilter !== 'all' ? tlFilter : companyTLs[0]?.id || null;
    setDialogTlId(targetTl);
    setFormData({
      title: '',
      caption: '',
      scheduledFor: '',
      scheduledTime: '10:00',
      status: forStatus,
      etapa: '',
      formato: '',
      contentPillar: '',
      leadMagnet: false,
    });
    clearMedia();
    setDialogOpen(true);
  };

  const openEditDialog = (post: PipelinePost) => {
    setEditingPost(post);
    const tlId = (post as PipelinePost & { _tlId?: string })._tlId || activeTlIds[0];
    setDialogTlId(tlId);
    let dateStr = post.scheduledFor || '';
    let timeStr = '10:00';
    if (dateStr && dateStr.includes('T')) {
      const d = new Date(dateStr);
      dateStr = d.toISOString().substring(0, 10);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      timeStr = `${hh}:${mm}`;
    }
    setFormData({
      title: post.title,
      caption: post.caption,
      scheduledFor: dateStr.substring(0, 10),
      scheduledTime: timeStr,
      status: post.status,
      etapa: post.etapa,
      formato: post.formato,
      contentPillar: post.contentPillar || '',
      leadMagnet: post.leadMagnet,
    });
    clearMedia();
    // Show existing media
    if (post.mediaUrl) {
      setMediaPreview(post.mediaType === 'image' ? post.mediaUrl : null);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!dialogTlId || !formData.title.trim()) return;
    setFormLoading(true);
    try {
      const token = await getAuthToken();
      let scheduledFor: string | null = null;
      if (formData.scheduledFor) {
        const time = formData.scheduledTime || '10:00';
        scheduledFor = new Date(`${formData.scheduledFor}T${time}:00`).toISOString();
      }

      const postPayload: Record<string, unknown> = {
        title: formData.title,
        caption: formData.caption,
        scheduledFor,
        status: formData.status,
        editorial: '',
        etapa: formData.etapa,
        formato: formData.formato,
        contentPillar: formData.contentPillar,
        leadMagnet: formData.leadMagnet,
      };

      if (editingPost) {
        // Upload media if new file selected
        if (mediaFile) {
          const media = await uploadMedia(dialogTlId, editingPost.id);
          if (media) {
            postPayload.mediaUrl = media.url;
            postPayload.mediaType = media.type;
          }
        }
        const { updatePipelinePost } = await import('@/app/actions/content-pipeline');
        await updatePipelinePost(token, dialogTlId, editingPost.id, postPayload as Parameters<typeof updatePipelinePost>[3]);
      } else {
        const { createPipelinePost } = await import('@/app/actions/content-pipeline');
        const result = await createPipelinePost(token, dialogTlId, postPayload as Parameters<typeof createPipelinePost>[2]);
        // Upload media for new post
        if (mediaFile && result.postId) {
          const media = await uploadMedia(dialogTlId, result.postId);
          if (media) {
            const { updatePipelinePost: update } = await import('@/app/actions/content-pipeline');
            await update(token, dialogTlId, result.postId, { mediaUrl: media.url, mediaType: media.type });
          }
        }
      }
      setDialogOpen(false);
      fetchPosts();
    } catch (error) {
      console.error('Error saving post:', error);
    } finally {
      setFormLoading(false);
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
            {KANBAN_STATUSES.map(status => {
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
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-t-2 bg-muted/30 ${cfg.headerBg}`}>
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
                          onClick={() => openEditDialog(post)}
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

        {/* Create/Edit Dialog — Notion-style editor */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
            {/* Title */}
            <div className="px-6 pt-6 pb-2">
              <Input
                value={formData.title}
                onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder="Título do post"
                className="text-xl font-semibold border-0 p-0 h-auto focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Properties — Notion-style rows */}
            <div className="px-6 py-3 border-y space-y-2">
              {/* Status */}
              <div className="flex items-center gap-3 min-h-[32px]">
                <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                  <SquareCheck className="h-4 w-4" /> Status
                </div>
                <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v as PipelineStatus }))}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-muted/50 hover:bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Perfil (TL) — only when filter is "all" */}
              {tlFilter === 'all' && companyTLs.length > 1 && (
                <div className="flex items-center gap-3 min-h-[32px]">
                  <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                    <User className="h-4 w-4" /> Perfil
                  </div>
                  <Select value={dialogTlId || ''} onValueChange={setDialogTlId}>
                    <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-muted/50 hover:bg-muted">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {companyTLs.map(tl => (
                        <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Etapa */}
              <div className="flex items-center gap-3 min-h-[32px]">
                <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                  <Layers className="h-4 w-4" /> Etapa
                </div>
                <Select value={formData.etapa} onValueChange={(v) => setFormData(p => ({ ...p, etapa: v }))}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-muted/50 hover:bg-muted">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Visibilidade">{t.contentPipeline.stage.visibilidade}</SelectItem>
                    <SelectItem value="Autoridade">{t.contentPipeline.stage.autoridade}</SelectItem>
                    <SelectItem value="Conversão">{t.contentPipeline.stage.conversao}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Formato */}
              <div className="flex items-center gap-3 min-h-[32px]">
                <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                  <LayoutGrid className="h-4 w-4" /> Formato
                </div>
                <Select value={formData.formato} onValueChange={(v) => setFormData(p => ({ ...p, formato: v }))}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-muted/50 hover:bg-muted">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vídeo">{t.contentPipeline.format.video}</SelectItem>
                    <SelectItem value="Texto">{t.contentPipeline.format.texto}</SelectItem>
                    <SelectItem value="GIF">{t.contentPipeline.format.gif}</SelectItem>
                    <SelectItem value="One Pager">{t.contentPipeline.format.onePager}</SelectItem>
                    <SelectItem value="Carrossel">{t.contentPipeline.format.carrossel}</SelectItem>
                    <SelectItem value="Foto">{t.contentPipeline.format.foto}</SelectItem>
                    <SelectItem value="Quote">{t.contentPipeline.format.quote}</SelectItem>
                    <SelectItem value="Meme">{t.contentPipeline.format.meme}</SelectItem>
                    <SelectItem value="Print">{t.contentPipeline.format.print}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Content Pillar — dynamic */}
              <div className="flex items-center gap-3 min-h-[32px]">
                <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                  <Tag className="h-4 w-4" /> Pilar
                </div>
                {contentPillars.length > 0 ? (
                  <Select value={formData.contentPillar} onValueChange={(v) => setFormData(p => ({ ...p, contentPillar: v }))}>
                    <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-muted/50 hover:bg-muted">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {contentPillars.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.contentPillar}
                    onChange={(e) => setFormData(p => ({ ...p, contentPillar: e.target.value }))}
                    placeholder="Nenhum pilar definido"
                    className="h-8 border-0 bg-muted/50 text-sm"
                  />
                )}
              </div>

              {/* Date + Time */}
              <div className="flex items-center gap-3 min-h-[32px]">
                <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                  <CalIcon className="h-4 w-4" /> Data
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={formData.scheduledFor}
                    onChange={(e) => setFormData(p => ({ ...p, scheduledFor: e.target.value }))}
                    className="h-8 w-auto border-0 bg-muted/50"
                  />
                  <Input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(p => ({ ...p, scheduledTime: e.target.value }))}
                    className="h-8 w-[100px] border-0 bg-muted/50"
                  />
                </div>
              </div>

              {/* Lead Magnet */}
              <div className="flex items-center gap-3 min-h-[32px]">
                <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                  <SquareCheck className="h-4 w-4" /> Lead Magnet
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, leadMagnet: !p.leadMagnet }))}
                  className={`h-5 w-5 rounded border flex items-center justify-center transition-colors ${formData.leadMagnet ? 'bg-primary border-primary text-primary-foreground' : 'bg-muted/50 border-muted-foreground/30'}`}
                >
                  {formData.leadMagnet && <span className="text-[10px]">✓</span>}
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="px-6 py-4">
              <Textarea
                value={formData.caption}
                onChange={(e) => setFormData(p => ({ ...p, caption: e.target.value }))}
                placeholder="Escreva o conteúdo do post aqui..."
                rows={10}
                className="border-0 p-0 focus-visible:ring-0 resize-none text-sm leading-relaxed placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Media upload area */}
            <div className="px-6 pb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Existing media or preview */}
              {(mediaPreview || (editingPost?.mediaUrl && editingPost?.mediaType === 'image' && !mediaFile)) ? (
                <div className="relative rounded-lg overflow-hidden border bg-muted/20 mb-2">
                  <img
                    src={mediaPreview || editingPost?.mediaUrl || ''}
                    alt="Mídia"
                    className="max-h-[200px] w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (editingPost?.mediaUrl && editingPost?.mediaType === 'pdf' && !mediaFile) ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/20 mb-2">
                  <File className="h-5 w-5 text-red-500" />
                  <span className="text-sm text-muted-foreground">PDF anexado</span>
                  <a href={editingPost.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline ml-auto">
                    Ver PDF
                  </a>
                </div>
              ) : mediaFile && !mediaPreview ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/20 mb-2">
                  <File className="h-5 w-5 text-red-500" />
                  <span className="text-sm truncate">{mediaFile.name}</span>
                  <button type="button" onClick={clearMedia} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                {editingPost?.mediaUrl || mediaFile ? 'Trocar mídia' : 'Adicionar mídia'}
                <span className="text-[10px] text-muted-foreground">(PNG, JPG, PDF)</span>
              </Button>
            </div>

            {/* TL Feedback (read-only) */}
            {editingPost?.tlFeedback && (
              <div className="mx-6 mb-4 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <strong>Feedback do TL:</strong> {editingPost.tlFeedback}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t flex items-center justify-end gap-2 bg-muted/20">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={formLoading || isUploading || !formData.title.trim()}>
                {(formLoading || isUploading) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editingPost ? 'Salvar' : 'Criar Post'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
