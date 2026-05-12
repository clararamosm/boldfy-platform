// src/lib/ai-prompt/sanitize-output.ts
//
// Sanitização do output da IA antes de devolver pro front. Mesmo com
// regras explícitas no system prompt, LLMs ocasionalmente escorregam e
// usam markdown que LinkedIn renderiza literal (asteriscos viram texto).
// Esta camada é o segundo cinto de segurança — qualquer regra do prompt
// que importa muito deveria ter sanitização correspondente aqui.

/**
 * Tira asteriscos em volta de palavras/frases (markdown italic/bold).
 *
 * Pega `**texto**`, `*texto*`, até `***texto***`. Não toca em asteriscos
 * isolados que não cercam texto (ex: "2 * 2 = 4" não é alterado porque
 * o regex exige conteúdo não-asterisco entre os marcadores).
 *
 * Aplicado tanto em captions completas quanto em hooks gerados.
 */
export function stripBoldItalicMarkdown(text: string): string {
  // Múltiplas passadas pra cobrir aninhamento (raro): primeiro **...**,
  // depois *...*. O regex captura o conteúdo entre os asteriscos sem incluir
  // outros asteriscos no meio, evitando consumir texto demais.
  return text
    // **bold** ou ***bold-italic***
    .replace(/\*{2,3}([^*\n]+?)\*{2,3}/g, '$1')
    // *italic*
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1$2');
}

/**
 * Tira `#` que aparece como markdown heading no começo de linha
 * (LinkedIn renderiza literal — vira "#" visível). Não toca em
 * hashtags inline (ex: "#fintech" no meio de uma frase fica como está
 * porque o prompt já proíbe hashtags — se passar mesmo assim, vira
 * problema do usuário; sanitizar aqui poderia comer texto válido).
 */
export function stripLeadingHeadings(text: string): string {
  return text.replace(/^#{1,6}\s+/gm, '');
}

/**
 * Tira marcadores de lista markdown (`- ` ou `* ` no começo de linha)
 * que LinkedIn não renderiza. Mantém a linha — só remove o prefixo.
 * O prompt sugere usar `→` quando precisa de lista; se a IA insistir
 * em `- ` ou `* `, transformamos pra texto puro ou pra `→`.
 *
 * Convenção: transformamos pra `→ ` pra preservar a estrutura visual.
 */
export function normalizeBulletMarkers(text: string): string {
  // ^[\s]* permite indentação; (-|\*) é o marcador; \s+ exige espaço
  return text.replace(/^([ \t]*)[-*]\s+/gm, '$1→ ');
}

/**
 * Pipeline completo: aplica todas as sanitizações em ordem.
 * Use este na saída da IA antes de salvar ou retornar pro front.
 */
export function sanitizeAiCaption(text: string): string {
  let out = text;
  out = stripBoldItalicMarkdown(out);
  out = stripLeadingHeadings(out);
  out = normalizeBulletMarkers(out);
  return out;
}

/**
 * Sanitização específica pra hooks (mais leve — hook é 1-3 linhas).
 * Não converte marcadores de lista (improvável em hook) mas ainda
 * tira asteriscos e headings.
 */
export function sanitizeAiHook(text: string): string {
  return stripLeadingHeadings(stripBoldItalicMarkdown(text));
}
