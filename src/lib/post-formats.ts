// src/lib/post-formats.ts
//
// Tipos de midia / formato do post (campo `formato` em ScheduledPost).
//
// 5 defaults vivem aqui no codigo — visiveis pra todos os usuarios. Cada
// colaborador pode adicionar formatos customizados em
// `users/{uid}.customPostFormats: string[]` via a UI de "Gerenciar formatos"
// no editor de post.
//
// Defaults NAO sao removiveis no UI (pra evitar quebrar UX). Customs sao.

export const DEFAULT_POST_FORMATS: readonly string[] = [
  'Só texto',
  'Foto',
  'Infográfico',
  'Carrossel',
  'Meme',
] as const;

/**
 * Mescla defaults + custom formats do user. Ordem: defaults primeiro, customs
 * depois. Customs duplicados (igual a um default) sao filtrados.
 */
export function mergePostFormats(customFormats: string[] | undefined): string[] {
  const customs = (customFormats ?? []).map((s) => s.trim()).filter(Boolean);
  const defaultsLower = new Set(DEFAULT_POST_FORMATS.map((d) => d.toLowerCase()));
  const dedupedCustoms = customs.filter((c) => !defaultsLower.has(c.toLowerCase()));
  return [...DEFAULT_POST_FORMATS, ...dedupedCustoms];
}

/**
 * Verifica se um formato eh default (nao removivel pelo user).
 */
export function isDefaultFormat(formato: string): boolean {
  const f = formato.trim().toLowerCase();
  return DEFAULT_POST_FORMATS.some((d) => d.toLowerCase() === f);
}
