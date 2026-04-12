'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/auth-client';
import { useAuth } from '@/contexts/auth-context';
import { getPostWithAccess, savePostWithVersion, getPostComments, getPostVersions, addBotComment } from '@/app/actions/post-editor';
import { updatePipelinePost } from '@/app/actions/content-pipeline';
import { useToast } from '@/hooks/use-toast';
import type { PipelinePost, PipelineStatus } from '@/app/actions/content-pipeline';
import type { PostComment, PostVersion } from '@/lib/post-editor-types';
import { PostHeaderBar } from './post-header-bar';
import { PostTitle } from './post-title';
import { PostProperties } from './post-properties';
import { PostBodyEditor } from './post-body-editor';
import { PostMediaSection } from './post-media-section';
import { CommentsSidebar } from './comments-sidebar';
import { VersionHistory } from './version-history';
import { Loader2 } from 'lucide-react';

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

type Props = {
  companyId: string;
  tlId: string;
  postId: string;
};

export function PostEditorShell({ companyId, tlId, postId }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  // Core state
  const [post, setPost] = useState<PipelinePost | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Breadcrumb names
  const [companyName, setCompanyName] = useState('');
  const [tlName, setTlName] = useState('');

  // Editable fields (local state for auto-save)
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Comments and versions
  const [comments, setComments] = useState<PostComment[]>([]);
  const [versions, setVersions] = useState<PostVersion[]>([]);

  // Auto-save refs
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastVersionTimeRef = useRef<number>(0);
  const titleRef = useRef(title);
  const captionRef = useRef(caption);

  // Keep refs in sync
  titleRef.current = title;
  captionRef.current = caption;

  // ---- Load post data ----
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getAuthToken();
        const result = await getPostWithAccess(token, tlId, postId);

        if (cancelled) return;

        if (result.error || !result.post) {
          setError(result.error || 'Post não encontrado.');
          setIsLoading(false);
          return;
        }

        setPost(result.post);
        setCanEdit(result.canEdit ?? false);
        setUserName(result.userName ?? '');
        setCompanyName(result.companyName ?? '');
        setTlName(result.tlName ?? '');
        setTitle(result.post.title);
        setCaption(result.post.caption);
        setIsLoading(false);

        // Load comments
        const commentsResult = await getPostComments(token, tlId, postId);
        if (!cancelled && commentsResult.comments) {
          setComments(commentsResult.comments);
        }

        // Load versions (only for editors)
        if (result.canEdit) {
          const versionsResult = await getPostVersions(token, tlId, postId);
          if (!cancelled && versionsResult.versions) {
            setVersions(versionsResult.versions);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Erro ao carregar post.');
          setIsLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tlId, postId]);

  // ---- Auto-save with debounce ----
  const triggerSave = useCallback(async () => {
    if (!canEdit) return;

    const currentTitle = titleRef.current;
    const currentCaption = captionRef.current;

    // Check if content actually changed from what's in the post
    if (currentTitle === post?.title && currentCaption === post?.caption) {
      setSaveStatus('saved');
      return;
    }

    setSaveStatus('saving');
    try {
      const token = await getAuthToken();

      // Throttle version creation: max 1 per 60 seconds
      const now = Date.now();
      if (now - lastVersionTimeRef.current < 60000) {
        // Just update the post without creating a version
        await updatePipelinePost(token, tlId, postId, {
          title: currentTitle,
          caption: currentCaption,
        });
      } else {
        // Save with version
        const result = await savePostWithVersion(token, tlId, postId, {
          title: currentTitle,
          caption: currentCaption,
        });

        if (result.versionId) {
          lastVersionTimeRef.current = now;
          // Refresh versions list
          const versionsResult = await getPostVersions(token, tlId, postId);
          if (versionsResult.versions) {
            setVersions(versionsResult.versions);
          }
        }
      }

      // Update local post reference
      setPost(prev => prev ? { ...prev, title: currentTitle, caption: currentCaption } : prev);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [canEdit, post, tlId, postId]);

  const scheduleSave = useCallback(() => {
    if (!canEdit) return;
    setSaveStatus('unsaved');

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      triggerSave();
    }, 3000);
  }, [canEdit, triggerSave]);

  // ---- Handle title/caption changes ----
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    scheduleSave();
  }, [scheduleSave]);

  const handleCaptionChange = useCallback((newCaption: string) => {
    setCaption(newCaption);
    scheduleSave();
  }, [scheduleSave]);

  // ---- Ctrl+S manual save ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }
        triggerSave();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerSave]);

  // ---- Handle property changes (immediate save) ----
  const handlePropertyChange = useCallback(async (field: string, value: unknown) => {
    if (!canEdit || !post) return;

    // Optimistic update
    setPost(prev => prev ? { ...prev, [field]: value } : prev);

    try {
      const token = await getAuthToken();
      await updatePipelinePost(token, tlId, postId, { [field]: value });
    } catch {
      // Revert on error
      setPost(prev => prev ? { ...prev, [field]: post[field as keyof PipelinePost] } : prev);
    }
  }, [canEdit, post, tlId, postId]);

  // ---- Handle force schedule ----
  const handleForceSchedule = useCallback(async () => {
    if (!canEdit || !post || !post.scheduledFor) return;

    // Optimistic: update status to postado (scheduled for publishing)
    const previousStatus = post.status;
    setPost(prev => prev ? { ...prev, status: 'postado' as PipelineStatus } : prev);

    try {
      const token = await getAuthToken();

      // Update status to postado
      await updatePipelinePost(token, tlId, postId, { status: 'postado' });

      // Format date for bot comment
      const d = new Date(post.scheduledFor);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}` !== '00:00' ? ` às ${hh}:${mm}` : '';

      const botMessage = `📅 Post agendado com sucesso para ${dateStr}${timeStr}.`;

      // Add bot comment
      const commentResult = await addBotComment(token, tlId, postId, botMessage);
      if (commentResult.comment) {
        setComments(prev => [...prev, commentResult.comment!]);
      }

      toast({
        title: 'Agendamento confirmado',
        description: `Post agendado para ${dateStr}${timeStr}.`,
      });
    } catch {
      // Revert on error
      setPost(prev => prev ? { ...prev, status: previousStatus } : prev);
      toast({
        title: 'Erro ao agendar',
        description: 'Não foi possível forçar o agendamento. Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [canEdit, post, tlId, postId, toast]);

  // ---- Handle version restore ----
  const handleRestore = useCallback(async (version: PostVersion) => {
    setTitle(version.title);
    setCaption(version.caption);
    setPost(prev => prev ? { ...prev, title: version.title, caption: version.caption } : prev);
    setSaveStatus('saved');

    // Refresh versions
    try {
      const token = await getAuthToken();
      const versionsResult = await getPostVersions(token, tlId, postId);
      if (versionsResult.versions) {
        setVersions(versionsResult.versions);
      }
    } catch {
      // silent
    }
  }, [tlId, postId]);

  // ---- Handle media update ----
  const handleMediaUpdate = useCallback((mediaUrl: string | undefined, mediaType: string | undefined) => {
    setPost(prev => prev ? { ...prev, mediaUrl, mediaType } : prev);
  }, []);

  // ---- Navigation back ----
  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
    } else {
      // Fallback based on role
      const role = user?.role;
      if (role === 'thoughtleader' || role === 'colaborador') {
        router.push('/thoughtleader/backlog');
      } else {
        router.push(`/strategist/pipeline?companyId=${companyId}&tlId=${tlId}`);
      }
    }
  }, [router, user, companyId, tlId]);

  // ---- Warn about unsaved changes ----
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saveStatus === 'unsaved') {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ---- Error state ----
  if (error || !post) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <p className="text-destructive font-medium">{error || 'Post não encontrado.'}</p>
          <button onClick={handleBack} className="text-sm text-muted-foreground underline hover:no-underline">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <PostHeaderBar
        companyName={companyName}
        tlName={tlName}
        postTitle={title || 'Sem título'}
        saveStatus={saveStatus}
        onBack={handleBack}
      />

      {/* Main content area */}
      <div className="flex">
        {/* Editor area */}
        <main className="flex-1 max-w-4xl mx-auto px-6 py-8 space-y-6">
          {/* Title */}
          <PostTitle
            value={title}
            onChange={handleTitleChange}
            canEdit={canEdit}
          />

          {/* Properties */}
          <PostProperties
            post={post}
            canEdit={canEdit}
            tlId={tlId}
            onPropertyChange={handlePropertyChange}
            onForceSchedule={handleForceSchedule}
          />

          {/* Body (caption) */}
          <PostBodyEditor
            value={caption}
            onChange={handleCaptionChange}
            canEdit={canEdit}
          />

          {/* Media */}
          <PostMediaSection
            post={post}
            canEdit={canEdit}
            tlId={tlId}
            postId={postId}
            onMediaUpdate={handleMediaUpdate}
          />

          {/* Version History (strategist only) */}
          {canEdit && versions.length > 0 && (
            <VersionHistory
              versions={versions}
              onRestore={handleRestore}
              tlId={tlId}
              postId={postId}
            />
          )}
        </main>

        {/* Comments sidebar */}
        <CommentsSidebar
          comments={comments}
          setComments={setComments}
          tlId={tlId}
          postId={postId}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
