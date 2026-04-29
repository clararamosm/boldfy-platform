'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { getAuthToken } from '@/lib/auth-client';
import {
  addPostComment,
  addPostCommentWithAttachments,
  resolvePostComment,
  deletePostComment,
} from '@/app/actions/post-editor';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Send,
  Trash2,
  Loader2,
  X,
  MessageSquareQuote,
  Paperclip,
  FileText,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { BoldfyIcon } from '@/components/icons/boldfy-icon';
import type { PostComment, CommentAttachment } from '@/lib/post-editor-types';

// ---- Constants ----

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_ATTACHMENTS = 5;

// ---- Pending attachment (before upload) ----

type PendingFile = {
  /** Unique key for list rendering */
  key: string;
  file: File;
  /** Local object URL for preview */
  previewUrl: string;
  type: 'image' | 'pdf';
};

// ---- Props ----

type Props = {
  comments: PostComment[];
  setComments: React.Dispatch<React.SetStateAction<PostComment[]>>;
  tlId: string;
  postId: string;
  canEdit: boolean;
  /** Pre-filled anchor from text selection */
  pendingAnchor?: PostComment['anchor'] | null;
  onClearAnchor?: () => void;
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
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const unresolvedComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach(f => URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-focus textarea when a pending anchor arrives
  useEffect(() => {
    if (pendingAnchor) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [pendingAnchor]);

  // ---- File selection ----

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // Reset input so the same file can be re-selected

    const newPending: PendingFile[] = [];
    const currentCount = pendingFiles.length;

    for (const file of files) {
      if (currentCount + newPending.length >= MAX_ATTACHMENTS) {
        toast({
          title: 'Limite de anexos atingido',
          description: `Máximo de ${MAX_ATTACHMENTS} arquivos por comentário.`,
          variant: 'destructive',
        });
        break;
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast({
          title: 'Formato não suportado',
          description: `${file.name}: use JPG, PNG, WEBP, GIF ou PDF.`,
          variant: 'destructive',
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'Arquivo muito grande',
          description: `${file.name}: máximo 10 MB.`,
          variant: 'destructive',
        });
        continue;
      }

      const type: 'image' | 'pdf' = file.type === 'application/pdf' ? 'pdf' : 'image';
      const previewUrl = type === 'image' ? URL.createObjectURL(file) : '';
      newPending.push({ key: `${Date.now()}-${file.name}`, file, previewUrl, type });
    }

    if (newPending.length > 0) {
      setPendingFiles(prev => [...prev, ...newPending]);
    }
  }, [pendingFiles.length, toast]);

  const handleRemovePendingFile = useCallback((key: string) => {
    setPendingFiles(prev => {
      const removed = prev.find(f => f.key === key);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter(f => f.key !== key);
    });
  }, []);

  // ---- Submit ----

  const handleSubmit = useCallback(async () => {
    const hasText = newComment.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if (!hasText && !hasFiles) return;

    setIsSubmitting(true);
    try {
      const token = await getAuthToken();

      if (hasFiles) {
        // Upload all files to Firebase Storage, then persist comment with attachment metadata
        const uploaded: CommentAttachment[] = [];

        for (const pending of pendingFiles) {
          const ext = pending.file.name.split('.').pop() || (pending.type === 'pdf' ? 'pdf' : 'png');
          const path = `pipeline/${tlId}/${postId}/comment-attachments/${Date.now()}-${pending.file.name}`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, pending.file);
          const url = await getDownloadURL(fileRef);

          uploaded.push({
            url,
            name: pending.file.name,
            mimeType: pending.file.type,
            type: pending.type,
            size: pending.file.size,
          });
        }

        const result = await addPostCommentWithAttachments(
          token,
          tlId,
          postId,
          newComment.trim(),
          uploaded,
          pendingAnchor ?? undefined
        );

        if (result.comment) {
          setComments(prev => [...prev, result.comment!]);
          setNewComment('');
          setPendingFiles(prev => {
            prev.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
            return [];
          });
          onClearAnchor?.();
        } else if (result.error) {
          toast({ title: 'Erro ao enviar comentário', description: result.error, variant: 'destructive' });
        }
      } else {
        // Text-only comment — use the existing action (no overhead)
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
        } else if (result.error) {
          toast({ title: 'Não foi possível enviar o comentário', description: result.error, variant: 'destructive' });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.';
      toast({ title: 'Não foi possível enviar o comentário', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, pendingFiles, tlId, postId, setComments, pendingAnchor, onClearAnchor, toast]);

  const handleResolve = useCallback(async (commentId: string) => {
    // Optimistic
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, resolved: true, resolvedAt: new Date().toISOString() } : c
    ));
    try {
      const token = await getAuthToken();
      await resolvePostComment(token, tlId, postId, commentId);
    } catch {
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
      if (result.error) setComments(prev);
    } catch {
      setComments(prev);
    }
  }, [comments, tlId, postId, setComments]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const canSubmit = (newComment.trim().length > 0 || pendingFiles.length > 0) && !isSubmitting;

  return (
    <aside className="w-full lg:w-80 border-l bg-muted/30 flex flex-col h-[calc(100vh-3.5rem)] lg:sticky lg:top-14">
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

      {/* Comments list */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {comments.length === 0 && !pendingAnchor && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum comentário ainda.
            </p>
          )}
          {unresolvedComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onResolve={handleResolve}
              onDelete={handleDelete}
              isActive={activeCommentId === comment.id}
            />
          ))}
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
        {/* Pending anchor — quoted text snippet */}
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

        {/* Pending files preview */}
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {pendingFiles.map(f => (
              <div key={f.key} className="relative group/file">
                {f.type === 'image' ? (
                  <img
                    src={f.previewUrl}
                    alt={f.file.name}
                    className="h-14 w-14 rounded-md object-cover border bg-muted"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-md border bg-muted flex flex-col items-center justify-center gap-1">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground truncate w-11 text-center leading-tight">
                      {f.file.name.length > 10 ? f.file.name.substring(0, 8) + '…' : f.file.name}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemovePendingFile(f.key)}
                  className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
            {pendingFiles.length < MAX_ATTACHMENTS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-14 w-14 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-muted-foreground/60 hover:bg-muted/50 transition-colors"
                title="Adicionar mais arquivos"
              >
                <Paperclip className="h-4 w-4 text-muted-foreground/50" />
              </button>
            )}
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingAnchor
              ? 'Escreva seu feedback... (Enter envia, Shift+Enter quebra linha)'
              : pendingFiles.length > 0
                ? 'Adicione uma descrição (opcional)...'
                : 'Escreva um comentário... (Enter envia, Shift+Enter quebra linha)'
          }
          className="text-xs min-h-[60px] resize-none"
          rows={2}
        />

        {/* Actions row */}
        <div className="flex items-center gap-2">
          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || pendingFiles.length >= MAX_ATTACHMENTS}
            className="text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors p-1.5 rounded-md hover:bg-muted"
            title="Anexar imagem ou PDF"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          {/* Send button */}
          <Button
            size="sm"
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isSubmitting ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>

        {/* Hint for attach formats */}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Anexe imagens (JPG, PNG, WEBP, GIF) ou PDFs — até 10 MB cada, máx. {MAX_ATTACHMENTS} por comentário.
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          multiple
          onChange={handleFileSelect}
        />
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
          : comment.commentType === 'adjustment'
            ? 'bg-orange-50 border-orange-200'
            : isActive
              ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-200'
              : 'bg-background'
      }`}
    >
      {/* Adjustment tag */}
      {comment.commentType === 'adjustment' && !comment.resolved && (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 uppercase tracking-wider">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Ajuste solicitado
        </div>
      )}

      {/* Anchor quote */}
      {comment.anchor && comment.anchor.selectedText && (
        <div className="bg-purple-50 border-l-2 border-purple-300 px-2 py-1 rounded-r-sm">
          <p className="text-[10px] text-purple-700 italic line-clamp-2">
            &ldquo;{comment.anchor.selectedText}&rdquo;
          </p>
        </div>
      )}

      {/* Author + time + delete */}
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
      {comment.content && (
        <p className="text-xs text-foreground whitespace-pre-wrap">{comment.content}</p>
      )}

      {/* Attachments */}
      {comment.attachments && comment.attachments.length > 0 && (
        <CommentAttachments attachments={comment.attachments} />
      )}

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

// ---- Attachments display ----

function CommentAttachments({ attachments }: { attachments: CommentAttachment[] }) {
  const images = attachments.filter(a => a.type === 'image');
  const pdfs = attachments.filter(a => a.type === 'pdf');

  return (
    <div className="space-y-1.5">
      {/* Image grid */}
      {images.length > 0 && (
        <div className={`grid gap-1 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {images.map((att, i) => (
            <a
              key={i}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded overflow-hidden border bg-muted hover:opacity-90 transition-opacity"
            >
              <img
                src={att.url}
                alt={att.name}
                className="w-full object-cover"
                style={{ maxHeight: images.length === 1 ? '200px' : '90px' }}
              />
            </a>
          ))}
        </div>
      )}
      {/* PDFs */}
      {pdfs.map((att, i) => (
        <a
          key={i}
          href={att.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded-md border bg-muted hover:bg-muted/80 transition-colors"
        >
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs truncate flex-1">{att.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatFileSize(att.size)}
          </span>
        </a>
      ))}
    </div>
  );
}

// ---- Helpers ----

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
