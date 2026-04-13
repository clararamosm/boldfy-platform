'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SimpleRichEditor } from '@/components/ui/simple-rich-editor';
import { MessageSquareQuote } from 'lucide-react';
import DOMPurify from 'dompurify';
import type { PostComment } from '@/lib/post-editor-types';

type AnchorData = NonNullable<PostComment['anchor']>;

type Props = {
  value: string;
  onChange: (value: string) => void;
  canEdit: boolean;
  /** All comments — used to render inline highlights */
  comments?: PostComment[];
  /** Called when user selects text and clicks "Comentar" */
  onAddInlineComment?: (anchor: AnchorData) => void;
  /** Called when user clicks on a highlight in the text */
  onHighlightClick?: (commentId: string) => void;
  /** Currently active (focused) comment ID — for highlight styling */
  activeCommentId?: string | null;
};

// ─── Utilities ──────────────────────────────────────────

/** Strip HTML tags to get plain text (preserving line breaks as \n) */
function htmlToPlainText(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * Walk DOM tree to compute text offset of a given node+offset pair
 * relative to a container element.
 */
function getTextOffset(container: Node, targetNode: Node, targetOffset: number): number {
  let offset = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  let node = walker.nextNode();
  while (node) {
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += (node.textContent || '').length;
    node = walker.nextNode();
  }
  return offset + targetOffset;
}

type HighlightAnchor = {
  commentId: string;
  startOffset: number;
  endOffset: number;
};

/**
 * Insert <mark> tags into HTML based on text offsets from anchors.
 * Works on plain text positions and re-wraps into the HTML structure.
 */
function applyHighlights(
  html: string,
  anchors: HighlightAnchor[],
  activeCommentId?: string | null
): string {
  if (anchors.length === 0) return html;

  const plainText = htmlToPlainText(html);

  // Sort anchors by startOffset (handle overlaps by processing from end)
  const sorted = [...anchors].sort((a, b) => a.startOffset - b.startOffset);

  // Build highlighted plain text with mark tags
  let result = '';
  let cursor = 0;

  for (const anchor of sorted) {
    const start = Math.max(anchor.startOffset, cursor);
    const end = Math.min(anchor.endOffset, plainText.length);
    if (start >= end) continue;

    // Text before this highlight
    result += escapeHtml(plainText.slice(cursor, start));

    // The highlighted portion
    const isActive = activeCommentId === anchor.commentId;
    const cls = isActive
      ? 'inline-highlight inline-highlight--active'
      : 'inline-highlight';
    result += `<mark class="${cls}" data-comment-id="${anchor.commentId}">${escapeHtml(plainText.slice(start, end))}</mark>`;
    cursor = end;
  }

  // Remaining text
  result += escapeHtml(plainText.slice(cursor));

  // Convert newlines to <br>
  result = result.replace(/\n/g, '<br>');

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Component ──────────────────────────────────────────

export function PostBodyEditor({
  value,
  onChange,
  canEdit,
  comments = [],
  onAddInlineComment,
  onHighlightClick,
  activeCommentId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number;
    y: number;
    anchor: AnchorData;
  } | null>(null);

  // Close popup when clicking outside or scrolling
  useEffect(() => {
    if (!selectionPopup) return;

    const handleDismiss = () => setSelectionPopup(null);
    window.addEventListener('scroll', handleDismiss, true);
    return () => window.removeEventListener('scroll', handleDismiss, true);
  }, [selectionPopup]);

  // Close popup on any click outside the popup itself
  useEffect(() => {
    if (!selectionPopup) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.selection-popup')) {
        setSelectionPopup(null);
      }
    };

    // Delay to avoid immediately closing from the mouseup that opened it
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectionPopup]);

  // Handle text selection in read-only mode
  const handleMouseUp = useCallback(() => {
    if (!containerRef.current || !onAddInlineComment) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      return;
    }

    const range = selection.getRangeAt(0);

    // Make sure selection is within our container
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText || selectedText.length < 2) return;

    // Calculate text offsets relative to plain text
    const startOffset = getTextOffset(containerRef.current, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(containerRef.current, range.endContainer, range.endOffset);

    // Get popup position from selection rect
    const rect = range.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setSelectionPopup({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      anchor: {
        field: 'caption',
        startOffset,
        endOffset,
        selectedText,
      },
    });
  }, [onAddInlineComment]);

  // Handle click on existing highlight
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mark = target.closest('mark[data-comment-id]');
    if (mark && onHighlightClick) {
      const commentId = mark.getAttribute('data-comment-id');
      if (commentId) {
        onHighlightClick(commentId);
      }
    }
  }, [onHighlightClick]);

  // Handle popup "Comentar" click
  const handleCommentClick = useCallback(() => {
    if (selectionPopup && onAddInlineComment) {
      onAddInlineComment(selectionPopup.anchor);
      window.getSelection()?.removeAllRanges();
      setSelectionPopup(null);
    }
  }, [selectionPopup, onAddInlineComment]);

  // ─── Read-only mode ──────────────────────────────────

  if (!canEdit) {
    const sanitized = DOMPurify.sanitize(value || '', {
      ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'span', 'br', 'p', 'div', 'mark', 'font'],
      ALLOWED_ATTR: ['style', 'color', 'class', 'data-comment-id'],
    });

    if (!sanitized) {
      return (
        <div className="text-sm text-muted-foreground italic py-4">
          Nenhum conteúdo ainda.
        </div>
      );
    }

    // Build highlight anchors from unresolved comments
    const highlightAnchors: HighlightAnchor[] = comments
      .filter(c => !c.resolved && c.anchor && c.anchor.field === 'caption')
      .map(c => ({
        commentId: c.id,
        startOffset: c.anchor!.startOffset,
        endOffset: c.anchor!.endOffset,
      }));

    const htmlWithHighlights = applyHighlights(sanitized, highlightAnchors, activeCommentId);

    return (
      <div className="relative py-4">
        {/* Inline highlight styles */}
        <style>{`
          .inline-highlight {
            background-color: rgb(243 232 255); /* purple-100 */
            border-radius: 2px;
            cursor: pointer;
            transition: background-color 0.15s;
            padding: 1px 0;
          }
          .inline-highlight:hover {
            background-color: rgb(233 213 255); /* purple-200 */
          }
          .inline-highlight--active {
            background-color: rgb(233 213 255); /* purple-200 */
            box-shadow: 0 0 0 1px rgb(216 180 254); /* purple-300 */
          }
        `}</style>

        <div
          ref={containerRef}
          className="prose prose-sm max-w-none select-text"
          dangerouslySetInnerHTML={{ __html: htmlWithHighlights }}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
        />

        {/* Selection popup — "Comentar" button */}
        {selectionPopup && (
          <div
            className="selection-popup absolute z-50 -translate-x-1/2 -translate-y-full"
            style={{ left: selectionPopup.x, top: selectionPopup.y }}
          >
            <button
              type="button"
              onClick={handleCommentClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium shadow-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <MessageSquareQuote className="h-3.5 w-3.5" />
              Comentar
            </button>
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-2.5 h-2.5 bg-foreground rotate-45 -mt-1.5" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Edit mode (strategist) ──────────────────────────

  // In edit mode, show highlights overlay is complex with contentEditable.
  // For now, strategist sees comments in the sidebar with anchor quotes.
  return (
    <div className="py-2">
      <SimpleRichEditor
        value={value}
        onChange={onChange}
        placeholder="Escreva o conteúdo do post aqui..."
        className="min-h-[300px]"
      />
    </div>
  );
}
