// src/lib/trilhas/queries.ts
//
// Helpers de query pra trilhas. Centraliza padrões repetidos que hoje vivem
// inline em várias páginas (master/trilhas, admin/trilhas, colaborador/trilhas,
// player/use-trail-player).
//
// Client SDK only — use `@/lib/firebase-admin` para queries server-side.

import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TRAIL_CODE_REGEX, type Trilha } from '@/types/trilhas';

export type TrailByCodeHit = {
  trailId: string;
  sessionId: string;
  trail: Trilha;
};

/**
 * Busca uma trilha global pelo seu `code` (ex: 'MP01', 'EC02').
 *
 * Faz `collectionGroup('trails').where('code', '==', code)` no Firestore.
 * Como `collectionGroup` retorna trilhas globais E customizadas de empresa,
 * filtramos pelo path do parent — só trilhas globais (`globalSessions/{sid}/trails/{tid}`)
 * podem ser referenciadas por código (essa é a regra de unicidade do PR 1.5).
 *
 * Retorna `null` quando:
 * - o código não bate o formato esperado
 * - nenhuma trilha global tem esse código (gracefully degrades — chamador
 *   esconde o link/feature)
 *
 * Precisa do índice `trails (code ASC)` em collectionGroup — Firestore
 * cria automaticamente na primeira chamada (vai aparecer o link de criar
 * índice no console se faltar).
 */
export async function getTrailByCode(code: string): Promise<TrailByCodeHit | null> {
  const normalized = code.trim().toUpperCase();
  if (!TRAIL_CODE_REGEX.test(normalized)) return null;

  const q = query(
    collectionGroup(db, 'trails'),
    where('code', '==', normalized),
    limit(5), // collectionGroup pode retornar customizadas duplicadas; pegamos a primeira global
  );

  const snap = await getDocs(q);
  for (const docSnap of snap.docs) {
    // docSnap.ref.path === `globalSessions/{sessionId}/trails/{trailId}` quando global
    const parentPath = docSnap.ref.parent.parent?.path ?? '';
    if (!parentPath.startsWith('globalSessions/')) continue;

    const sessionId = parentPath.replace(/^globalSessions\//, '');
    return {
      trailId: docSnap.id,
      sessionId,
      trail: { id: docSnap.id, ...(docSnap.data() as Omit<Trilha, 'id'>) },
    };
  }

  return null;
}

/**
 * Versão batch — recebe múltiplos códigos e retorna um Map.
 * Útil pra telas que precisam linkar 4-5 trilhas de uma vez (ex: Setup de
 * Marca Pessoal precisa de MP01, MP03, MP07, EC01, EC02).
 *
 * Faz uma query por código (Firestore não tem `where IN` com `collectionGroup`
 * confiável + filtro por path). Chamadas paralelas via Promise.all.
 */
export async function getTrailsByCodes(codes: string[]): Promise<Map<string, TrailByCodeHit>> {
  const uniqueCodes = Array.from(new Set(codes.map((c) => c.trim().toUpperCase())));
  const results = await Promise.all(uniqueCodes.map((c) => getTrailByCode(c)));

  const map = new Map<string, TrailByCodeHit>();
  uniqueCodes.forEach((code, i) => {
    const hit = results[i];
    if (hit) map.set(code, hit);
  });
  return map;
}

/**
 * Atalho pra montar URL do player de trilha a partir de um hit.
 * Hoje a URL é só `/colaborador/trilhas/[id]` sem deep-link a módulo.
 */
export function getTrailPlayerUrl(hit: TrailByCodeHit): string {
  return `/colaborador/trilhas/${hit.trailId}`;
}

/**
 * Versão que aceita `null` (saída padrão de `getTrailByCode`) e retorna
 * fallback pra `/colaborador/trilhas` quando a trilha não está cadastrada.
 * Use isso na UI pra degradar graciosamente.
 */
export function getTrailPlayerUrlOrFallback(hit: TrailByCodeHit | null): string {
  return hit ? getTrailPlayerUrl(hit) : '/colaborador/trilhas';
}

// Re-export pra facilitar import (`import { getTrailByCode, listGlobalTrailCodes }`).
export async function listGlobalTrailCodes(): Promise<string[]> {
  // Busca os códigos existentes — usado pelo TrailBuilder pra avisar
  // sobre conflito antes do save (UX), embora o save em si confie no
  // server action `setGlobalTrailCode` pra validação autoritativa.
  const sessionsSnap = await getDocs(collection(db, 'globalSessions'));
  const codes: string[] = [];
  for (const sess of sessionsSnap.docs) {
    const trailsSnap = await getDocs(collection(db, 'globalSessions', sess.id, 'trails'));
    for (const t of trailsSnap.docs) {
      const c = (t.data() as Partial<Trilha>).code;
      if (c) codes.push(c);
    }
  }
  return codes;
}
