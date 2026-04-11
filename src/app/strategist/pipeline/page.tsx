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
import { Loader2, Plus, FileText, Calendar as CalIcon, Pencil, Users } from "lucide-react";
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
    leadMagnet: false,
  });
  const [formLoading, setFormLoading] = useState(false);

  // Fetch TLs
  useEffect(() => {
    if (!user?.uid) return;

    const fetchTLs = async () => {
      setIsLoading(true);
      try {
        // Use rawData from auth context as primary source, fallback to Firestore
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

        // Pre-select TL from URL params (sidebar navigation)
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
      leadMagnet: false,
    });
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (post: PipelinePost) => {
    setEditingPost(post);
    // Decompose ISO date into date + time
    let dateStr = post.scheduledFor || '';
    let timeStr = '10:00';
    if (dateStr && dateStr.includes('T')) {
      const d = new Date(dateStr);
      dateStr = d.toISOString().substring(0, 10);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      timeStr = `${hh}:${mm}`;
    } else if (dateStr && dateStr.length === 10) {
      // Already just a date (yyyy-MM-dd), keep default time
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
      // Compose date + time into ISO string
      let scheduledFor: string | null = null;
      if (formData.scheduledFor) {
        const time = formData.scheduledTime || '10:00';
        scheduledFor = new Date(`${formData.scheduledFor}T${time}:00`).toISOString();
      }

      if (editingPost) {
        const { updatePipelinePost } = await import('@/app/actions/content-pipeline');
        await updatePipelinePost(token, selectedTL, editingPost.id, {
          title: formData.title,
          caption: formData.caption,
          scheduledFor,
          status: formData.status,
          editorial: formData.editorial,
          etapa: formData.etapa,
          formato: formData.formato,
          leadMagnet: formData.leadMagnet,
        });
      } else {
        const { createPipelinePost } = await import('@/app/actions/content-pipeline');
        await createPipelinePost(token, selectedTL, {
          title: formData.title,
          caption: formData.caption,
          scheduledFor,
          status: formData.status,
          editorial: formData.editorial,
          etapa: formData.etapa,
          formato: formData.formato,
          leadMagnet: formData.leadMagnet,
        });
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

  const getStatusBadgeVariant = (status: PipelineStatus) => {
    switch (status) {
      case 'aprovar_ideia':
      case 'aprovar_post':
        return 'default' as const;
      case 'em_producao':
        return 'secondary' as const;
      case 'ajuste':
        return 'destructive' as const;
      case 'postado':
        return 'default' as const;
      default:
        return 'outline' as const;
    }
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
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(post.status)} className="text-xs">
                        {getStatusLabel(post.status)}
                      </Badge>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    {post.editorial && <span>{post.editorial}</span>}
                    {post.etapa && <span>• {post.etapa}</span>}
                    {post.formato && <span>• {post.formato}</span>}
                    {post.scheduledFor && (
                      <span className="flex items-center gap-1">
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
                  </CardDescription>
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

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPost ? 'Editar Post' : t.contentPipeline.newPost}</DialogTitle>
              <DialogDescription>
                {editingPost ? 'Atualize as informações do post.' : 'Crie um novo post no pipeline.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>{t.contentPipeline.postTitle}</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                  placeholder="Título do post"
                />
              </div>

              <div className="grid gap-2">
                <Label>{t.contentPipeline.postCaption}</Label>
                <Textarea
                  value={formData.caption}
                  onChange={(e) => setFormData(p => ({ ...p, caption: e.target.value }))}
                  placeholder="Legenda do post"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>{t.contentPipeline.postDate}</Label>
                  <Input
                    type="date"
                    value={formData.scheduledFor}
                    onChange={(e) => setFormData(p => ({ ...p, scheduledFor: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Horário</Label>
                  <Input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData(p => ({ ...p, scheduledTime: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v as PipelineStatus }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allStatuses.map(s => (
                        <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>{t.contentPipeline.postEditorial}</Label>
                  <Select value={formData.editorial} onValueChange={(v) => setFormData(p => ({ ...p, editorial: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Visão de Mercado">{t.contentPipeline.editorial.visaoMercado}</SelectItem>
                      <SelectItem value="Bastidores">{t.contentPipeline.editorial.bastidores}</SelectItem>
                      <SelectItem value="Decisões">{t.contentPipeline.editorial.decisoes}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t.contentPipeline.postStage}</Label>
                  <Select value={formData.etapa} onValueChange={(v) => setFormData(p => ({ ...p, etapa: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Visibilidade">{t.contentPipeline.stage.visibilidade}</SelectItem>
                      <SelectItem value="Autoridade">{t.contentPipeline.stage.autoridade}</SelectItem>
                      <SelectItem value="Conversão">{t.contentPipeline.stage.conversao}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t.contentPipeline.postFormat}</Label>
                  <Select value={formData.formato} onValueChange={(v) => setFormData(p => ({ ...p, formato: v }))}>
                    <SelectTrigger>
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
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={formLoading || !formData.title.trim()}>
                {formLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editingPost ? 'Salvar' : 'Criar Post'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
