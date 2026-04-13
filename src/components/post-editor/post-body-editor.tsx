'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { SimpleRichEditor } from '@/components/ui/simple-rich-editor';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { MessageSquareQuote, ChevronDown } from 'lucide-react';
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
  const previewRef = useRef<HTMLDivElement>(null);
  const [showHighlightPreview, setShowHighlightPreview] = useState(true);
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

  // Apply highlights to the edit-mode preview section
  useEffect(() => {
    if (!canEdit || !previewRef.current) return;

    const highlightAnchors: HighlightAnchor[] = unresolvedAnchors.map(c => ({
      commentId: c.id,
      startOffset: c.anchor!.startOffset,
      endOffset: c.anchor!.endOffset,
    }));

    if (highlightAnchors.length > 0) {
      applyHighlightsToDOM(previewRef.current, highlightAnchors, activeCommentId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, unresolvedAnchors, activeCommentId, value]);

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
          .inline-highlight--temp {
            background-color: rgb(219 234 254); /* blue-100 */
            border-radius: 2px;
            padding: 1px 0;
          }
        `}</style>

        <div
          ref={containerRef}
          className="prose prose-sm max-w-none select-text"
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
              onMouseDown={(e) => e.preventDefault()} // Prevent stealing focus/selection
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

  const hasHighlights = unresolvedAnchors.length > 0;

  return (
    <div className="py-2 space-y-3">
      {/* Editor */}
      <SimpleRichEditor
        value={value}
        onChange={onChange}
        placeholder="Escreva o conteúdo do post aqui..."
        className="min-h-[300px]"
      />

      {/* Highlight preview — only when there are unresolved inline comments */}
      {hasHighlights && (
        <Collapsible open={showHighlightPreview} onOpenChange={setShowHighlightPreview}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <MessageSquareQuote className="h-3.5 w-3.5" />
              <span>Comentários no texto ({unresolvedAnchors.length})</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showHighlightPreview ? 'rotate-180' : ''}`}
              />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            {/* Inline highlight styles */}
            <style>{`
              .inline-highlight {
                background-color: rgb(243 232 255);
                border-radius: 2px;
                cursor: pointer;
                transition: background-color 0.15s;
                padding: 1px 0;
              }
              .inline-highlight:hover {
                background-color: rgb(233 213 255);
              }
              .inline-highlight--active {
                background-color: rgb(233 213 255);
                box-shadow: 0 0 0 1px rgb(216 180 254);
              }
            `}</style>

            <div
              ref={previewRef}
              className="prose prose-sm max-w-none mt-2 p-3 rounded-md border border-dashed border-purple-200 bg-purple-50/30 select-text text-sm"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(value || '', {
                  ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'span', 'br', 'p', 'div', 'mark', 'font'],
                  ALLOWED_ATTR: ['style', 'color', 'class', 'data-comment-id'],
                }),
              }}
              onClick={handleClick}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
