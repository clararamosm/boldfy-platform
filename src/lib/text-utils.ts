// src/lib/text-utils.ts
// Utilidades de manipulacao de texto compartilhadas pelo app.

/**
 * Remove tags HTML de uma string, retornando apenas o texto plano.
 * Decoda entidades HTML basicas (&amp;, &lt;, &gt;, &quot;, &nbsp;).
 *
 * Use pra previews truncados (line-clamp) onde HTML formatado bagunca a UI
 * — descricao curta de cards, snippets em listas, etc.
 *
 * Pra renderizar HTML formatado, use o componente <RichText /> em
 * src/components/ui/rich-text.tsx (encapsula DOMPurify).
 */
export function stripHtml(input: string | null | undefined): string {
  if (!input) return '';
  return String(input)
    .replace(/<\/?[^>]+(>|$)/g, ' ')   // remove tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')               // colapsa whitespace
    .trim();
}
