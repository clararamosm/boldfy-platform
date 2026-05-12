// src/app/colaborador/calendario/novo/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthToken } from '@/lib/auth-client';
import { createScheduledPost, updateScheduledPost, getScheduledPost } from '@/app/actions/posts';
import { publishToLinkedIn, getLinkedInStatus } from '@/app/actions/linkedin';
import { completeOnboardingItem } from '@/hooks/use-onboarding';
import {
  CalendarDays,
  Loader2,
  Linkedin,
  ArrowLeft,
  X,
  Upload,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useT, useLocale } from '@/lib/i18n/context';
import { getDateLocale } from '@/lib/i18n/date-utils';
import { resolvePersonalBrand } from '@/lib/personal-brand';
import { getPillarClasses } from '@/lib/pillar-colors';
import { mergePostFormats, isDefaultFormat, DEFAULT_POST_FORMATS } from '@/lib/post-formats';
import { saveCustomPostFormats } from '@/app/actions/posts';
import type { PersonalBrandPillar } from '@/types/personal-brand';

function EditorContent() {
  const t = useT();
  const locale = useLocale();
  const dateFnsLocale = getDateLocale(locale);
  const { user: authUser } = useAuth();
  const userId = authUser?.uid || null;
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [showTip, setShowTip] = useState(false);
  // Pilar e formato do post (persistidos em ScheduledPost.contentPillar / .formato).
  // Strings vazias = "nao definido"; campos opcionais no doc Firestore.
  // Rodada 4: `formato` agora e tipo de midia (texto livre — "Foto", "Carrossel",
  // ou custom do user). Pre-rodada-4 podia ser 'linkedin/text-heavy/hybrid' — posts
  // antigos ficam com esse valor literal ate o user editar.
  const [contentPillar, setContentPillar] = useState<string>('');
  const [formato, setFormato] = useState<string>('');
  const [pillars, setPillars] = useState<PersonalBrandPillar[]>([]);
  // Customs do user (gerenciados pelo Dialog "Gerenciar formatos")
  const [customFormats, setCustomFormats] = useState<string[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [savingFormats, setSavingFormats] = useState(false);
  const [newFormatInput, setNewFormatInput] = useState('');
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Edit mode ──────────────────────────────────────
  const editPostId = searchParams.get('edit');
  const isEditMode = !!editPostId;
  const [isLoadingPost, setIsLoadingPost] = useState(!!editPostId);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<string | null>(null);
  const [mediaRemoved, setMediaRemoved] = useState(false);

  // Populate from query params (only in create mode).
  // `formato` NÃO vem por query — assistente envia "estilo de escrita"
  // (conceito diferente). User escolhe tipo de mídia no editor mesmo.
  useEffect(() => {
    if (editPostId) return; // Skip — edit mode loads via separate effect
    const captionParam = searchParams.get('caption');
    const dateParam = searchParams.get('date');
    const pillarParam = searchParams.get('pillar');

    if (captionParam) {
      setCaption(captionParam);
    }
    if (dateParam) {
      try {
        const date = new Date(dateParam);
        setScheduledDate(format(date, 'yyyy-MM-dd'));
      } catch {
        // ignore invalid date
      }
    }
    if (pillarParam) setContentPillar(pillarParam);
  }, [searchParams, editPostId]);

  // Fetch pilares do colaborador + customs de formato pra popular dropdowns.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : {};
        const { brand } = resolvePersonalBrand(data);
        setPillars(brand.strategy?.pillars ?? []);
        const customs = Array.isArray(data?.customPostFormats)
          ? (data.customPostFormats as string[])
          : [];
        setCustomFormats(customs);
      } catch (err) {
        console.error('Failed to load pillars / custom formats:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Lista mesclada (defaults + custom) usada pelo Select.
  const allFormats = mergePostFormats(customFormats);

  // Handlers do dialog "Gerenciar formatos"
  const handleAddFormat = () => {
    const v = newFormatInput.trim();
    if (!v || v.length > 40) return;
    if (isDefaultFormat(v)) {
      toast({
        variant: 'destructive',
        title: 'Formato ja existe',
        description: `"${v}" ja esta nos formatos padrao.`,
      });
      return;
    }
    if (customFormats.some((c) => c.toLowerCase() === v.toLowerCase())) {
      toast({
        variant: 'destructive',
        title: 'Duplicado',
        description: 'Esse formato ja esta na sua lista.',
      });
      return;
    }
    setCustomFormats([...customFormats, v]);
    setNewFormatInput('');
  };

  const handleRemoveCustomFormat = (target: string) => {
    setCustomFormats(customFormats.filter((c) => c !== target));
  };

  const handlePersistFormats = async () => {
    if (!userId) return;
    setSavingFormats(true);
    try {
      const token = await getAuthToken();
      const result = await saveCustomPostFormats(token, userId, customFormats);
      if (result.success) {
        toast({ title: 'Formatos salvos' });
        setManageOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Erro ao salvar formatos', description: result.error });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido.';
      toast({ variant: 'destructive', title: 'Erro', description: msg });
    } finally {
      setSavingFormats(false);
    }
  };

  // Load existing post when in edit mode
  useEffect(() => {
    if (!editPostId || !userId) return;
    const fetchPost = async () => {
      setIsLoadingPost(true);
      try {
        const token = await getAuthToken();
        const result = await getScheduledPost(token, userId, editPostId);
        if (result.post) {
          setCaption(result.post.caption || '');
          if (result.post.scheduledFor) {
            const date = new Date(result.post.scheduledFor);
            setScheduledDate(format(date, 'yyyy-MM-dd'));
            setScheduledTime(format(date, 'HH:mm'));
          }
          if (result.post.mediaUrl) {
            setExistingMediaUrl(result.post.mediaUrl);
            setExistingMediaType(result.post.mediaType || null);
            setMediaPreview(result.post.mediaUrl);
          }
          if (result.post.contentPillar) setContentPillar(result.post.contentPillar);
          if (result.post.formato) setFormato(result.post.formato);
        } else if (result.error) {
          toast({ variant: 'destructive', title: t.common.error, description: result.error });
          router.push('/colaborador/calendario');
        }
      } catch (error) {
        console.error('Error fetching post for editing:', error);
      }
      setIsLoadingPost(false);
    };
    fetchPost();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPostId, userId]);

  // LinkedIn status check (só pra habilitar o botão "Publicar agora").
  useEffect(() => {
    if (!userId) return;
    setIsLoading(false);
    const checkLinkedIn = async () => {
      const tkn = await getAuthToken();
      const status = await getLinkedInStatus(tkn, userId);
      setLinkedinConnected(status.connected && !!status.tokenValid);
    };
    checkLinkedIn();
  }, [userId]);

  // Media file handling
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size limits: 200MB for video, 10MB for image/gif
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 200 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        variant: 'destructive',
        title: t.colabNewPost.fileTooLarge,
        description: isVideo ? 'Vídeo muito grande. Máximo: 200MB.' : t.colabNewPost.fileTooLargeDescription,
      });
      return;
    }

    setMediaFile(file);
    setMediaRemoved(false);
    if (isVideo) {
      // For video, create object URL instead of data URL (more efficient)
      setMediaPreview(URL.createObjectURL(file));
    } else {
      const reader = new FileReader();
      reader.onloadend = () => setMediaPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeMedia = () => {
    // Revoke object URL if it was created for video
    if (mediaPreview && mediaPreview.startsWith('blob:')) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setMediaRemoved(true);
  };

  // Submit (schedule for later)
  const handleSubmit = async () => {
    if (!userId) return;
    if (!caption.trim()) {
      toast({ variant: 'destructive', title: t.colabNewPost.captionRequired, description: t.colabNewPost.captionRequiredDescription });
      return;
    }
    if (!scheduledDate) {
      toast({ variant: 'destructive', title: t.colabNewPost.dateRequired, description: t.colabNewPost.dateRequiredDescription });
      return;
    }

    setIsSaving(true);

    try {
      // Upload media if present
      let mediaUrl: string | undefined;
      let mediaType: string | undefined;

      if (mediaFile) {
        const storageRef = ref(storage, `users/${userId}/posts/${Date.now()}_${mediaFile.name}`);
        const snapshot = await uploadBytes(storageRef, mediaFile);
        mediaUrl = await getDownloadURL(snapshot.ref);
        mediaType = mediaFile.type;
      }

      // Create ISO date from date + time
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

      const token = await getAuthToken();

      if (isEditMode && editPostId) {
        // ─── Update existing post ──────────────────
        const updateData: {
          caption: string;
          scheduledFor: string;
          mediaUrl?: string;
          mediaType?: string;
          contentPillar?: string;
          formato?: string;
        } = {
          caption,
          scheduledFor,
          contentPillar,
          ...(formato && { formato }),
        };

        if (mediaFile) {
          // New media uploaded
          updateData.mediaUrl = mediaUrl;
          updateData.mediaType = mediaType;
        } else if (mediaRemoved) {
          // Media was removed — send empty string so server action clears it (|| null)
          updateData.mediaUrl = '';
          updateData.mediaType = '';
        }
        // If neither: don't send media fields, preserves existing

        const result = await updateScheduledPost(token, userId, editPostId, updateData);
        if (result.success) {
          toast({ title: t.colabNewPost.postUpdated, description: t.colabNewPost.postUpdatedDescription });
          router.push('/colaborador/calendario');
        } else {
          toast({ variant: 'destructive', title: t.common.error, description: result.error });
        }
      } else {
        // ─── Create new post ──────────────────────
        const result = await createScheduledPost(token, userId, {
          caption,
          mediaUrl,
          mediaType,
          scheduledFor,
          ...(contentPillar && { contentPillar }),
          ...(formato && { formato }),
        });

        if (result.success) {
          toast({ title: t.colabNewPost.postScheduled, description: t.colabNewPost.postScheduledDescription });
          completeOnboardingItem(userId ?? undefined, 'schedule-content');
          router.push('/colaborador/calendario');
        } else {
          toast({ variant: 'destructive', title: t.common.error, description: result.error });
        }
      }
    } catch (error) {
      console.error('Error saving post:', error);
      toast({ variant: 'destructive', title: t.common.error, description: t.colabNewPost.scheduleError });
    }

    setIsSaving(false);
  };

  // Publish immediately to LinkedIn
  const handlePublishNow = async () => {
    if (!userId) return;
    if (!caption.trim()) {
      toast({ variant: 'destructive', title: t.colabNewPost.captionRequired, description: t.colabNewPost.captionRequiredDescription });
      return;
    }

    setIsPublishing(true);

    try {
      // Upload media to Firebase Storage first if present
      let mediaUrl: string | undefined;

      if (mediaFile) {
        const storageRef = ref(storage, `users/${userId}/posts/${Date.now()}_${mediaFile.name}`);
        const snapshot = await uploadBytes(storageRef, mediaFile);
        mediaUrl = await getDownloadURL(snapshot.ref);
      } else if (existingMediaUrl && !mediaRemoved) {
        // Use existing media from edit mode
        mediaUrl = existingMediaUrl;
      }

      const token = await getAuthToken();

      if (isEditMode && editPostId) {
        // ─── Edit mode: update post then publish ──────
        const updateData: {
          caption: string;
          scheduledFor: string;
          mediaUrl?: string;
          mediaType?: string;
        } = {
          caption,
          scheduledFor: new Date().toISOString(),
        };

        if (mediaFile) {
          updateData.mediaUrl = mediaUrl;
          updateData.mediaType = mediaFile.type;
        } else if (mediaRemoved) {
          updateData.mediaUrl = '';
          updateData.mediaType = '';
        }

        const updateResult = await updateScheduledPost(token, userId, editPostId, updateData);
        if (!updateResult.success) {
          toast({ variant: 'destructive', title: t.common.error, description: updateResult.error || t.colabNewPost.scheduleError });
          setIsPublishing(false);
          return;
        }

        // Publish to LinkedIn
        const result = await publishToLinkedIn(
          token, userId, caption, mediaUrl, editPostId,
          mediaFile?.type || (existingMediaType && !mediaRemoved ? existingMediaType : undefined)
        );

        if (result.success) {
          setPublishedUrl(result.postUrl || null);
          toast({ title: t.colabNewPost.publishedOnLinkedin, description: t.colabNewPost.publishedDescription });
        } else {
          toast({ variant: 'destructive', title: t.colabNewPost.publishError, description: result.error });
          if (result.needsReconnect) {
            router.push('/colaborador/configuracoes');
          }
        }
      } else {
        // ─── Create mode: create post then publish ──────
        const createResult = await createScheduledPost(token, userId, {
          caption,
          mediaUrl,
          mediaType: mediaFile?.type,
          scheduledFor: new Date().toISOString(),
        });

        if (!createResult.success || !createResult.postId) {
          toast({ variant: 'destructive', title: t.common.error, description: createResult.error || t.colabNewPost.scheduleError });
          setIsPublishing(false);
          return;
        }

        // Publish to LinkedIn and update the post status
        const result = await publishToLinkedIn(token, userId, caption, mediaUrl, createResult.postId, mediaFile?.type);

        if (result.success) {
          setPublishedUrl(result.postUrl || null);
          toast({ title: t.colabNewPost.publishedOnLinkedin, description: t.colabNewPost.publishedDescription });
          completeOnboardingItem(userId ?? undefined, 'schedule-content');
        } else {
          toast({ variant: 'destructive', title: t.colabNewPost.publishError, description: result.error });
          if (result.needsReconnect) {
            router.push('/colaborador/configuracoes');
          }
        }
      }
    } catch (error) {
      console.error('Error publishing:', error);
      const msg = error instanceof Error ? error.message : t.colabNewPost.scheduleError;
      toast({ variant: 'destructive', title: t.colabNewPost.publishError, description: msg });
    }

    setIsPublishing(false);
  };

  // Determine if media is video (new file or existing)
  const isVideoMedia = mediaFile?.type.startsWith('video/') || (!mediaFile && existingMediaType?.startsWith('video/'));

  if (isLoading || isLoadingPost) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-2"><Skeleton className="h-8 w-8" /><Skeleton className="h-4 w-48" /></div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    );
  }

  // Visual replica do shell do estrategista (post-editor-shell.tsx) —
  // single-column, max-w-4xl, header sticky, textarea grande. Sem
  // comments/versions/aprovacao (colaborador nao tem). Sem preview do
  // LinkedIn ao lado (preview vive no Assistente de IA).
  return (
    <div className="min-h-screen bg-background">
      {/* Header sticky — copia do estilo do PostHeaderBar do estrategista,
          mas sem breadcrumb company/TL (colaborador nao tem). */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/colaborador/calendario')}
              className="shrink-0"
              aria-label={t.colabNewPost.backToCalendar}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground truncate">
              {isEditMode ? t.colabNewPost.editTitle : t.colabNewPost.title}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            {isSaving && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t.colabNewPost.scheduling}</span>
              </>
            )}
            {publishedUrl && (
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-green-600 hover:underline"
              >
                <Linkedin className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.colabNewPost.viewOnLinkedin}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Properties grid — mesmo padrao visual do PostProperties do
            estrategista: grid-cols-2 sm:grid-cols-4, labels text-xs
            muted-foreground, inputs h-8 text-xs. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-y">
          {/* Pilar */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Pilar</Label>
            <Select
              value={contentPillar || 'none'}
              onValueChange={(v) => setContentPillar(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={pillars.length > 0 ? 'Selecione' : 'Sem pilares'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">Sem pilar</SelectItem>
                {pillars.map((p) => {
                  const c = getPillarClasses(p.color);
                  return (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <span className="inline-flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.bg}`} />
                        {p.name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Formato */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Formato</Label>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="text-[10px] text-muted-foreground hover:text-foreground underline"
              >
                Gerenciar
              </button>
            </div>
            <Select
              value={formato || 'none'}
              onValueChange={(v) => setFormato(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tipo de midia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">Sem formato</SelectItem>
                {allFormats.map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="space-y-1">
            <Label htmlFor="date" className="text-xs text-muted-foreground">Data</Label>
            <Input
              id="date"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="h-8 text-xs"
            />
          </div>

          {/* Horario */}
          <div className="space-y-1">
            <Label htmlFor="time" className="text-xs text-muted-foreground">Horário</Label>
            <Input
              id="time"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="h-8 text-xs"
              disabled={!scheduledDate}
            />
          </div>
        </div>

        {/* Caption — mesma estrutura visual do PostBodyEditor: info bar
            de atalhos em cima + textarea min-h-[300px] sem borda interna. */}
        <div className="py-2">
          <div className="border rounded-md overflow-hidden">
            <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-gray-50">
              <button
                type="button"
                onClick={() => setShowTip(!showTip)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Atalhos</span>
              </button>
              {showTip && (
                <span className="text-xs text-muted-foreground">
                  Use o caractere <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px] font-mono">→</kbd> (seta) para destacar tópicos.
                </span>
              )}
            </div>
            <Textarea
              id="caption"
              placeholder={t.colabNewPost.captionPlaceholder}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-[300px] border-0 rounded-none focus-visible:ring-0 resize-y text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground text-right mt-1">{caption.length} {t.colabNewPost.characters}</p>
        </div>

        {/* Media upload */}
        <div className="space-y-1.5">
          <Label>{t.colabNewPost.media}</Label>
          {mediaPreview ? (
            <div className="relative rounded-lg overflow-hidden border">
              {isVideoMedia ? (
                <video src={mediaPreview} controls className="w-full max-h-[400px] object-cover" />
              ) : mediaPreview.startsWith('http') ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaPreview} alt="Preview" className="w-full max-h-[400px] object-cover" />
              ) : (
                <Image src={mediaPreview} alt="Preview" width={1200} height={800} className="w-full max-h-[400px] object-cover" />
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={removeMedia}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">{t.colabNewPost.clickToAdd}</span>
              <span className="text-xs text-muted-foreground mt-0.5">JPG, PNG, GIF (até 10MB) · MP4, MOV (até 200MB)</span>
              <input
                type="file"
                accept="image/*,video/mp4,video/quicktime"
                className="hidden"
                onChange={handleMediaChange}
              />
            </label>
          )}
        </div>

        {/* Actions — botões finais.
            "Publicar agora" como primário (LinkedIn azul) e "Agendar"
            como secundário/outline. Layout horizontal em telas grandes,
            stack em mobile. */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-end pt-2 border-t">
          {!publishedUrl && (
            <Button
              variant="outline"
              onClick={handleSubmit}
              disabled={isSaving || isPublishing || !caption.trim() || !scheduledDate}
              className="gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.colabNewPost.scheduling}
                </>
              ) : (
                <>
                  <CalendarDays className="h-4 w-4" />
                  {t.colabNewPost.scheduleForLater}
                </>
              )}
            </Button>
          )}

          {publishedUrl ? (
            <a
              href={publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-md bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              <Linkedin className="h-4 w-4" />
              {t.colabNewPost.viewOnLinkedin}
            </a>
          ) : (
            <Button
              onClick={handlePublishNow}
              disabled={isPublishing || isSaving || !caption.trim() || !linkedinConnected}
              className="gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.colabNewPost.publishing}
                </>
              ) : (
                <>
                  <Linkedin className="h-4 w-4" />
                  {t.colabNewPost.publishNow}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Aviso LinkedIn não conectado */}
        {!linkedinConnected && !publishedUrl && (
          <p className="text-xs text-muted-foreground text-center">
            <a href="/colaborador/configuracoes" className="text-[#0A66C2] hover:underline">
              {t.colabNewPost.connectLinkedin}
            </a>
            {' '}{t.colabNewPost.connectToPublish}
          </p>
        )}

        {/* Schedule summary */}
        {scheduledDate && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" />
            <span>
              {t.colabNewPost.scheduledFor}{' '}
              <strong className="text-foreground">
                {format(new Date(`${scheduledDate}T${scheduledTime}`), "EEEE, d MMMM, HH:mm", { locale: dateFnsLocale })}
              </strong>
            </span>
          </div>
        )}
      </main>

      {/* Dialog: gerenciar formatos personalizados.
          Defaults nao sao removiveis nesta rodada — so customs.
          Salva em users/{uid}.customPostFormats via server action. */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar formatos</DialogTitle>
            <DialogDescription>
              Adicione formatos personalizados ao seu menu. Os formatos padrao nao podem ser removidos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Defaults — read-only */}
            <div>
              <Label className="text-xs text-muted-foreground">Padrao (nao removiveis)</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {DEFAULT_POST_FORMATS.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center px-2 py-1 rounded text-xs bg-muted text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {/* Customs */}
            <div>
              <Label className="text-xs text-muted-foreground">Meus formatos</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5 min-h-[28px]">
                {customFormats.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">Nenhum formato personalizado ainda.</span>
                ) : (
                  customFormats.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-100 text-purple-700"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomFormat(c)}
                        aria-label={`Remover ${c}`}
                        className="hover:text-purple-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Adicionar novo */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Input
                placeholder="Ex: Reels, Live, Citacao..."
                value={newFormatInput}
                onChange={(e) => setNewFormatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFormat();
                  }
                }}
                maxLength={40}
              />
              <Button onClick={handleAddFormat} disabled={!newFormatInput.trim()} size="sm">
                Adicionar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageOpen(false)}>Cancelar</Button>
            <Button onClick={handlePersistFormats} disabled={savingFormats}>
              {savingFormats ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando</>
              ) : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NovoPostPage() {
  // Sem wrapper externo — o EditorContent ja faz min-h-screen e header
  // sticky proprios (igual estilo do PostEditorShell do estrategista).
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur h-14" />
        <main className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-40 w-full" />
        </main>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}
