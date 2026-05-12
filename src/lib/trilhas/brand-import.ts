// src/lib/trilhas/brand-import.ts
//
// Fonte unica de verdade pra "quais workbooks de trilha alimentam a
// Marca Pessoal". Importado por:
//
//  - src/app/actions/personal-brand.ts (server, le respostas)
//  - src/components/trilhas/player/workbook-renderer.tsx (CTA inline)
//  - src/components/trilhas/meus-workbooks-dialog.tsx (CTA no dialog)
//
// Se voce renomear uma trilha cadastrada no Master, atualize aqui.

import { normalizeTrailTitle } from './queries';

/**
 * Titulos das trilhas (no nome cadastrado pelo Master) cujo workbook
 * alimenta a Marca Pessoal. Match e feito por `normalizeTrailTitle`
 * (case/accent-insensitive) — entao "discovery de marca pessoal" e
 * "Discovery de Marca Pessoal" sao equivalentes.
 */
export const BRAND_IMPORT_TRAIL_TITLES = [
  'Discovery de Marca Pessoal',
  'Promessa e Proposta de Valor',
] as const;

const NORMALIZED_BRAND_TITLES = new Set(
  BRAND_IMPORT_TRAIL_TITLES.map((t) => normalizeTrailTitle(t)),
);

/**
 * Retorna `true` se um titulo de trilha corresponde a um workbook que
 * pode ser importado pra Marca Pessoal.
 *
 * Usado pra decidir se o CTA "Aplicar a Marca Pessoal" aparece no
 * player de trilha ou no dialog "Meus Workbooks".
 */
export function isBrandImportTrail(trailTitle: string | undefined | null): boolean {
  if (!trailTitle) return false;
  return NORMALIZED_BRAND_TITLES.has(normalizeTrailTitle(trailTitle));
}

/**
 * URL pra abrir a tela de Marca Pessoal em modo "vim do workbook" —
 * aciona o useEffect que dispara o preview e abre o dialog.
 */
export const BRAND_IMPORT_URL = '/colaborador/marca-pessoal?fromWorkbook=1' as const;
