// src/components/trilhas/player/workbook-parser.ts
// Parser that splits HTML containing custom interactive tags into renderable chunks.
// Custom tags (<input-field>, <input-area>, <input-list>, <input-select>) are extracted
// BEFORE DOMPurify sanitization so they aren't stripped.

import DOMPurify from 'dompurify';

// ─── Chunk Types ────────────────────────────────────────────
export type HtmlChunk = { type: 'html'; content: string };
export type FieldChunk = { type: 'input-field'; id: string; placeholder?: string; label?: string };
export type AreaChunk = { type: 'input-area'; id: string; placeholder?: string; rows?: number; label?: string };
export type ListChunk = { type: 'input-list'; id: string; items: number; placeholder?: string; label?: string };
export type SelectChunk = {
  type: 'input-select';
  id: string;
  options: { value: string; label: string }[];
  label?: string;
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
// Suporta dois formatos:
//   A) Só labels:   "Ainda não enviei, Já enviei, Recebi as 3 respostas"
//   B) value:label: "verde: Convergência, amarelo: Gap, vermelho: Surpresa"
//
// Bug que esse parser cobre: JSONs antigos no formato B onde a label tem
// vírgula dentro (ex: "parcial: alguns batem, outros não"). Como o split é
// por vírgula, "outros não" virava uma opção lixo. Solução: detectar que
// "outros não" não tem prefixo "valor:" e fundir com a label da anterior.
const VALUE_LABEL_PATTERN = /^[\wáéíóúãõçÁÉÍÓÚÃÕÇ\s-]{1,20}:\s/;

function parseSelectOptions(optionsStr: string): { value: string; label: string }[] {
  const raw = optionsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
  const usesValueLabelFormat = raw.some(opt => VALUE_LABEL_PATTERN.test(opt));

  if (!usesValueLabelFormat) {
    return raw.map(opt => ({ value: opt, label: opt }));
  }

  const result: { value: string; label: string }[] = [];
  for (const opt of raw) {
    if (VALUE_LABEL_PATTERN.test(opt)) {
      const colonIdx = opt.indexOf(':');
      result.push({
        value: opt.slice(0, colonIdx).trim(),
        label: opt.slice(colonIdx + 1).trim(),
      });
    } else if (result.length > 0) {
      // Sem prefixo "valor:" → vírgula bagunçou o split; fundir com a anterior
      result[result.length - 1].label += ', ' + opt;
    } else {
      // Primeira opção sem prefixo mas modo value:label detectado em outras
      result.push({ value: opt, label: opt });
    }
  }
  return result;
}

// ─── Label-before-input matcher ─────────────────────────────
// Procura por <label for="ID">texto</label> opcionalmente envolto em <p> no
// final do HTML chunk imediatamente antes de um <input-X id="ID">. Quando
// casa, o renderer move o label pra dentro do componente do input (próximos
// um do outro, sem espaçamento grande do flow do prose).
const TRAILING_LABEL_REGEX = /(?:<p[^>]*>\s*)?<label\s+for="([^"]+)"\s*>([\s\S]*?)<\/label>(?:\s*<\/p>)?\s*$/i;

function extractTrailingLabel(html: string, expectedId: string): { cleanHtml: string; label?: string } {
  const match = html.match(TRAILING_LABEL_REGEX);
  if (!match || match.index === undefined || match[1] !== expectedId) {
    return { cleanHtml: html };
  }
  return {
    cleanHtml: html.slice(0, match.index).trim(),
    label: match[2].trim(),
  };
}

// ─── Main Parser ────────────────────────────────────────────
export function parseWorkbookHtml(html: string): WorkbookChunk[] {
  const chunks: WorkbookChunk[] = [];
  let lastIndex = 0;

  // Reset regex state
  TAG_REGEX.lastIndex = 0;

  let match;
  while ((match = TAG_REGEX.exec(html)) !== null) {
    const tagType = match[1].toLowerCase(); // field, area, list, select
    const attrs = parseAttributes(match[2]);
    const id = attrs.id || `${tagType}-${chunks.length}`;

    // Pega o HTML antes desse input. Se terminar com <label for="ID">, move o
    // label pra dentro do chunk do input pra ficar visualmente colado a ele.
    let absorbedLabel: string | undefined;
    if (match.index > lastIndex) {
      const rawHtml = html.slice(lastIndex, match.index).trim();
      if (rawHtml.length > 0) {
        const { cleanHtml, label } = extractTrailingLabel(rawHtml, id);
        absorbedLabel = label;
        if (cleanHtml.length > 0) {
          chunks.push({
            type: 'html',
            content: DOMPurify.sanitize(cleanHtml, SANITIZE_CONFIG),
          });
        }
      }
    }

    switch (tagType) {
      case 'field':
        chunks.push({
          type: 'input-field',
          id,
          placeholder: attrs.placeholder,
          label: absorbedLabel,
        });
        break;

      case 'area':
        chunks.push({
          type: 'input-area',
          id,
          placeholder: attrs.placeholder,
          rows: attrs.rows ? parseInt(attrs.rows, 10) : undefined,
          label: absorbedLabel,
        });
        break;

      case 'list':
        chunks.push({
          type: 'input-list',
          id,
          items: attrs.items ? parseInt(attrs.items, 10) : 3,
          placeholder: attrs.placeholder,
          label: absorbedLabel,
        });
        break;

      case 'select':
        chunks.push({
          type: 'input-select',
          id,
          options: attrs.options ? parseSelectOptions(attrs.options) : [],
          label: absorbedLabel,
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
