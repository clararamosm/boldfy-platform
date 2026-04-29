'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquareQuote, Info } from 'lucide-react';
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

type HighlightAnchor = {
  commentId: string;
  startOffset: number;
  endOffset: number;
};

/**
 * Walk DOM text nodes to compute the absolute text offset
 * of a given (node, offset) pair relative to a container.
 */
function getTextOffset(container: Node, targetNode: Node, targetOffset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

  let node = walker.nextNode();
  while (node) {
    if (node === targetNode) {
      return total + targetOffset;
    }
    total += (node.textContent || '').length;
    node = walker.nextNode();
  }
  // Fallback: targetNode not found (e.g. element node with child offset)
  // Walk children up to targetOffset
  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    const children = targetNode.childNodes;
    let counted = 0;
    for (let i = 0; i < Math.min(targetOffset, children.length); i++) {
      counted += (children[i].textContent || '').length;
    }
    // Now find this position relative to container
    let containerOffset = 0;
    const containerWalker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let n = containerWalker.nextNode();
    while (n) {
      if (targetNode.contains(n)) {
        // Found the start of targetNode's text in container
        return containerOffset + counted;
      }
      containerOffset += (n.textContent || '').length;
      n = containerWalker.nextNode();
    }
    return containerOffset + counted;
  }
  return total + targetOffset;
}

/**
 * Apply <mark> highlights to a DOM container using text offsets.
 * This mutates the DOM directly instead of string manipulation,
 * which preserves all HTML structure (<br>, <p>, <div>, etc).
 */
function applyHighlightsToDOM(
  container: HTMLElement,
  anchors: HighlightAnchor[],
  activeCommentId?: string | null
) {
  if (anchors.length === 0) return;

  // Sort by startOffset descending so we process from end → start
  // This prevents earlier insertions from shifting later offsets
  const sorted = [...anchors].sort((a, b) => b.startOffset - a.startOffset);

  for (const anchor of sorted) {
    wrapTextRange(container, anchor.startOffset, anchor.endOffset, anchor.commentId, activeCommentId === anchor.commentId);
  }
}

/**
 * Wrap a text range [start, end) in a <mark> element within a DOM tree.
 * Walks text nodes and splits/wraps as needed.
 */
