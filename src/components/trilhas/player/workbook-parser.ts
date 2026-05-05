// src/components/trilhas/player/workbook-parser.ts
// Parser that splits HTML containing custom interactive tags into renderable chunks.
// Custom tags (<input-field>, <input-area>, <input-list>, <input-select>) are extracted
// BEFORE DOMPurify sanitization so they aren't stripped.

import DOMPurify from 'dompurify';

// ─── Chunk Types ────────────────────────────────────────────
export type HtmlChunk = { type: 'html'; content: string };
export type FieldChunk = { type: 'input-field'; id: string; placeholder?: string };
export type AreaChunk = { type: 'input-area'; id: string; placeholder?: string; rows?: number };
export type ListChunk = { type: 'input-list'; id: string; items: number; placeholder?: string };
export type SelectChunk = {
  type: 'input-select';
  id: string;
  options: { value: string; label: string }[];
};

export type WorkbookChunk = HtmlChunk | FieldChunk | AreaChunk | ListChunk | SelectChunk;

// ─── DOMPurify Config (same as module-renderer) ──────────────
const SANITIZE_CONFIG = {
  ADD_TAGS: [
    'svg', 'path', 'rect', 'circle', 'line', 'text', 'g', 'defs', 'marker',
    'polygon', 'polyline', 'ellipse', 'use', 'symbol', 'clipPath',
    'linearGradient', 'radialGradient', 'stop', 'foreignObject',
    'h2', 'h3', 'strong', 'em', 's', 'u', 'a', 'mark', 'img',
    'ul', 'ol', 'li', 'blockquote',
  ],
  ADD_ATTR: [
    'viewBox', 'xmlns', 'fill', 'stroke', 'd', 'cx', 'cy', 'r', 'x', 'y',
    'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points', 'transform',
    'opacity', 'rx', 'ry', 'font-size', 'font-weight', 'text-anchor',
    'marker-end', 'marker-start', 'refX', 'refY', 'markerWidth', 'markerHeight',
    'orient', 'gradientUnits', 'offset', 'stop-color', 'stop-opacity', 'clip-path',
    'href', 'class', 'target', 'rel', 'src', 'alt',
  ],
};

// ─── Regex to match custom tags ─────────────────────────────
// Matches: <input-field id="xxx" placeholder="..." />
//          <input-area id="xxx" placeholder="..." />
//          <input-list id="xxx" items="5" />
//          <input-select id="xxx" options="V1: L1, V2: L2" />
// Also handles non-self-closing variants: <input-field ...></input-field>
const TAG_REGEX = /<input-(field|area|list|select)\s+([^>]*?)\/?\s*>(?:<\/input-\1>)?/gi;

// ─── Attribute Parser ───────────────────────────────────────
function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const ATTR_REGEX = /(\w[\w-]*)="([^"]*)"/g;
  let match;
  while ((match = ATTR_REGEX.exec(attrString))) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

// ─── Options Parser (for input-select) ──────────────────────
// Format: "Verde: Convergencia, Amarelo: Gap, Vermelho: Surpresa"
function parseSelectOptions(optionsStr: string): { value: string; label: string }[] {
  return optionsStr.split(',').map(opt => {
    const parts = opt.trim().split(':');
    if (parts.length >= 2) {
      return { value: parts[0].trim(), label: parts.slice(1).join(':').trim() };
    }
    return { value: parts[0].trim(), label: parts[0].trim() };
  }).filter(opt => opt.value.length > 0);
}

// ─── Main Parser ────────────────────────────────────────────
export function parseWorkbookHtml(html: string): WorkbookChunk[] {
  const chunks: WorkbookChunk[] = [];
  let lastIndex = 0;

  // Reset regex state
  TAG_REGEX.lastIndex = 0;

  let match;
  while ((match = TAG_REGEX.exec(html)) !== null) {
    // Add HTML chunk before this tag (if any)
    if (match.index > lastIndex) {
      const rawHtml = html.slice(lastIndex, match.index).trim();
      if (rawHtml.length > 0) {
        chunks.push({
          type: 'html',
          content: DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG),
        });
      }
    }

    const tagType = match[1].toLowerCase(); // field, area, list, select
    const attrs = parseAttributes(match[2]);

    switch (tagType) {
      case 'field':
        chunks.push({
          type: 'input-field',
          id: attrs.id || `field-${chunks.length}`,
          placeholder: attrs.placeholder,
        });
        break;

      case 'area':
        chunks.push({
          type: 'input-area',
          id: attrs.id || `area-${chunks.length}`,
          placeholder: attrs.placeholder,
          rows: attrs.rows ? parseInt(attrs.rows, 10) : undefined,
        });
        break;

      case 'list':
        chunks.push({
          type: 'input-list',
          id: attrs.id || `list-${chunks.length}`,
          items: attrs.items ? parseInt(attrs.items, 10) : 3,
          placeholder: attrs.placeholder,
        });
        break;

      case 'select':
        chunks.push({
          type: 'input-select',
          id: attrs.id || `select-${chunks.length}`,
          options: attrs.options ? parseSelectOptions(attrs.options) : [],
        });
        break;
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining HTML after last tag
  if (lastIndex < html.length) {
    const rawHtml = html.slice(lastIndex).trim();
    if (rawHtml.length > 0) {
      chunks.push({
        type: 'html',
        content: DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG),
      });
    }
  }

  return chunks;
}

// ─── Helper: count interactive fields in chunks ─────────────
export function countWorkbookFields(chunks: WorkbookChunk[]): number {
  return chunks.reduce((count, chunk) => {
    if (chunk.type === 'html') return count;
    if (chunk.type === 'input-list') return count + chunk.items;
    return count + 1;
  }, 0);
}

// ─── Helper: count filled fields ────────────────────────────
export function countFilledFields(
  chunks: WorkbookChunk[],
  responses: Record<string, string | string[]>
): number {
  return chunks.reduce((count, chunk) => {
    if (chunk.type === 'html') return count;
    const value = responses[chunk.id];
    if (!value) return count;
    if (chunk.type === 'input-list') {
      // Count each non-empty item in the list
      if (Array.isArray(value)) {
        return count + value.filter(v => v.trim().length > 0).length;
      }
      return count;
    }
    // For field, area, select: count if non-empty
    if (typeof value === 'string' && value.trim().length > 0) return count + 1;
    return count;
  }, 0);
}
