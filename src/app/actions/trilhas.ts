// src/app/actions/trilhas.ts
'use server';

/**
 * Server actions relacionadas ao schema de trilhas.
 *
 * Hoje a maior parte do CRUD de trilhas é client-side (ver
 * src/app/master/trilhas/page.tsx). Estas server actions cobrem operações
 * que exigem validação cross-doc (ex: unicidade de `code` entre trilhas
 * globais) ou regras de negócio que não cabem em Firestore rules.
 */

import { z } from 'zod';
import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireMaster } from '@/lib/auth-guard';
import { TRAIL_CODE_REGEX } from '@/types/trilhas';

// ──────────────────────────────────────────────────────────────────────────
// setGlobalTrailCode
// ──────────────────────────────────────────────────────────────────────────

const SetGlobalTrailCodeSchema = z.object({
  sessionId: z.string().min(1),
  trailId: z.string().min(1),
  // `code` pode vir vazio pra "remover" o código da trilha.
  code: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || TRAIL_CODE_REGEX.test(v), {
      message: 'Código inválido. Use 2 letras maiúsculas + 2 dígitos (ex: MP01).',
    }),
});

export type SetGlobalTrailCodeResult =
  | { ok: true; code: string | null }
  | { ok: false; error: string };

/**
 * Define (ou remove) o `code` de uma trilha global, validando unicidade.
 * Apenas Master pode chamar. Usado pelo `/master/trilhas` ao salvar uma
 * trilha cujo campo "Código" mudou.
 *
 * Se `code` for string vazia, o campo é apagado do doc (FieldValue.delete()).
 */
export async function setGlobalTrailCode(
  idToken: string,
  input: { sessionId: string; trailId: string; code: string },
): Promise<SetGlobalTrailCodeResult> {
  try {
    await requireMaster(idToken);

    const parsed = SetGlobalTrailCodeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos.' };
    }
    const { sessionId, trailId, code } = parsed.data;

    const trailRef = adminDb
      .collection('globalSessions')
      .doc(sessionId)
      .collection('trails')
      .doc(trailId);

    // Verifica que a trilha existe
    const trailSnap = await trailRef.get();
    if (!trailSnap.exists) {
      return { ok: false, error: 'Trilha não encontrada.' };
    }

    // ── Remoção do código (campo vazio) ──
    if (code === '') {
      await trailRef.update({
        code: FieldValue.delete(),
        atualizadaEm: FieldValue.serverTimestamp(),
      });
      return { ok: true, code: null };
    }

    // ── Validação de unicidade entre trilhas globais ──
    // collectionGroup busca em todas as subcoleções `trails` do projeto.
    // Inclui trilhas customizadas de empresas (companies/.../trails) — por
    // isso filtramos depois pelo path do parent pra considerar só globais.
    const conflicts = await adminDb
      .collectionGroup('trails')
      .where('code', '==', code)
      .get();

    for (const docSnap of conflicts.docs) {
      const parentPath = docSnap.ref.parent.parent?.path ?? '';
      const isGlobal = parentPath.startsWith('globalSessions/');
      const isThisTrail = docSnap.ref.path === trailRef.path;
      if (isGlobal && !isThisTrail) {
        return {
          ok: false,
          error: `Código "${code}" já está em uso por outra trilha global.`,
        };
      }
    }

    await trailRef.update({
      code,
      atualizadaEm: FieldValue.serverTimestamp(),
    });

    return { ok: true, code };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Erro desconhecido ao salvar código.';
    return { ok: false, error: errorMessage };
  }
}
