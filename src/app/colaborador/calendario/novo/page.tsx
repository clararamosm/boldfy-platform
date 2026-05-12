// src/app/colaborador/calendario/novo/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/auth-context';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuthToken } from '@/lib/auth-client';
import { createScheduledPost, updateScheduledPost, getScheduledPost } from '@/app/actions/posts';
import { publishToLinkedIn, getLinkedInStatus } from '@/app/actions/linkedin';
import { completeOnboardingItem } from '@/hooks/use-onboarding';
import {
  CalendarDays,
  Clock,
  ImageIcon,
  Loader2,
  Linkedin,
  ArrowLeft,
  X,
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  Upload,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useT, useLocale } from '@/lib/i18n/context';
import { getDateLocale } from '@/lib/i18n/date-utils';
import { resolvePersonalBrand } from '@/lib/personal-brand';
import { getPillarClasses } from '@/lib/pillar-colors';
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
  const [profileName, setProfileName] = useState('');
  const [profilePicture, setProfilePicture] = useState('');
  const [profileHeadline, setProfileHeadline] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('10:00');
  const [showTip, setShowTip] = useState(false);
  // PR 3: pilar e formato do post (persistidos em ScheduledPost.contentPillar / .formato).
  // Strings vazias = "nao definido"; campos opcionais no doc Firestore.
  const [contentPillar, setContentPillar] = useState<string>('');
  const [formato, setFormato] = useState<'' | 'linkedin' | 'text-heavy' | 'hybrid'>('');
  const [pillars, setPillars] = useState<PersonalBrandPillar[]>([]);
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

  // Populate from query params (only in create mode)
  useEffect(() => {
    if (editPostId) return; // Skip — edit mode loads via separate effect
    const captionParam = searchParams.get('caption');
    const dateParam = searchParams.get('date');
    const pillarParam = searchParams.get('pillar');
    const formatoParam = searchParams.get('formato');

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
    if (formatoParam && ['linkedin', 'text-heavy', 'hybrid'].includes(formatoParam)) {
      setFormato(formatoParam as 'linkedin' | 'text-heavy' | 'hybrid');
    }
  }, [searchParams, editPostId]);

  // Fetch pilares do colaborador pra popular o dropdown
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
      } catch (err) {
        console.error('Failed to load pillars:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

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

  // LinkedIn status check
  useEffect(() => {
    if (!userId) return;
    setIsLoading(false);
    const checkLinkedIn = async () => {
      const tkn = await getAuthToken();
      const status = await getLinkedInStatus(tkn, userId);
      setLinkedinConnected(status.connected && !!status.tokenValid);
      if (status.name) setProfileName(status.name);
      if (status.picture) setProfilePicture(status.picture);
      if (status.headline) setProfileHeadline(status.headline);
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
          formato?: 'linkedin' | 'text-heavy' | 'hybrid';
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

  // Truncate caption for preview
  const isLong = caption.length > 300;
  const [expanded, setExpanded] = useState(false);
  const displayCaption = isLong && !expanded ? caption.slice(0, 280) + '...' : caption;

  // Determine if media is video (new file or existing)
  const isVideoMedia = mediaFile?.type.startsWith('video/') || (!mediaFile && existingMediaType?.startsWith('video/'));

  if (isLoading || isLoadingPost) {
    return (
      <>
        <Header title={isEditMode ? t.colabNewPost.editTitle : t.colabNewPost.title} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
          <div>
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={isEditMode ? t.colabNewPost.editTitle : t.colabNewPost.title} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT — Editor */}
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/colaborador/calendario')} className="gap-1.5 -ml-2 mb-2">
            <ArrowLeft className="h-4 w-4" />
            {t.colabNewPost.backToCalendar}
          </Button>

          {/* PR 3: HotTopicsBox foi removido daqui — o lugar de buscar
              inspiracao e o Assistente de IA (/colaborador/assistente).
              Esta tela e dedicada a "agendar / postar" o que ja esta pronto. */}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.colabNewPost.editorTitle}</CardTitle>
              <CardDescription>{t.colabNewPost.editorDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Caption with info bar */}
              <div className="space-y-1.5">
                <Label htmlFor="caption">{t.colabNewPost.caption}</Label>
                <div className="border rounded-md overflow-hidden">
                  {/* Info bar */}
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
                        Use o caractere <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px] font-mono">→</kbd> (seta) para destacar tópicos. Parênteses, colchetes e outros caracteres especiais são suportados normalmente.
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="caption"
                    placeholder={t.colabNewPost.captionPlaceholder}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={8}
                    className="border-0 rounded-none focus-visible:ring-0"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">{caption.length} {t.colabNewPost.characters}</p>
              </div>

              {/* PR 3: classificacao do post (pilar + formato).
                  Opcionais. Alimentam as tags no calendario (PR 4). */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Pilar</Label>
                  <Select
                    value={contentPillar || 'none'}
                    onValueChange={(v) => setContentPillar(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={pillars.length > 0 ? 'Selecione um pilar' : 'Sem pilares cadastrados'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem pilar</SelectItem>
                      {pillars.map((p) => {
                        const c = getPillarClasses(p.color);
                        return (
                          <SelectItem key={p.id} value={p.id}>
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
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Formato</Label>
                  <Select
                    value={formato || 'none'}
                    onValueChange={(v) => setFormato(v === 'none' ? '' : (v as 'linkedin' | 'text-heavy' | 'hybrid'))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um formato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem formato</SelectItem>
                      <SelectItem value="linkedin">LinkedIn estruturado</SelectItem>
                      <SelectItem value="text-heavy">Texto Denso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Media upload */}
              <div className="space-y-1.5">
                <Label>{t.colabNewPost.media}</Label>
                {mediaPreview ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    {isVideoMedia ? (
                      <video
                        src={mediaPreview}
                        controls
                        className="w-full h-48 object-cover"
                      />
                    ) : mediaPreview.startsWith('http') ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <Image
                        src={mediaPreview}
                        alt="Preview"
                        width={600}
                        height={400}
                        className="w-full h-48 object-cover"
                      />
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

              {/* Actions */}
              <div className="space-y-2">
                {/* Publish now */}
                {publishedUrl ? (
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full rounded-md bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <Linkedin className="h-4 w-4" />
                    {t.colabNewPost.viewOnLinkedin}
                  </a>
                ) : (
                  <Button
                    onClick={handlePublishNow}
                    disabled={isPublishing || isSaving || !caption.trim() || !linkedinConnected}
                    className="w-full gap-2 bg-[#0A66C2] hover:bg-[#004182] text-white"
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

                {!linkedinConnected && !publishedUrl && (
                  <p className="text-xs text-muted-foreground text-center">
                    <a href="/colaborador/configuracoes" className="text-[#0A66C2] hover:underline">
                      {t.colabNewPost.connectLinkedin}
                    </a>
                    {' '}{t.colabNewPost.connectToPublish}
                  </p>
                )}

                {/* Divider */}
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">{t.colabNewPost.or}</span></div>
                </div>

                {/* Date & time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="date" className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {t.colabNewPost.dateLabel}
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="time" className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {t.colabNewPost.timeLabel}
                    </Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* Schedule */}
                <Button
                  variant="outline"
                  onClick={handleSubmit}
                  disabled={isSaving || isPublishing || !caption.trim() || !scheduledDate}
                  className="w-full gap-2"
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
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Live Preview */}
        <div className="lg:sticky lg:top-6 space-y-4">
          <div className="text-sm font-medium text-muted-foreground">{t.colabNewPost.previewTitle}</div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-4 pb-2">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12 border-2 border-muted">
                  {profilePicture && <AvatarImage src={profilePicture} />}
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-700 text-white text-sm font-bold">
                    {profileName ? profileName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'VC'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{profileName || t.colabNewPost.yourName}</p>
                  <p className="text-xs text-muted-foreground truncate">{profileHeadline || t.colabNewPost.yourHeadline}</p>
                  <p className="text-xs text-muted-foreground">
                    {scheduledDate
                      ? format(new Date(`${scheduledDate}T${scheduledTime}`), "d MMM, HH:mm", { locale: dateFnsLocale })
                      : t.colabNewPost.nowLabel
                    } · 🌐
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 pb-3">
              {caption ? (
                <>
                  <p className="text-sm whitespace-pre-line leading-relaxed text-foreground">
                    {displayCaption}
                  </p>
                  {isLong && !expanded && (
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="text-sm text-muted-foreground hover:text-foreground hover:underline mt-1"
                    >
                      {t.ai.seeMore}
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t.colabNewPost.captionPreviewPlaceholder}</p>
              )}
            </div>

            {/* Media */}
            {mediaPreview && isVideoMedia ? (
              <video
                src={mediaPreview}
                controls
                className="w-full aspect-video object-cover border-y"
              />
            ) : mediaPreview && mediaPreview.startsWith('http') ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={mediaPreview}
                alt="Preview"
                className="w-full aspect-video object-cover border-y"
              />
            ) : mediaPreview ? (
              <Image
                src={mediaPreview}
                alt="Preview"
                width={600}
                height={400}
                className="w-full aspect-video object-cover border-y"
              />
            ) : (
              <div className="bg-muted/50 border-y h-48 flex flex-col items-center justify-center gap-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">{t.colabNewPost.addImage}</p>
              </div>
            )}

            {/* Reactions bar */}
            <div className="px-4 py-2 border-b flex items-center gap-1">
              <div className="flex -space-x-1">
                <span className="text-xs">👍</span>
                <span className="text-xs">❤️</span>
                <span className="text-xs">💡</span>
              </div>
              <span className="text-xs text-muted-foreground ml-1">{t.colabNewPost.youAndOthers}</span>
            </div>

            {/* Action buttons */}
            <div className="px-2 py-1 flex justify-between">
              {[
                { icon: ThumbsUp, label: t.colabNewPost.like },
                { icon: MessageSquare, label: t.colabNewPost.comment },
                { icon: Repeat2, label: t.colabNewPost.repost },
                { icon: Send, label: t.colabNewPost.send },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground text-xs hover:bg-muted/50 transition-colors"
                  disabled
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

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
        </div>
      </div>
    </>
  );
}

export default function NovoPostPage() {
  return (
    <main className="flex-1 overflow-auto p-4 md:p-6">
      <Suspense fallback={
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      }>
        <EditorContent />
      </Suspense>
    </main>
  );
}
