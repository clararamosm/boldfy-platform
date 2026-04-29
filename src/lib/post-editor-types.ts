// src/lib/post-editor-types.ts
// Types for the dedicated post editor page — shared between client and server.

export type CommentAttachment = {
  /** Firebase Storage download URL */
  url: string;
  /** Original file name */
  name: string;
  /** MIME type — image/*, application/pdf */
  mimeType: string;
  /** 'image' | 'pdf' */
  type: 'image' | 'pdf';
  /** File size in bytes */
  size: number;
};

export type PostComment = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: 'strategist' | 'thoughtleader';
  content: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Files attached to this comment (images, PDFs) */
  attachments?: CommentAttachment[];
  /**
   * Special comment types:
   * - 'adjustment': created automatically when TL clicks "Pedir Ajuste"
   * - undefined/omitted: regular comment
   */
  commentType?: 'adjustment';
  // Inline selection feedback (Notion-style text highlight + comment)
  anchor?: {
    field: 'caption' | 'title';
    startOffset: number;
    endOffset: number;
    selectedText: string;
  } | null;
};

export type PostVersion = {
  id: string;
  title: string;
  caption: string;
  savedBy: string;
  savedByName: string;
  createdAt: string;
};