function wrapTextRange(
  container: HTMLElement,
  start: number,
  end: number,
  commentId: string,
  isActive: boolean,
) {
  if (start >= end) return;

  // Collect text nodes with their absolute offsets
  const textNodes: { node: Text; start: number; end: number }[] = [];
  let offset = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = (node.textContent || '').length;
    textNodes.push({ node: node as Text, start: offset, end: offset + len });
    offset += len;
    node = walker.nextNode();
  }

  // Find text nodes that overlap with [start, end)
  const overlapping = textNodes.filter(
    tn => tn.end > start && tn.start < end
  );

  if (overlapping.length === 0) return;

  const cls = isActive ? 'inline-highlight inline-highlight--active' : 'inline-highlight';

  // Process in reverse to avoid offset shifting
  for (let i = overlapping.length - 1; i >= 0; i--) {
    const tn = overlapping[i];
    const wrapStart = Math.max(start - tn.start, 0);
    const wrapEnd = Math.min(end - tn.start, tn.node.length);

    if (wrapStart >= wrapEnd) continue;

    // Split the text node if we don't wrap the whole thing
    let targetNode = tn.node;

    // Split off the "after" part
    if (wrapEnd < targetNode.length) {
      targetNode.splitText(wrapEnd);
    }

    // Split off the "before" part
    if (wrapStart > 0) {
      targetNode = targetNode.splitText(wrapStart);
    }

    // Wrap targetNode in <mark>
    const mark = document.createElement('mark');
    mark.className = cls;
    mark.setAttribute('data-comment-id', commentId);
    targetNode.parentNode?.replaceChild(mark, targetNode);
    mark.appendChild(targetNode);
  }
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
  const editorElRef = useRef<HTMLTextAreaElement>(null);
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number;
    y: number;
    anchor: AnchorData;
  } | null>(null);

  // Compute unresolved caption anchors (used in both modes)
  const unresolvedAnchors = useMemo(() => {
    return comments.filter(
      c => !c.resolved && c.anchor && c.anchor.field === 'caption'
    );
  }, [comments]);

  // Apply highlights via DOM manipulation after render
  useEffect(() => {
    if (canEdit || !containerRef.current) return;

    const highlightAnchors: HighlightAnchor[] = comments
      .filter(c => !c.resolved && c.anchor && c.anchor.field === 'caption')
      .map(c => ({
        commentId: c.id,
        startOffset: c.anchor!.startOffset,
        endOffset: c.anchor!.endOffset,
      }));

    // Include temporary selection highlight if popup is active
    if (selectionPopup) {
      highlightAnchors.push({
        commentId: '__temp__',
        startOffset: selectionPopup.anchor.startOffset,
        endOffset: selectionPopup.anchor.endOffset,
      });
    }

    if (highlightAnchors.length > 0) {
      applyHighlightsToDOM(containerRef.current, highlightAnchors, activeCommentId);

      // Restyle temp marks to use the temp class (blue instead of purple)
      if (selectionPopup) {
        containerRef.current.querySelectorAll('mark[data-comment-id="__temp__"]').forEach(m => {
          m.className = 'inline-highlight inline-highlight--temp';
        });
      }
    }
  // Re-apply when comments, value, or selection popup changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, comments, activeCommentId, value, selectionPopup]);

  // Note: Inline highlights in edit mode are not supported with textarea.
  // Comments are still visible in the sidebar and in read-only mode.

  // Close popup when scrolling
  useEffect(() => {
    if (!selectionPopup) return;
    const handleDismiss = () => setSelectionPopup(null);
    window.addEventListener('scroll', handleDismiss, true);
    return () => window.removeEventListener('scroll', handleDismiss, true);
  }, [selectionPopup]);

  // Close popup on mousedown outside popup
  useEffect(() => {
    if (!selectionPopup) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.selection-popup')) {
        setSelectionPopup(null);
      }
    };

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

    // Small delay so the browser finalizes the selection
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        return;
      }

      const range = selection.getRangeAt(0);

      // Make sure selection is within our container
      if (!containerRef.current!.contains(range.commonAncestorContainer)) {
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText || selectedText.length < 2) return;

      // Calculate text offsets relative to container's text content
      const startOffset = getTextOffset(containerRef.current!, range.startContainer, range.startOffset);
      const endOffset = startOffset + selectedText.length;

      // Get popup position from selection rect
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();

      // Clear browser selection — the useEffect will apply a temp highlight
      // after the re-render caused by setSelectionPopup
      selection.removeAllRanges();

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
    }, 10);
  }, [onAddInlineComment]);

  // Handle click on existing highlight
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mark = target.closest('mark[data-comment-id]');
    if (mark && onHighlightClick) {
      const commentId = mark.getAttribute('data-comment-id');
      if (commentId) {
        onHighlightClick(commentId);
        e.preventDefault();
      }
    }
  }, [onHighlightClick]);

  // Handle popup "Comentar" click
  const handleCommentClick = useCallback(() => {
    if (selectionPopup && onAddInlineComment) {
      onAddInlineComment(selectionPopup.anchor);
      setSelectionPopup(null);
    }
  }, [selectionPopup, onAddInlineComment]);

  // ─── Read-only mode ──────────────────────────────────

  if (!canEdit) {
    // Render plain text preserving whitespace/newlines.
    // If the value contains legacy HTML tags, strip them first so we always
    // work with plain text — then we render via whitespace-pre-wrap which
    // correctly preserves \n line breaks and special chars like →, ←, ↔.
    const isHtml = /<[a-z][\s\S]*>/i.test(value || '');
    let plainText = value || '';
    if (isHtml) {
      // Strip HTML: convert block-level closing tags → \n, strip remaining tags
      plainText = plainText
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:div|p|li|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // For inline comment highlights we still need a DOM-mutable container.
    // We build a sanitized HTML version only for highlight rendering, but the
    // TEXT content we display via whitespace-pre-wrap so newlines are preserved.
    const hasAnchors = comments.some(c => !c.resolved && c.anchor && c.anchor.field === 'caption');

    if (!plainText) {
      return (
        <div className="text-sm text-muted-foreground italic py-4">
          Nenhum conteúdo ainda.
        </div>
      );
    }

    // When there are anchors we need dangerouslySetInnerHTML so DOM highlight
    // manipulation works. We convert \n → <br> but wrap in a span with
    // white-space:pre-wrap so the browser still word-wraps normally.
    // When there are NO anchors, we use a plain <pre>-style div — simpler and safer.
    if (hasAnchors) {
      // Convert \n to <br> for dangerouslySetInnerHTML anchor mode
      const htmlWithBreaks = plainText.replace(/\n/g, '<br>');
      const sanitized = DOMPurify.sanitize(htmlWithBreaks, {
        ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'span', 'br', 'mark'],
        ALLOWED_ATTR: ['style', 'color', 'class', 'data-comment-id'],
      });

      return (
        <div className="relative py-4">
          {/* Inline highlight styles */}
          <style>{`
            .inline-highlight {
              background-color: rgb(243 232 255);
              border-radius: 2px;
              cursor: pointer;
              transition: background-color 0.15s;
              padding: 1px 0;
            }
            .inline-highlight:hover { background-color: rgb(233 213 255); }
            .inline-highlight--active {
              background-color: rgb(233 213 255);
              box-shadow: 0 0 0 1px rgb(216 180 254);
            }
            .inline-highlight--temp {
              background-color: rgb(219 234 254);
              border-radius: 2px;
              padding: 1px 0;
            }
          `}</style>
          <div
            ref={containerRef}
            className="text-sm leading-relaxed select-text"
            style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            dangerouslySetInnerHTML={{ __html: sanitized }}
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleCommentClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium shadow-lg hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                <MessageSquareQuote className="h-3.5 w-3.5" />
                Comentar
              </button>
              <div className="flex justify-center">
                <div className="w-2.5 h-2.5 bg-foreground rotate-45 -mt-1.5" />
              </div>
            </div>
          )}
        </div>
      );
    }

    // No anchors — pure plain text render (whitespace-pre-wrap, no DOMPurify needed)
    return (
      <div className="relative py-4">
        <div
          ref={containerRef}
          className="text-sm leading-relaxed select-text"
          style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
        >
          {plainText}
        </div>

        {/* Selection popup — "Comentar" button */}
        {selectionPopup && (
          <div
            className="selection-popup absolute z-50 -translate-x-1/2 -translate-y-full"
            style={{ left: selectionPopup.x, top: selectionPopup.y }}
          >
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCommentClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium shadow-lg hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <MessageSquareQuote className="h-3.5 w-3.5" />
              Comentar
            </button>
            <div className="flex justify-center">
              <div className="w-2.5 h-2.5 bg-foreground rotate-45 -mt-1.5" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Edit mode (strategist) ──────────────────────────

  const [showTip, setShowTip] = useState(false);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div className="py-2">
      <div className="border rounded-md overflow-hidden">
        {/* Info bar */}
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-gray-50">
          <button
            type="button"
            onClick={() => setShowTip(!showTip)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Atalhos</span>
          </button>
          {showTip && (
            <span className="text-xs text-muted-foreground">
              Use o caractere <kbd className="px-1 py-0.5 bg-gray-200 rounded text-[11px] font-mono">→</kbd> (seta) para destacar tópicos. Parênteses, colchetes e outros caracteres especiais são suportados normalmente.
            </span>
          )}
        </div>
        {/* Textarea editor */}
        <Textarea
          value={value}
          onChange={handleTextareaChange}
          placeholder="Escreva o conteúdo do post aqui..."
          className="min-h-[300px] border-0 rounded-none focus-visible:ring-0 resize-y text-sm"
          ref={editorElRef}
        />
      </div>
    </div>
  );
}
