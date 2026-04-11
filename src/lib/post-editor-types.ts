// src/lib/post-editor-types.ts
// Types for the dedicated post editor page — shared between client and server.

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
  // Future: inline selection feedback (Notion-style text highlight + comment)
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
