// src/lib/trilhas/queries.ts
//
// Helpers de query pra trilhas. Centraliza padrões repetidos que hoje vivem
// inline em várias páginas (master/trilhas, admin/trilhas, colaborador/trilhas,
// player/use-trail-player).
//
// Client SDK only — use `@/lib/firebase-admin` para queries server-side.

import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Trilha } from '@/types/trilhas';

// ──────────────────────────────────────────────────────────────────────────
// Normalização de títulos (match por nome em vez de id/code)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Normaliza um título de trilha pra comparação: lowercase, sem acentos,
 * espaços colapsados, trim. Suficiente pra tolerar variações de
 * capitalização/acento mas falha em tradução (PT vs EN — por enquanto a
 * Boldfy só opera em PT, então OK).
 *
 * Ex: "Discovery de Marca Pessoal" → "discovery de marca pessoal"
 *     "Promessa e Proposta de Valor" → "promessa e proposta de valor"
 */
export function normalizeTrailTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type TrailHit = {
  trailId: string;
  sessionId: string;
  trail: Trilha;
};

/**
 * Busca uma trilha global pelo título (match normalizado).
 *
 * Match-by-title é o caminho oficial para referenciar trilhas a partir de
 * outras telas (ex: import workbook pra Marca Pessoal). O campo `code`
 * foi descartado depois que a UI no Master não chegou a estabilizar; como
 * o universo de trilhas relevantes é pequeno e os títulos são estáveis em
 * PT-BR, match-by-title é suficiente e tem menos partes móveis.
 *
 * Se você renomear uma trilha referenciada, o match quebra — mantenha os
 * títulos congelados ou atualize as chamadas que dependem desse nome.
 *
 * Itera por todas as sessões globais e suas trilhas — custo O(N) Firestore
 * reads, mas N é pequeno (~5 sessões * ~5 trilhas).
 */
export async function getTrailByTitle(title: string): Promise<TrailHit | null> {
  const target = normalizeTrailTitle(title);
  if (!target) return null;

  const sessionsSnap = await getDocs(collection(db, 'globalSessions'));
  for (const sess of sessionsSnap.docs) {
    const trailsSnap = await getDocs(collection(db, 'globalSessions', sess.id, 'trails'));
    for (const t of trailsSnap.docs) {
      const data = t.data() as Partial<Trilha>;
      const candidate = data.titulo ? normalizeTrailTitle(data.titulo) : '';
      if (candidate === target) {
        return {
          trailId: t.id,
          sessionId: sess.id,
          trail: { id: t.id, ...(data as Omit<Trilha, 'id'>) },
        };
      }
    }
  }
  return null;
}

/**
 * Versão batch — recebe vários títulos e retorna um Map.
 * Usa o mesmo iterar-uma-vez pra economizar Firestore reads.
 */
export async function getTrailsByTitles(titles: string[]): Promise<Map<string, TrailHit>> {
  const targets = titles.map((t) => ({ raw: t, normalized: normalizeTrailTitle(t) }));
  const map = new Map<string, TrailHit>();

  const sessionsSnap = await getDocs(collection(db, 'globalSessions'));
  for (const sess of sessionsSnap.docs) {
    const trailsSnap = await getDocs(collection(db, 'globalSessions', sess.id, 'trails'));
    for (const t of trailsSnap.docs) {
      const data = t.data() as Partial<Trilha>;
      const candidate = data.titulo ? normalizeTrailTitle(data.titulo) : '';
      if (!candidate) continue;
      const hit = targets.find((tt) => tt.normalized === candidate);
      if (hit) {
        map.set(hit.raw, {
          trailId: t.id,
          sessionId: sess.id,
          trail: { id: t.id, ...(data as Omit<Trilha, 'id'>) },
        });
      }
    }
  }
  return map;
}

/**
 * Atalho pra montar URL do player de trilha a partir de um hit.
 * Hoje a URL é só `/colaborador/trilhas/[id]` sem deep-link a módulo.
 */
export function getTrailPlayerUrl(hit: TrailHit): string {
  return `/colaborador/trilhas/${hit.trailId}`;
}
