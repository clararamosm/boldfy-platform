// src/components/ui/rich-text.tsx
// Componente compartilhado pra renderizar conteudo HTML rich-text de forma
// segura. Encapsula DOMPurify (sanitizacao XSS) + classes de prose pro
// styling consistente.
//
// Use sempre que conteudo HTML armazenado em Firestore (descricao de
// missoes, modulos de trilha, etc.) precisar ser renderizado na UI.
//
// Pra previews truncados (line-clamp), use `stripHtml()` em vez deste
// componente — tags de bloco como <p>/<h2> nao se comportam bem com
// line-clamp + ellipsis.

'use client';

import DOMPurify from 'dompurify';

const DEFAULT_PROSE = 'prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-2 prose-h1:text-lg prose-h1:font-bold prose-h1:mt-4 prose-h1:mb-2 prose-h2:text-base prose-h2:font-bold prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-3 prose-h3:mb-1.5 prose-h4:text-xs prose-h4:font-medium prose-h4:mt-2 prose-h4:mb-1 prose-li:my-1 prose-ul:my-2 prose-ol:my-2 prose-hr:my-3 prose-hr:border-border prose-blockquote:border-l-purple-400 prose-blockquote:bg-purple-50 prose-blockquote:py-2 prose-blockquote:px-3 prose-blockquote:rounded-r prose-blockquote:not-italic prose-a:text-purple-600 prose-a:underline [&_strong]:text-foreground [&_u]:underline';

const SANITIZE_CONFIG = {
  ADD_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'p', 'br', 'hr',
    'strong', 'em', 's', 'u', 'mark',
    'a', 'ul', 'ol', 'li', 'blockquote',
  ],
  ADD_ATTR: ['class', 'href', 'target', 'rel'],
};

type RichTextProps = {
  html: string;
  className?: string;
};

/**
 * Renderiza HTML rich-text de forma segura, com prose styling.
 * Use pra conteudo expandido — descricao completa de missao, modulo,
 * caption, etc.
 */
export function RichText({ html, className }: RichTextProps) {
  const sanitized = DOMPurify.sanitize(html || '', SANITIZE_CONFIG);
  return (
    <div
      className={`${DEFAULT_PROSE} ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
