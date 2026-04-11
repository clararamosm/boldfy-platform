'use client';

import { useState, useCallback } from 'react';
import { getAuthToken } from '@/lib/auth-client';
import { addPostComment, resolvePostComment, deletePostComment } from '@/app/actions/post-editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import type { PostComment } from '@/lib/post-editor-types';

type Props = {
  comments: PostComment[];
  setComments: React.Dispatch<React.SetStateAction<PostComment[]>>;
  tlId: string;
  postId: string;
  canEdit: boolean;
};

export function CommentsSidebar({ comments, setComments, tlId, postId }: Props) {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const unresolvedComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);
  const visibleComments = showResolved ? comments : unresolvedComments;

  const handleSubmit = useCallback(async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();
      const result = await addPostComment(token, tlId, postId, newComment.trim());
      if (result.comment) {
        setComments(prev => [...prev, result.comment!]);
        setNewComment('');
      }
    } catch {
      // silent
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, tlId, postId, setComments]);

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
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          Comentários
          {unresolvedComments.length > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 py-0.5 leading-none">
              {unresolvedComments.length}
            </span>
          )}
        </div>
        {resolvedComments.length > 0 && (
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            {showResolved ? 'Ocultar resolvidos' : `${resolvedComments.length} resolvido(s)`}
          </button>
        )}
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {visibleComments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum comentário ainda.
            </p>
          )}
          {visibleComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onResolve={handleResolve}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </ScrollArea>

      {/* New comment input */}
      <div className="border-t p-3 space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escreva um comentário... (Ctrl+Enter para enviar)"
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
}: {
  comment: PostComment;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const timeAgo = getRelativeTime(comment.createdAt);

  return (
    <div className={`rounded-md border p-2.5 space-y-1.5 ${comment.resolved ? 'opacity-60 bg-muted/50' : 'bg-background'}`}>
      {/* Author + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{comment.authorName}</span>
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
