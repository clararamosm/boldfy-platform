'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { getAuthToken } from '@/lib/auth-client';
import { addPostComment, resolvePostComment, deletePostComment } from '@/app/actions/post-editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Trash2, Loader2, X, MessageSquareQuote } from 'lucide-react';
import { BoldfyIcon } from '@/components/icons/boldfy-icon';
import type { PostComment } from '@/lib/post-editor-types';

type Props = {
  comments: PostComment[];
  setComments: React.Dispatch<React.SetStateAction<PostComment[]>>;
  tlId: string;
  postId: string;
  canEdit: boolean;
  /** Pre-filled anchor from text selection — user is about to comment on a text snippet */
  pendingAnchor?: PostComment['anchor'] | null;
  /** Clear the pending anchor */
  onClearAnchor?: () => void;
  /** Currently active comment (highlight clicked in text) */
  activeCommentId?: string | null;
};

export function CommentsSidebar({
  comments,
  setComments,
  tlId,
  postId,
  pendingAnchor,
  onClearAnchor,
  activeCommentId,
}: Props) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const unresolvedComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  // Auto-focus textarea when a pending anchor arrives
  useEffect(() => {
    if (pendingAnchor) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [pendingAnchor]);

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      const result = await addPostComment(
        token,
        tlId,
        postId,
        newComment.trim(),
        pendingAnchor ?? undefined
      );
      if (result.comment) {
        setComments(prev => [...prev, result.comment!]);
        setNewComment('');
        onClearAnchor?.();
      }
    } catch {
      // silent
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, tlId, postId, setComments, pendingAnchor, onClearAnchor]);

  const handleResolve = useCallback(async (commentId: string) => {
    // Optimistic
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, resolved: true, resolvedAt: new Date().toISOString() } : c
    ));

    try {
      const token = await getAuthToken();
      await resolvePostComment(token, tlId, postId, commentId);
    } catch {
      // Revert
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, resolved: false, resolvedAt: undefined } : c
      ));
    }
  }, [tlId, postId, setComments]);

  const handleDelete = useCallback(async (commentId: string) => {
    const prev = comments;
    setComments(c => c.filter(x => x.id !== commentId));

    try {
      const token = await getAuthToken();
      const result = await deletePostComment(token, tlId, postId, commentId);
      if (result.error) {
        setComments(prev);
      }
    } catch {
      setComments(prev);
    }
  }, [comments, tlId, postId, setComments]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <aside className="w-80 border-l bg-muted/30 hidden lg:flex flex-col h-[calc(100vh-3.5rem)] sticky top-14">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          Comentários
          {unresolvedComments.length > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5 leading-none">
              {unresolvedComments.length}
            </span>
          )}
        </div>
      </div>

      {/* Comments list — active first, resolved below */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {comments.length === 0 && !pendingAnchor && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum comentário ainda.
            </p>
          )}
          {/* Active (unresolved) comments */}
          {unresolvedComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onResolve={handleResolve}
              onDelete={handleDelete}
              isActive={activeCommentId === comment.id}
            />
          ))}
          {/* Resolved comments — always visible, muted */}
          {resolvedComments.length > 0 && unresolvedComments.length > 0 && (
            <div className="border-t my-2" />
          )}
          {resolvedComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onResolve={handleResolve}
              onDelete={handleDelete}
              isActive={false}
            />
          ))}
        </div>
      </ScrollArea>

      {/* New comment input */}
      <div className="border-t p-3 space-y-2">
        {/* Pending anchor — show quoted text snippet */}
        {pendingAnchor && (
          <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-md p-2">
            <MessageSquareQuote className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-purple-600 font-medium mb-0.5">Comentando sobre:</p>
              <p className="text-xs text-purple-800 line-clamp-3 italic">
                &ldquo;{pendingAnchor.selectedText}&rdquo;
              </p>
            </div>
            <button
              type="button"
              onClick={onClearAnchor}
              className="text-purple-400 hover:text-purple-600 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={pendingAnchor ? 'Escreva seu feedback...' : 'Escreva um comentário... (Ctrl+Enter para enviar)'}
          className="text-xs min-h-[60px] resize-none"
          rows={2}
        />
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={handleSubmit}
          disabled={!newComment.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Enviar
        </Button>
      </div>
    </aside>
  );
}

// ---- Comment Item ----

function CommentItem({
  comment,
  onResolve,
  onDelete,
  isActive,
}: {
  comment: PostComment;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  isActive: boolean;
}) {
  const timeAgo = getRelativeTime(comment.createdAt);
  const isBot = comment.authorId === 'system';

  return (
    <div
      id={`comment-${comment.id}`}
      className={`group rounded-md border p-2.5 space-y-1.5 transition-colors ${
        comment.resolved
          ? 'opacity-60 bg-muted/50'
          : isActive
            ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-200'
            : 'bg-background'
      }`}
    >
      {/* Anchor quote — the highlighted text this comment refers to */}
      {comment.anchor && comment.anchor.selectedText && (
        <div className="bg-purple-50 border-l-2 border-purple-300 px-2 py-1 rounded-r-sm">
          <p className="text-[10px] text-purple-700 italic line-clamp-2">
            &ldquo;{comment.anchor.selectedText}&rdquo;
          </p>
        </div>
      )}

      {/* Author + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isBot && <BoldfyIcon className="h-4 w-4 rounded-sm shrink-0" />}
          <span className="text-xs font-medium">{isBot ? 'Boldfy Bot' : comment.authorName}</span>
          <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
        </div>
        <button
          onClick={() => onDelete(comment.id)}
          className="opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-opacity"
          title="Deletar"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      <p className="text-xs text-foreground whitespace-pre-wrap">{comment.content}</p>

      {/* Resolve checkbox */}
      {!comment.resolved && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <Checkbox
            id={`resolve-${comment.id}`}
            className="h-3.5 w-3.5"
            onCheckedChange={() => onResolve(comment.id)}
          />
          <label htmlFor={`resolve-${comment.id}`} className="text-[10px] text-muted-foreground cursor-pointer">
            Marcar como resolvido
          </label>
        </div>
      )}

      {comment.resolved && (
        <p className="text-[10px] text-green-600">✓ Resolvido</p>
      )}
    </div>
  );
}

// ---- Helpers ----

function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const date = new Date(isoDate).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
