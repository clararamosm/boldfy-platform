'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getAuthToken } from '@/lib/auth-client';
import { useAuth } from '@/contexts/auth-context';
import { getPostWithAccess, savePostWithVersion, getPostComments, getPostVersions, addBotComment, validateForceSchedule } from '@/app/actions/post-editor';
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
import { Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [showComments, setShowComments] = useState(false);
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

  // Inline comment state (text selection → comment flow)
  const [pendingAnchor, setPendingAnchor] = useState<PostComment['anchor'] | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Auto-save refs
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastVersionTimeRef = useRef<number>(0);
  const titleRef = useRef(title);
  const captionRef = useRef(caption);
  const postRef = useRef(post);

  // Keep refs in sync
  titleRef.current = title;
  captionRef.current = caption;
  postRef.current = post;

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
    const currentPost = postRef.current;

    // Check if content actually changed from what's in the post
    if (currentTitle === currentPost?.title && currentCaption === currentPost?.caption) {
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
  }, [canEdit, tlId, postId]);

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
    if (!canEdit || !postRef.current) return;

    // Capture the current value BEFORE the optimistic update for rollback
    const previousValue = postRef.current[field as keyof PipelinePost];

    // Optimistic update
    setPost(prev => prev ? { ...prev, [field]: value } : prev);

    try {
      const token = await getAuthToken();
      await updatePipelinePost(token, tlId, postId, { [field]: value });
    } catch {
      // Revert on error using the captured previous value (not stale closure)
      setPost(prev => prev ? { ...prev, [field]: previousValue } : prev);
    }
  }, [canEdit, tlId, postId]);

  // ---- Handle force schedule ----
  const handleForceSchedule = useCallback(async () => {
    const currentPost = postRef.current;
    if (!canEdit || !currentPost) return;

    try {
      const token = await getAuthToken();

      // 1. Validate before scheduling
      const validation = await validateForceSchedule(token, tlId, postId);

      if (!validation.valid) {
        // Validation failed — add bot comment with the specific error
        const errorMessage = `⚠️ Post não foi agendado: ${validation.error || 'Erro desconhecido.'}`;
        const commentResult = await addBotComment(token, tlId, postId, errorMessage);
        if (commentResult.comment) {
          setComments(prev => [...prev, commentResult.comment!]);
        }

        toast({
          title: 'Agendamento não realizado',
          description: validation.error || 'Verifique os requisitos e tente novamente.',
          variant: 'destructive',
        });
        return;
      }

      // 2. Validation passed — proceed with scheduling
      setPost(prev => prev ? { ...prev, status: 'agendado' as PipelineStatus } : prev);

      // Update status to agendado
      await updatePipelinePost(token, tlId, postId, { status: 'agendado' });

      // Format date for bot success comment
      const d = new Date(currentPost.scheduledFor!);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${mm}` !== '00:00' ? ` às ${hh}:${mm}` : '';

      const botMessage = `📅 Post agendado com sucesso para ${dateStr}${timeStr}.`;

      // Add bot success comment
      const commentResult = await addBotComment(token, tlId, postId, botMessage);
      if (commentResult.comment) {
        setComments(prev => [...prev, commentResult.comment!]);
      }

      toast({
        title: 'Agendamento confirmado',
        description: `Post agendado para ${dateStr}${timeStr}.`,
      });
    } catch {
      toast({
        title: 'Erro ao agendar',
        description: 'Não foi possível forçar o agendamento. Tente novamente.',
        variant: 'destructive',
      });
    }
  }, [canEdit, tlId, postId, toast]);

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

  // ---- Handle inline comment (text selection → anchor → sidebar) ----
  const handleAddInlineComment = useCallback((anchor: PostComment['anchor']) => {
    setPendingAnchor(anchor);
    setShowComments(true); // Open sidebar on mobile too
  }, []);

  const handleHighlightClick = useCallback((commentId: string) => {
    setActiveCommentId(commentId);
    setShowComments(true);
    // Scroll to the comment in the sidebar
    setTimeout(() => {
      const el = document.getElementById(`comment-${commentId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const handleClearAnchor = useCallback(() => {
    setPendingAnchor(null);
  }, []);

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

      {/* Mobile comments toggle */}
      <div className="lg:hidden fixed bottom-4 right-4 z-50">
        <Button
          size="icon"
          variant={showComments ? "default" : "outline"}
          className="rounded-full h-12 w-12 shadow-lg"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageSquare className="h-5 w-5" />
          {comments.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {comments.length}
            </span>
          )}
        </Button>
      </div>

      {/* Main content area */}
      <div className="flex">
        {/* Editor area */}
        <main className={`flex-1 max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6 ${showComments ? 'hidden lg:block' : ''}`}>
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
            comments={comments}
            onAddInlineComment={handleAddInlineComment}
            onHighlightClick={handleHighlightClick}
            activeCommentId={activeCommentId}
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

        {/* Comments sidebar — hidden on mobile, toggle with floating button */}
        <div className={`${showComments ? 'block' : 'hidden'} lg:block`}>
        <CommentsSidebar
          comments={comments}
          setComments={setComments}
          tlId={tlId}
          postId={postId}
          canEdit={canEdit}
          pendingAnchor={pendingAnchor}
          onClearAnchor={handleClearAnchor}
          activeCommentId={activeCommentId}
        />
        </div>
      </div>
    </div>
  );
}
