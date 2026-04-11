'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, FileText, Calendar as CalIcon, Pencil, Users, Clock, Tag, Layers, LayoutGrid, SquareCheck, Bookmark } from "lucide-react";
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

export default function StrategistPipelinePage() {
  const { user } = useAuth();
  const t = useT();
  const searchParams = useSearchParams();
  const urlCompanyId = searchParams.get('companyId');
  const urlTlId = searchParams.get('tlId');
  const appliedUrlParams = useRef(false);
  const [thoughtLeaders, setThoughtLeaders] = useState<TLSummary[]>([]);
  const [selectedTL, setSelectedTL] = useState<string | null>(null);
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPostsLoading, setIsPostsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | 'all'>('all');

  // Dynamic content pillars from TL's strategy
  const [contentPillars, setContentPillars] = useState<string[]>([]);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PipelinePost | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    caption: '',
    scheduledFor: '',
    scheduledTime: '10:00',
    status: 'backlog' as PipelineStatus,
    editorial: '',
    etapa: '',
    formato: '',
    contentPillar: '',
    leadMagnet: false,
  });
  const [formLoading, setFormLoading] = useState(false);

  // Fetch TLs
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
          if (urlTlId && allTLs.some(tl => tl.id === urlTlId)) {
            setSelectedTL(urlTlId);
          } else if (urlCompanyId) {
            const firstMatch = allTLs.find(tl => tl.companyId === urlCompanyId);
            setSelectedTL(firstMatch ? firstMatch.id : allTLs[0]?.id || null);
          } else if (allTLs.length > 0) {
            setSelectedTL(allTLs[0].id);
          }
          appliedUrlParams.current = true;
        } else if (allTLs.length > 0 && !selectedTL) {
          setSelectedTL(allTLs[0].id);
        }
      } catch (error) {
        console.error('Error fetching TLs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTLs();
  }, [user?.uid]);

  // Fetch content pillars from TL's strategy
  useEffect(() => {
    if (!selectedTL) {
      setContentPillars([]);
      return;
    }

    const fetchPillars = async () => {
      try {
        const token = await getAuthToken();
        const { getContentStrategy } = await import('@/app/actions/content-strategy');
        const result = await getContentStrategy(token, selectedTL);
        if (result.data?.pillars) {
          const names = result.data.pillars
            .map(p => p.name)
            .filter(Boolean);
          setContentPillars(names);
        } else {
          setContentPillars([]);
        }
      } catch {
        setContentPillars([]);
      }
    };

    fetchPillars();
  }, [selectedTL]);

  // Fetch posts for selected TL
  const fetchPosts = useCallback(async () => {
    if (!selectedTL) return;
    setIsPostsLoading(true);
    try {
      const token = await getAuthToken();
      const { getPipelinePosts } = await import('@/app/actions/content-pipeline');
      const filter = statusFilter === 'all' ? null : statusFilter;
      const result = await getPipelinePosts(token, selectedTL, filter);
      if (result.posts) {
        setPosts(result.posts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setIsPostsLoading(false);
    }
  }, [selectedTL, statusFilter]);

  useEffect(() => {
    if (selectedTL) {
      fetchPosts();
    }
  }, [selectedTL, fetchPosts]);

  // Open create dialog
  const openCreateDialog = () => {
    setEditingPost(null);
    setFormData({
      title: '',
      caption: '',
      scheduledFor: '',
      scheduledTime: '10:00',
      status: 'backlog',
      editorial: '',
      etapa: '',
      formato: '',
      contentPillar: '',
      leadMagnet: false,
    });
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (post: PipelinePost) => {
    setEditingPost(post);
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
      editorial: post.editorial,
      etapa: post.etapa,
      formato: post.formato,
      contentPillar: post.contentPillar || '',
      leadMagnet: post.leadMagnet,
    });
    setDialogOpen(true);
  };

  // Submit create or edit
  const handleSubmit = async () => {
    if (!selectedTL || !formData.title.trim()) return;
    setFormLoading(true);
    try {
      const token = await getAuthToken();
      let scheduledFor: string | null = null;
      if (formData.scheduledFor) {
        const time = formData.scheduledTime || '10:00';
        scheduledFor = new Date(`${formData.scheduledFor}T${time}:00`).toISOString();
      }

      const postPayload = {
        title: formData.title,
        caption: formData.caption,
        scheduledFor,
        status: formData.status,
        editorial: formData.editorial,
        etapa: formData.etapa,
        formato: formData.formato,
        contentPillar: formData.contentPillar,
        leadMagnet: formData.leadMagnet,
      };

      if (editingPost) {
        const { updatePipelinePost } = await import('@/app/actions/content-pipeline');
        await updatePipelinePost(token, selectedTL, editingPost.id, postPayload);
      } else {
        const { createPipelinePost } = await import('@/app/actions/content-pipeline');
        await createPipelinePost(token, selectedTL, postPayload);
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

  const getStatusColor = (status: PipelineStatus) => {
    const map: Record<PipelineStatus, string> = {
      backlog: 'bg-gray-100 text-gray-600',
      aprovar_ideia: 'bg-amber-100 text-amber-700',
      em_producao: 'bg-blue-100 text-blue-700',
      aprovar_post: 'bg-orange-100 text-orange-700',
      post_aprovado: 'bg-emerald-100 text-emerald-700',
      pronto_pra_postar: 'bg-green-100 text-green-700',
      postado: 'bg-[#0A66C2]/10 text-[#0A66C2]',
      ajuste: 'bg-red-100 text-red-700',
      arquivado: 'bg-gray-100 text-gray-500',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  const allStatuses: PipelineStatus[] = [
    'backlog', 'aprovar_ideia', 'em_producao', 'aprovar_post',
    'post_aprovado', 'pronto_pra_postar', 'postado', 'ajuste', 'arquivado',
  ];

  const filterStatuses: { value: PipelineStatus | 'all'; label: string }[] = [
    { value: 'all', label: t.contentPipeline.allStatuses },
    ...allStatuses.map(s => ({ value: s, label: getStatusLabel(s) })),
  ];

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
        {/* TL selector + filter + create */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={selectedTL || ''} onValueChange={setSelectedTL}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Selecionar Thought Leader" />
            </SelectTrigger>
            <SelectContent>
              {thoughtLeaders.map(tl => (
                <SelectItem key={tl.id} value={tl.id}>
                  {tl.name} ({tl.companyName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <Button onClick={openCreateDialog} disabled={!selectedTL}>
            <Plus className="h-4 w-4 mr-1" />
            {t.contentPipeline.newPost}
          </Button>
        </div>

        {/* Posts list */}
        {isPostsLoading ? (
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
          <div className="grid gap-3">
            {posts.map(post => (
              <Card key={post.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openEditDialog(post)}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{post.title}</CardTitle>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(post.status)}`}>
                        {getStatusLabel(post.status)}
                      </span>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {post.editorial && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        {post.editorial}
                      </span>
                    )}
                    {post.etapa && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {post.etapa}
                      </span>
                    )}
                    {post.formato && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {post.formato}
                      </span>
                    )}
                    {post.contentPillar && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        {post.contentPillar}
                      </span>
                    )}
                    {post.leadMagnet && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        Lead Magnet
                      </span>
                    )}
                    {post.scheduledFor && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CalIcon className="h-3 w-3" />
                        {new Date(post.scheduledFor).toLocaleDateString()}
                        {(() => {
                          const d = new Date(post.scheduledFor);
                          const hh = String(d.getHours()).padStart(2, '0');
                          const mm = String(d.getMinutes()).padStart(2, '0');
                          return `${hh}:${mm}` !== '00:00' ? ` ${hh}:${mm}` : '';
                        })()}
                      </span>
                    )}
                  </div>
                </CardHeader>
                {(post.caption || post.tlFeedback) && (
                  <CardContent className="pt-0 px-4 pb-3">
                    {post.caption && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{post.caption}</p>
                    )}
                    {post.tlFeedback && (
                      <div className="mt-1 p-1.5 bg-destructive/10 rounded text-xs text-destructive">
                        <strong>Feedback TL:</strong> {post.tlFeedback}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog — Notion-style wide layout */}
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
                    {allStatuses.map(s => (
                      <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              {/* Editorial */}
              <div className="flex items-center gap-3 min-h-[32px]">
                <div className="flex items-center gap-2 w-32 shrink-0 text-sm text-muted-foreground">
                  <Bookmark className="h-4 w-4" /> Editorial
                </div>
                <Select value={formData.editorial} onValueChange={(v) => setFormData(p => ({ ...p, editorial: v }))}>
                  <SelectTrigger className="h-8 w-auto min-w-[140px] border-0 bg-muted/50 hover:bg-muted">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Visão de Mercado">{t.contentPipeline.editorial.visaoMercado}</SelectItem>
                    <SelectItem value="Bastidores">{t.contentPipeline.editorial.bastidores}</SelectItem>
                    <SelectItem value="Decisões">{t.contentPipeline.editorial.decisoes}</SelectItem>
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
                    placeholder="Nenhum pilar definido — digite manualmente"
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

            {/* Content area — like Notion body */}
            <div className="px-6 py-4">
              <Textarea
                value={formData.caption}
                onChange={(e) => setFormData(p => ({ ...p, caption: e.target.value }))}
                placeholder="Escreva o conteúdo do post aqui..."
                rows={12}
                className="border-0 p-0 focus-visible:ring-0 resize-none text-sm leading-relaxed placeholder:text-muted-foreground/40"
              />
            </div>

            {/* TL Feedback (read-only, only show when editing) */}
            {editingPost?.tlFeedback && (
              <div className="mx-6 mb-4 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <strong>Feedback do TL:</strong> {editingPost.tlFeedback}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-3 border-t flex items-center justify-end gap-2 bg-muted/20">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSubmit} disabled={formLoading || !formData.title.trim()}>
                {formLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editingPost ? 'Salvar' : 'Criar Post'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
