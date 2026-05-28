// src/app/colaborador/calendario/novo/page.tsx
'use client';

import { useState, useEffect, Suspense, useCallback, useRef } from 'react';
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
  Check,
  AlertCircle,
  RotateCw,
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
import { getStatusConfig, type PostStatus } from '@/lib/post-status-config';
import { Badge } from '@/components/ui/badge';
import { mergePostFormats, isDefaultFormat, DEFAULT_POST_FORMATS } from '@/lib/post-formats';
import { saveCustomPostFormats } from '@/app/actions/posts';
import {
  ACCEPTED_MEDIA_INPUT,
  classifyMimeType,
  validateNewMedia,
  MAX_GALLERY_IMAGES,
} from '@/lib/media-rules';
import type { PersonalBrandPillar } from '@/types/personal-brand';

// Item de midia interno do editor. Pode ser um File local (ainda nao
// uploaded) ou uma URL ja no Firebase Storage (vinda do edit mode).
type MediaItem = {
  // File presente apenas em items novos. Null quando ja foi uploaded.
  file: File | null;
  // URL pra preview no DOM: blob:// pra video, data:// pra imagem nova,
  // ou https:// pra item ja no Firebase Storage.
  previewUrl: string;
  // MIME type — sempre presente.
  mimeType: string;
  // URL final no Firebase Storage. Null pra items novos (ainda nao subiram).
  uploadedUrl: string | null;
};

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
  // mediaItems: array de items (galeria). Substitui mediaFile/mediaPreview
  // singulares do schema antigo. Sempre array — mesmo single image vira
  // [{ ... }] de 1 item. Persistencia decide single vs galeria ao salvar.
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  // Título customizado do PDF/carrossel. Só é mostrado/persistido quando há PDF
  // entre os mediaItems. LinkedIn usa esse texto como nome visível do carrossel
  // na timeline (substituindo o fallback "Documento").
  const [documentTitle, setDocumentTitle] = useState<string>('');
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
  // Auto-save (igual estrategista): debounce 1.5s a cada mudanca. Primeiro
  // save cria como draft (sem data = draft); saves seguintes atualizam.
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  // Status do post (rascunho/agendado/postado/falhou). Mostrado como badge
  // no header pro colaborador saber em que pé o conteúdo está. Atualizado
  // (a) ao carregar post em edit mode, (b) inferido após cada auto-save,
  // (c) trocado quando publica/agenda manualmente.
  const [postStatus, setPostStatus] = useState<PostStatus | null>(null);
  // Mensagem de erro quando o post falhou. Vem do campo `error` do doc
  // Firestore (escrito pelo cron de publicação ou pelo publishToLinkedIn).
  // Exibido em banner vermelho no topo do editor quando postStatus === 'failed'.
  const [postError, setPostError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoSavingRef = useRef(false);
  // Ref do textarea do caption — usada pelo botão "Inserir seta" pra colocar
  // o caractere → (U+2192) na posição exata do cursor. Necessário porque o
  // que parece uma seta quando você digita "->" no editor é só ligadura da
  // fonte Inter — no LinkedIn o caractere real continua sendo dois ASCII e
  // aparece como texto puro. O botão garante que o caractere real fique no
  // banco e suba pro LinkedIn como seta de verdade.
  const captionRef = useRef<HTMLTextAreaElement | null>(null);
  // Guarda referencia ao primeiro render — nao dispara auto-save logo
  // ao carregar um post existente (so quando o user efetivamente muda algo).
  const hasInitializedRef = useRef(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Edit mode ──────────────────────────────────────
  // editPostId vem do query param `?edit=<id>` na URL. Quando ausente, o
  // editor comeca em branco — o primeiro auto-save vai criar o post e
  // setar `currentPostId`. A partir dai os saves seguintes sao updates.
  const editPostId = searchParams.get('edit');
  const isEditMode = !!editPostId;
  const [isLoadingPost, setIsLoadingPost] = useState(!!editPostId);

  // Sincroniza currentPostId quando o query param chega. Importante pra
  // permitir o auto-save reconhecer "ja estou num post" desde o inicio.
  useEffect(() => {
    if (editPostId) setCurrentPostId(editPostId);
  }, [editPostId]);

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
          // Hidrata mediaItems do post existente. Galeria (mediaUrls/mediaTypes)
          // tem prioridade; cai pro singular legado se ausente.
          const galleryUrls = Array.isArray(result.post.mediaUrls) ? result.post.mediaUrls : [];
          const galleryTypes = Array.isArray(result.post.mediaTypes) ? result.post.mediaTypes : [];
          if (galleryUrls.length > 0) {
            setMediaItems(galleryUrls.map((url, i) => ({
              file: null,
              previewUrl: url,
              mimeType: galleryTypes[i] ?? 'image/jpeg',
              uploadedUrl: url,
            })));
          } else if (result.post.mediaUrl) {
            setMediaItems([{
              file: null,
              previewUrl: result.post.mediaUrl,
              mimeType: result.post.mediaType ?? 'image/jpeg',
              uploadedUrl: result.post.mediaUrl,
            }]);
          }
          // Hidrata título customizado do PDF — só aparece se existir.
          if (result.post.documentTitle) setDocumentTitle(result.post.documentTitle);
          if (result.post.contentPillar) setContentPillar(result.post.contentPillar);
          if (result.post.formato) setFormato(result.post.formato);
          // Hidrata status pra badge — quando o post existente ja foi
          // postado, o user sabe que esta vendo um post imutavel.
          setPostStatus(result.post.status as PostStatus);
          // Hidrata mensagem de erro pra mostrar no banner quando status==='failed'.
          // Posts em outros status podem ter `error` residual de tentativas
          // anteriores — só exibe o banner quando o status atual confirma falha.
          if (result.post.error) setPostError(result.post.error);
          // linkedinPostUrl só vale a pena se vier com postId real. Posts
          // antigos do bug "falso sucesso" podem ter url='feed/update//'.
          if (result.post.linkedinPostUrl && result.post.linkedinPostId) {
            setPublishedUrl(result.post.linkedinPostUrl);
          }
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

  // Media file handling — aceita múltiplos arquivos (multi-image gallery).
  // Cada arquivo passa por validateNewMedia que checa tamanho, mistura de
  // tipos, e cap de 10 imagens. Se algum falhar, mostra toast e ignora ele.
  const handleMediaChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Validação sequencial — acumula items conforme passam.
    const acceptedNew: MediaItem[] = [];
    const currentSnapshot = [...mediaItems];

    for (const file of files) {
      const result = validateNewMedia(
        { mimeType: file.type, sizeBytes: file.size },
        [...currentSnapshot, ...acceptedNew].map((m) => ({ mimeType: m.mimeType })),
      );
      if (!result.ok) {
        toast({ variant: 'destructive', title: 'Mídia não aceita', description: result.reason });
        continue;
      }

      const kind = classifyMimeType(file.type);
      const previewUrl = kind === 'video'
        ? URL.createObjectURL(file)
        : await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });

      acceptedNew.push({ file, previewUrl, mimeType: file.type, uploadedUrl: null });
    }

    if (acceptedNew.length > 0) {
      setMediaItems((prev) => [...prev, ...acceptedNew]);
    }

    // Reset input pra permitir adicionar o mesmo arquivo novamente
    e.target.value = '';
  };

  const removeMediaAt = (idx: number) => {
    setMediaItems((prev) => {
      const item = prev[idx];
      // Revoke object URL se foi criado pra video local
      if (item?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(item.previewUrl);
      }
      const next = prev.filter((_, i) => i !== idx);
      // Se removeu o PDF (ou virou lista sem PDF), limpa título — perde sentido.
      const stillHasPdf = next.some((m) => classifyMimeType(m.mimeType) === 'pdf');
      if (!stillHasPdf) setDocumentTitle('');
      return next;
    });
  };

  /**
   * Sobe pro Firebase Storage todos os itens de mediaItems que ainda não têm
   * uploadedUrl. Retorna arrays paralelos urls[] / types[] na ordem dos items.
   * Em modo single (1 item), o saver downstream coloca em mediaUrl/mediaType.
   */
  const uploadPendingMedia = async (): Promise<{ urls: string[]; types: string[] }> => {
    if (!userId) return { urls: [], types: [] };
    const urls: string[] = [];
    const types: string[] = [];
    for (const item of mediaItems) {
      if (item.uploadedUrl) {
        urls.push(item.uploadedUrl);
      } else if (item.file) {
        const fileName = `${Date.now()}_${item.file.name}`;
        const storageRef = ref(storage, `users/${userId}/posts/${fileName}`);
        const snapshot = await uploadBytes(storageRef, item.file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        urls.push(downloadUrl);
      } else {
        continue; // shouldn't happen — defensive
      }
      types.push(item.mimeType);
    }
    return { urls, types };
  };

  // ─── Auto-save ──────────────────────────────────────
  /**
   * Salva o estado atual no Firestore. Primeiro chamada cria o post (status
   * inferido pela presença/ausência de data); chamadas seguintes atualizam.
   * Idempotente — pode ser chamado quantas vezes for. Bloqueia execuções
   * concorrentes via `isAutoSavingRef`.
   *
   * Não dispara em estados "vazios" (sem caption e sem mídia) — evita
   * criar docs lixo enquanto o user só clica no editor sem digitar.
   */
  const triggerAutoSave = useCallback(async () => {
    if (!userId) return;
    if (publishedUrl) return; // post já publicado, não toca
    const captionEmpty = !caption.trim();
    if (captionEmpty && mediaItems.length === 0) return;
    if (isAutoSavingRef.current) return;

    isAutoSavingRef.current = true;
    setAutoSaveStatus('saving');
    try {
      const token = await getAuthToken();
      const { urls, types } = await uploadPendingMedia();
      const scheduledFor = scheduledDate
        ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString()
        : null;

      // Auto-save NUNCA cria agendamento real. Se tem data, marca como
      // 'in_progress' (em construção com data); se não tem, 'draft'. Só o
      // botão "Agendar" (handleSubmit) confirma como 'scheduled'. Isso
      // impede o cron de publicar posts que ainda estão sendo escritos.
      const autoSaveStatus: 'draft' | 'in_progress' = scheduledFor ? 'in_progress' : 'draft';

      if (currentPostId) {
        const result = await updateScheduledPost(token, userId, currentPostId, {
          caption,
          scheduledFor,
          mediaUrls: urls,
          mediaTypes: types,
          // Só envia documentTitle quando a primeira mídia é PDF — assim o
          // server-side cascade não apaga o título acidentalmente em saves de
          // posts com outras mídias.
          ...(types[0] === 'application/pdf' && { documentTitle }),
          contentPillar,
          status: autoSaveStatus,
          ...(formato && { formato }),
        });
        if (!result.success) throw new Error(result.error || 'Update falhou');
        // Post imutavel (published/failed) não é tocado.
        if (postStatus !== 'published' && postStatus !== 'failed') {
          setPostStatus(autoSaveStatus);
        }
      } else {
        const result = await createScheduledPost(token, userId, {
          caption,
          scheduledFor,
          mediaUrl: urls[0],
          mediaType: types[0],
          mediaUrls: urls,
          mediaTypes: types,
          ...(types[0] === 'application/pdf' && { documentTitle }),
          contentPillar,
          ...(formato && { formato }),
          status: autoSaveStatus,
        });
        if (!result.success || !result.postId) throw new Error(result.error || 'Create falhou');
        setCurrentPostId(result.postId);
        setPostStatus(autoSaveStatus);
        // Atualiza URL pra refletir o post (sem refresh) — assim se o user
        // der refresh, volta no mesmo doc em vez de criar duplicado.
        router.replace(`/colaborador/calendario/novo?edit=${result.postId}`);
      }
      setAutoSaveStatus('saved');
    } catch (err) {
      console.error('Auto-save failed:', err);
      setAutoSaveStatus('error');
    } finally {
      isAutoSavingRef.current = false;
    }
  }, [userId, currentPostId, caption, mediaItems, scheduledDate, scheduledTime, contentPillar, formato, documentTitle, publishedUrl, router, uploadPendingMedia]);

  /**
   * Debounce: a cada mudança relevante no editor, agenda um save em 1.5s.
   * Pula o primeiro render (carregou post existente) pra não disparar save
   * imediato com o conteúdo recém-lido.
   */
  useEffect(() => {
    // Skip enquanto o editor ainda está carregando o post de edição
    if (isLoadingPost) return;
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void triggerAutoSave();
    }, 1500);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caption, mediaItems, scheduledDate, scheduledTime, contentPillar, formato, documentTitle, isLoadingPost]);

  /**
   * beforeunload protection — se há save em andamento, avisa o user
   * antes de sair. Não bloqueia, só pede confirmação.
   */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (autoSaveStatus === 'saving' || isAutoSavingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [autoSaveStatus]);

  /**
   * Insere texto na posição atual do cursor do caption (ou substitui a
   * seleção, se houver). Foca de volta no textarea e posiciona o cursor
   * logo após o texto inserido. Se o ref não estiver disponível (caso de
   * border), apenda no final.
   */
  const insertAtCaptionCursor = useCallback((text: string) => {
    const el = captionRef.current;
    if (!el) {
      setCaption((prev) => prev + text);
      return;
    }
    const start = el.selectionStart ?? caption.length;
    const end = el.selectionEnd ?? caption.length;
    const next = caption.slice(0, start) + text + caption.slice(end);
    setCaption(next);
    // requestAnimationFrame pra esperar o React re-renderizar com o novo
    // valor antes de mover o cursor — senão setSelectionRange acaba ficando
    // na posição antiga.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }, [caption]);

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
      // Upload de toda midia pendente em sequencia.
      const { urls, types } = await uploadPendingMedia();

      // Create ISO date from date + time
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();

      const token = await getAuthToken();

      if (isEditMode && editPostId) {
        // ─── Update existing post ──────────────────
        // Sempre enviamos mediaUrls (mesmo vazio) pra que o server action
        // saiba se houve remoção. O server action faz a sincronização
        // entre array e singular automaticamente.
        // status 'scheduled' EXPLÍCITO: esse é o único ponto onde o user
        // confirma o agendamento. Auto-save fica em in_progress até aqui.
        const result = await updateScheduledPost(token, userId, editPostId, {
          caption,
          scheduledFor,
          contentPillar,
          status: 'scheduled',
          ...(formato && { formato }),
          mediaUrls: urls,
          mediaTypes: types,
          ...(types[0] === 'application/pdf' && { documentTitle }),
        });
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
          // Mantém os single fields pra retrocompat — o create salva como
          // singular quando 1 item, como galeria quando 2+.
          mediaUrl: urls[0],
          mediaType: types[0],
          mediaUrls: urls,
          mediaTypes: types,
          ...(types[0] === 'application/pdf' && { documentTitle }),
          scheduledFor,
          status: 'scheduled',
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
      // Upload de todas as midias pendentes
      const { urls, types } = await uploadPendingMedia();
      const token = await getAuthToken();

      if (isEditMode && editPostId) {
        // ─── Edit mode: update post then publish ──────
        // status 'scheduled' explícito — se a chamada do LinkedIn falhar,
        // o cron pega e tenta de novo. Auto-save manteria in_progress.
        const updateResult = await updateScheduledPost(token, userId, editPostId, {
          caption,
          scheduledFor: new Date().toISOString(),
          status: 'scheduled',
          mediaUrls: urls,
          mediaTypes: types,
          ...(types[0] === 'application/pdf' && { documentTitle }),
        });
        if (!updateResult.success) {
          toast({ variant: 'destructive', title: t.common.error, description: updateResult.error || t.colabNewPost.scheduleError });
          setIsPublishing(false);
          return;
        }

        // Publish to LinkedIn (passa arrays — single ou multi)
        const result = await publishToLinkedIn(
          token, userId, caption,
          urls[0], // legado: 1a midia
          editPostId,
          types[0], // legado
          urls,
          types,
          types[0] === 'application/pdf' ? documentTitle : undefined,
        );

        if (result.success) {
          setPublishedUrl(result.postUrl || null);
          setPostStatus('published');
          toast({ title: t.colabNewPost.publishedOnLinkedin, description: t.colabNewPost.publishedDescription });
        } else {
          toast({ variant: 'destructive', title: t.colabNewPost.publishError, description: result.error });
          if (result.needsReconnect) {
            router.push('/colaborador/configuracoes');
          }
        }
      } else {
        // ─── Create mode: create post then publish ──────
        // status 'scheduled' explícito — se a chamada do LinkedIn falhar,
        // o cron pega e tenta de novo.
        const createResult = await createScheduledPost(token, userId, {
          caption,
          mediaUrl: urls[0],
          mediaType: types[0],
          mediaUrls: urls,
          mediaTypes: types,
          ...(types[0] === 'application/pdf' && { documentTitle }),
          scheduledFor: new Date().toISOString(),
          status: 'scheduled',
        });

        if (!createResult.success || !createResult.postId) {
          toast({ variant: 'destructive', title: t.common.error, description: createResult.error || t.colabNewPost.scheduleError });
          setIsPublishing(false);
          return;
        }

        const result = await publishToLinkedIn(
          token, userId, caption,
          urls[0], createResult.postId, types[0],
          urls, types,
          types[0] === 'application/pdf' ? documentTitle : undefined,
        );

        if (result.success) {
          setPublishedUrl(result.postUrl || null);
          setPostStatus('published');
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

  // Helpers de render — galeria atual.
  // primaryKind = tipo do primeiro item (todos devem ser do mesmo tipo).
  const primaryKind = mediaItems.length > 0 ? classifyMimeType(mediaItems[0].mimeType) : null;
  const isGallery = primaryKind === 'image' && mediaItems.length > 1;
  const canAddMore = mediaItems.length === 0 || (primaryKind === 'image' && mediaItems.length < MAX_GALLERY_IMAGES);

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

            {/* Badge de status — mesmas cores/labels do calendário.
                Aparece após primeiro auto-save (postStatus deixa de ser null).
                Render só se há postStatus e ele bate com algum dos status válidos. */}
            {postStatus && (() => {
              const cfg = getStatusConfig(t, postStatus);
              const StatusIcon = cfg.icon;
              return (
                <Badge className={`${cfg.color} gap-1 text-[10px] h-5 shrink-0 hidden sm:inline-flex`}>
                  <StatusIcon className="h-3 w-3" />
                  {cfg.tag}
                </Badge>
              );
            })()}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
            {/* Auto-save status — visivel quando o auto-save ja rodou ao
                menos uma vez ou esta rodando. Estado 'idle' (antes de
                qualquer mudanca) fica silencioso. */}
            {autoSaveStatus === 'saving' && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Salvando...</span>
              </>
            )}
            {autoSaveStatus === 'saved' && !isPublishing && (
              <>
                <Check className="h-3.5 w-3.5 text-green-500" />
                <span>Salvo</span>
              </>
            )}
            {autoSaveStatus === 'error' && (
              <span className="text-destructive">Erro ao salvar</span>
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
        {/* Banner de falha de publicação — primeira coisa visível quando
            o cron tentou publicar e o LinkedIn não confirmou. Antes desse
            banner a única pista que o user tinha era a badge "Post falhou"
            no header (facilmente despercebida) e nenhuma informação sobre o
            motivo. Botão "Reagendar" reabre o agendamento mantendo data/hora
            atuais — o user ajusta se precisar e o cron tenta de novo. */}
        {postStatus === 'failed' && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                    {t.colabNewPost.failureBannerTitle}
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed break-words">
                    {postError || t.colabCalendar.failureReasonFallback}
                  </p>
                  <p className="text-xs text-red-700/80 dark:text-red-300/80">
                    {t.colabNewPost.failureBannerHelp}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 dark:border-red-800 text-red-700 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/40"
                  onClick={handleSubmit}
                  disabled={isSaving || !scheduledDate}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {t.colabNewPost.failureBannerReschedule}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Properties grid — mesmo padrao visual do PostProperties do
            estrategista: grid-cols-2 sm:grid-cols-4, labels text-xs
            muted-foreground, inputs h-8 text-xs.
            Cada coluna usa um <div h-4> envolvendo o label pra garantir
            que TODAS as 4 colunas tenham exatamente a mesma altura de
            header — assim os Selects/Inputs ficam alinhados na mesma
            baseline mesmo quando uma coluna tem um link extra ("Gerenciar"). */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-y">
          {/* Pilar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between h-4">
              <Label className="text-xs text-muted-foreground">Pilar</Label>
            </div>
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
            <div className="flex items-center justify-between h-4">
              <Label className="text-xs text-muted-foreground">Formato</Label>
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="text-[10px] text-muted-foreground hover:text-foreground underline leading-none"
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
            <div className="flex items-center justify-between h-4">
              <Label htmlFor="date" className="text-xs text-muted-foreground">Data</Label>
            </div>
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
            <div className="flex items-center justify-between h-4">
              <Label htmlFor="time" className="text-xs text-muted-foreground">Horário</Label>
            </div>
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
            <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-gray-50">
              {/* Botão "Inserir seta" — coloca o caractere → (U+2192) real
                  na posição do cursor. É a forma certa de pôr seta no caption
                  porque o LinkedIn não renderiza ligaduras da fonte (digitar
                  "->" aparece como seta aqui via Inter, mas vira texto puro
                  no LinkedIn). Caso Clara Ramos, maio/2026. */}
              <button
                type="button"
                onClick={() => insertAtCaptionCursor('→ ')}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-gray-200 transition-colors px-1.5 py-0.5 rounded"
                title="Insere o caractere → na posição do cursor. Funciona no LinkedIn (digitar -> não funciona — vira texto puro lá)."
              >
                <span className="font-mono text-sm leading-none">→</span>
                <span>Inserir seta</span>
              </button>
              <span className="w-px h-3.5 bg-gray-300" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setShowTip(!showTip)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                <span>Dica</span>
              </button>
              {showTip && (
                <span className="text-xs text-muted-foreground">
                  No LinkedIn, <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px] font-mono">-&gt;</kbd> aparece como texto. Use o botão acima para inserir <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px] font-mono">→</kbd> de verdade.
                </span>
              )}
            </div>
            <Textarea
              id="caption"
              ref={captionRef}
              placeholder={t.colabNewPost.captionPlaceholder}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-[300px] border-0 rounded-none focus-visible:ring-0 resize-y text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground text-right mt-1">{caption.length} {t.colabNewPost.characters}</p>
        </div>

        {/* Media upload — suporta galeria multi-image. PDF/video/GIF sempre single. */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>{t.colabNewPost.media}</Label>
            {isGallery && (
              <span className="text-xs text-muted-foreground">
                {mediaItems.length} de {MAX_GALLERY_IMAGES} imagens
              </span>
            )}
          </div>

          {mediaItems.length === 0 ? (
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">{t.colabNewPost.clickToAdd}</span>
              <span className="text-xs text-muted-foreground mt-0.5">
                Imagens (JPG/PNG/WEBP, até 5MB cada, até {MAX_GALLERY_IMAGES} numa galeria) · GIF (até 5MB, 1 por post) · PDF (até 5MB) · Vídeo MP4/MOV (até 200MB)
              </span>
              <input
                type="file"
                accept={ACCEPTED_MEDIA_INPUT}
                multiple
                className="hidden"
                onChange={handleMediaChange}
              />
            </label>
          ) : isGallery ? (
            // Galeria de imagens: grid responsivo + slot pra adicionar mais
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {mediaItems.map((item, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt={`Imagem ${idx + 1}`} className="w-full h-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeMediaAt(idx)}
                    aria-label={`Remover imagem ${idx + 1}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {canAddMore && (
                <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                  <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Adicionar</span>
                  <input
                    type="file"
                    accept={ACCEPTED_MEDIA_INPUT}
                    multiple
                    className="hidden"
                    onChange={handleMediaChange}
                  />
                </label>
              )}
            </div>
          ) : (
            // Single image / video / GIF / PDF
            // Preview da mídia: object-contain + bg neutro pro user ver a
            // mídia inteira no formato original (antes era object-cover, que
            // recortava em retângulo horizontal — feedback Clara, maio/2026).
            // max-h-[600px] evita que fotos verticais gigantes (retrato
            // 1080×1920+) dominem a tela; abaixo disso o tamanho é livre.
            // mx-auto centraliza horizontalmente quando a foto é mais
            // estreita que o container.
            <div className="relative rounded-lg overflow-hidden border bg-muted/30 flex justify-center">
              {primaryKind === 'video' ? (
                <video src={mediaItems[0].previewUrl} controls className="max-h-[600px] max-w-full" />
              ) : primaryKind === 'pdf' ? (
                <div className="flex flex-col items-center justify-center h-40 w-full gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <span className="text-sm">PDF carregado</span>
                  <span className="text-xs text-muted-foreground">
                    O título abaixo aparece no carrossel do LinkedIn.
                  </span>
                </div>
              ) : mediaItems[0].previewUrl.startsWith('http') ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaItems[0].previewUrl} alt="Preview" className="max-h-[600px] max-w-full object-contain" />
              ) : (
                <Image src={mediaItems[0].previewUrl} alt="Preview" width={1200} height={800} className="max-h-[600px] w-auto h-auto max-w-full object-contain" />
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7"
                onClick={() => removeMediaAt(0)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              {/* Quando é 1 imagem só, oferece adicionar mais pra virar galeria */}
              {primaryKind === 'image' && (
                <label className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-background/95 backdrop-blur border text-xs cursor-pointer hover:bg-accent transition-colors">
                  <Upload className="h-3.5 w-3.5" />
                  Adicionar imagem
                  <input
                    type="file"
                    accept={ACCEPTED_MEDIA_INPUT}
                    multiple
                    className="hidden"
                    onChange={handleMediaChange}
                  />
                </label>
              )}
            </div>
          )}

          {/* Título do PDF — só aparece quando há PDF.
              É o que o LinkedIn renderiza como nome do carrossel na timeline
              (ex: "Como crescer mais que o setor · 7 pages"). Limite prático:
              100 caracteres. Sem isso, cai pro fallback "Documento". */}
          {primaryKind === 'pdf' && (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="documentTitle" className="text-sm font-medium">
                Título do PDF
              </Label>
              <Input
                id="documentTitle"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value.slice(0, 100))}
                placeholder="Ex: 5 perguntas que toda PME precisa responder"
                maxLength={100}
                disabled={!!publishedUrl}
              />
              <p className="text-xs text-muted-foreground">
                Aparece como nome do carrossel no LinkedIn. {documentTitle.length}/100
              </p>
            </div>
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
              <Label className="text-xs text-muted-foreground">Padrão (não removíveis)</Label>
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
