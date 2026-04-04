// src/app/colaborador/calendario/novo/page.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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
import { createScheduledPost, updateScheduledPost } from '@/app/actions/posts';
import { publishToLinkedIn, getLinkedInStatus } from '@/app/actions/linkedin';
import { getAuthToken } from '@/lib/auth-client';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';

function EditorContent() {
  const [userId, setUserId] = useState<string | null>(null);
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
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Populate from query params
  useEffect(() => {
    const captionParam = searchParams.get('caption');
    const dateParam = searchParams.get('date');

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
  }, [searchParams]);

  // Auth + LinkedIn status
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push('/login');
        return;
      }
      setUserId(firebaseUser.uid);
      setIsLoading(false);
      // Check LinkedIn status + profile data for preview
      const tkn = await firebaseUser.getIdToken();
      const status = await getLinkedInStatus(tkn, firebaseUser.uid);
      setLinkedinConnected(status.connected && !!status.tokenValid);
      if (status.name) setProfileName(status.name);
      if (status.picture) setProfilePicture(status.picture);
      if (status.headline) setProfileHeadline(status.headline);
    });
    return () => unsubscribe();
  }, [router]);

  // Media file handling
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Arquivo muito grande', description: 'Máximo 10MB.' });
      return;
    }

    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setMediaPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
  };

  // Submit
  const handleSubmit = async () => {
    if (!userId) return;
    if (!caption.trim()) {
      toast({ variant: 'destructive', title: 'Legenda obrigatória', description: 'Escreva uma legenda para o post.' });
      return;
    }
    if (!scheduledDate) {
      toast({ variant: 'destructive', title: 'Data obrigatória', description: 'Escolha uma data para agendar.' });
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
      const result = await createScheduledPost(token, userId, {
        caption,
        mediaUrl,
        mediaType,
        scheduledFor,
      });

      if (result.success) {
        toast({ title: 'Post agendado!', description: 'Seu post foi adicionado ao calendário.' });
        router.push('/colaborador/calendario');
      } else {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      }
    } catch (error) {
      console.error('Error saving post:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível agendar o post.' });
    }

    setIsSaving(false);
  };

  // Publish immediately to LinkedIn
  const handlePublishNow = async () => {
    if (!userId) return;
    if (!caption.trim()) {
      toast({ variant: 'destructive', title: 'Legenda obrigatória', description: 'Escreva uma legenda para o post.' });
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
      }

      // Publish to LinkedIn (with optional image)
      const token = await getAuthToken();
      const result = await publishToLinkedIn(token, userId, caption, mediaUrl);

      if (result.success) {
        setPublishedUrl(result.postUrl || null);
        toast({ title: 'Publicado no LinkedIn!', description: 'Seu post está no ar.' });

        // Also save as a published record
        await createScheduledPost(token, userId, {
          caption,
          mediaUrl,
          mediaType: mediaFile?.type,
          scheduledFor: new Date().toISOString(),
        });
      } else {
        toast({ variant: 'destructive', title: 'Erro ao publicar', description: result.error });
        if (result.needsReconnect) {
          router.push('/colaborador/configuracoes');
        }
      }
    } catch (error) {
      console.error('Error publishing:', error);
      const msg = error instanceof Error ? error.message : 'Erro desconhecido.';
      toast({ variant: 'destructive', title: 'Erro ao publicar', description: msg });
    }

    setIsPublishing(false);
  };

  // Truncate caption for preview
  const isLong = caption.length > 300;
  const [expanded, setExpanded] = useState(false);
  const displayCaption = isLong && !expanded ? caption.slice(0, 280) + '...' : caption;

  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* LEFT — Editor */}
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/colaborador/calendario')} className="gap-1.5 -ml-2 mb-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao calendário
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Editor de Post</CardTitle>
            <CardDescription>Escreva sua legenda, adicione mídia e escolha quando publicar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Caption */}
            <div className="space-y-1.5">
              <Label htmlFor="caption">Legenda</Label>
              <Textarea
                id="caption"
                placeholder="Escreva sua legenda aqui..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-muted-foreground text-right">{caption.length} caracteres</p>
            </div>

            {/* Media upload */}
            <div className="space-y-1.5">
              <Label>Mídia</Label>
              {mediaPreview ? (
                <div className="relative rounded-lg overflow-hidden border">
                  <Image
                    src={mediaPreview}
                    alt="Preview"
                    width={600}
                    height={400}
                    className="w-full h-48 object-cover"
                  />
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
                  <span className="text-sm text-muted-foreground">Clique para adicionar imagem</span>
                  <span className="text-xs text-muted-foreground mt-0.5">PNG, JPG ou GIF (máx. 10MB)</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleMediaChange}
                  />
                </label>
              )}
            </div>

            {/* Date & time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date" className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Data
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
                  Horário
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
              </div>
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
                  Ver post no LinkedIn
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
                      Publicando...
                    </>
                  ) : (
                    <>
                      <Linkedin className="h-4 w-4" />
                      Publicar agora no LinkedIn
                    </>
                  )}
                </Button>
              )}

              {!linkedinConnected && !publishedUrl && (
                <p className="text-xs text-muted-foreground text-center">
                  <a href="/colaborador/configuracoes" className="text-[#0A66C2] hover:underline">
                    Conecte seu LinkedIn
                  </a>
                  {' '}para publicar diretamente.
                </p>
              )}

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
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
                    Agendando...
                  </>
                ) : (
                  <>
                    <CalendarDays className="h-4 w-4" />
                    Agendar para depois
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT — Live Preview */}
      <div className="lg:sticky lg:top-6 space-y-4">
        <div className="text-sm font-medium text-muted-foreground">Preview do Post</div>

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
                <p className="font-semibold text-sm text-foreground">{profileName || 'Seu Nome'}</p>
                <p className="text-xs text-muted-foreground truncate">{profileHeadline || 'Sua headline profissional'}</p>
                <p className="text-xs text-muted-foreground">
                  {scheduledDate
                    ? format(new Date(`${scheduledDate}T${scheduledTime}`), "d MMM 'às' HH:mm", { locale: ptBR })
                    : 'Agora'
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
                    ...ver mais
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sua legenda aparecerá aqui...</p>
            )}
          </div>

          {/* Media */}
          {mediaPreview ? (
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
              <p className="text-xs text-muted-foreground">Adicione uma imagem</p>
            </div>
          )}

          {/* Reactions bar */}
          <div className="px-4 py-2 border-b flex items-center gap-1">
            <div className="flex -space-x-1">
              <span className="text-xs">👍</span>
              <span className="text-xs">❤️</span>
              <span className="text-xs">💡</span>
            </div>
            <span className="text-xs text-muted-foreground ml-1">Você e outras pessoas</span>
          </div>

          {/* Action buttons */}
          <div className="px-2 py-1 flex justify-between">
            {[
              { icon: ThumbsUp, label: 'Gostei' },
              { icon: MessageSquare, label: 'Comentar' },
              { icon: Repeat2, label: 'Repostar' },
              { icon: Send, label: 'Enviar' },
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
              Agendado para{' '}
              <strong className="text-foreground">
                {format(new Date(`${scheduledDate}T${scheduledTime}`), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NovoPostPage() {
  return (
    <>
      <Header title="Novo Post" />
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
    </>
  );
}
