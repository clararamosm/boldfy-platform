// src/lib/billing/activity-log.ts
// Writer server-only para a Activity Log de empresa.
// Vive em `companies/{companyId}/activityLog/{entryId}` (subcolecao).
//
// Contrato critico: este modulo NUNCA propaga erro. Se a escrita falhar,
// loga no console e segue. O log e best-effort — nunca pode quebrar o flow
// principal (salvar billing, processar webhook, criar empresa).
//
// Idempotencia:
// - Sem `idempotencyKey`: doc-id auto, escrita simples.
// - Com `idempotencyKey`: doc-id deterministico `${kind}_${idempotencyKey}`,
//   escrita via transacao com `tx.get()` antes do `set` para evitar duplicata.
//
// Quem chama:
// - Server actions (saveMasterBilling, inviteAdminToCompany, etc.)
// - Webhook handler do Stripe (passa event.id como idempotencyKey)
// - Server-side internals (applyAdminFirstLogin)

import 'server-only';
import { FieldValue } from 'firebase-admin/firestore';
import { db as adminDb } from '@/lib/firebase-admin';
import type { ActivityLogKind, ActivityLogActorRole } from './activity-log-types';

export interface AppendActivityLogEntry {
  kind: ActivityLogKind;
  actorRole: ActivityLogActorRole;
  /** uid do master quando actorRole='master'. null para webhook/system/admin sem id conhecido. */
  actorUid?: string | null;
  /** Texto curto pt-BR, sem dados sensiveis (ver activity-log-types.ts). */
  summary: string;
}

export interface AppendActivityLogOptions {
  /** Quando presente, garante idempotencia. Doc id = `${kind}_${idempotencyKey}`. */
  idempotencyKey?: string;
}

/**
 * Adiciona uma entrada na activity log da empresa.
 * Nunca propaga erro — falhas viram console.error e retornam silencio.
 *
 * @returns Promise<void>. Caller pode dar await para ordering, mas nao precisa try/catch.
 */
export async function appendActivityLog(
  companyId: string,
  entry: AppendActivityLogEntry,
  opts?: AppendActivityLogOptions,
): Promise<void> {
  if (!companyId || typeof companyId !== 'string') {
    console.error('[appendActivityLog] companyId invalido, skip:', companyId);
    return;
  }
  if (!entry?.kind || !entry?.summary) {
    console.error('[appendActivityLog] entry mal-formado, skip:', entry?.kind);
    return;
  }

  try {
    const collectionRef = adminDb
      .collection('companies')
      .doc(companyId)
      .collection('activityLog');

    const payload = {
      ts: FieldValue.serverTimestamp(),
      kind: entry.kind,
      actorRole: entry.actorRole,
      actorUid: entry.actorUid ?? null,
      summary: entry.summary,
    };

    if (opts?.idempotencyKey) {
      // Doc id deterministico — evita duplicata em retries de webhook.
      const docId = `${entry.kind}_${opts.idempotencyKey}`;
      const docRef = collectionRef.doc(docId);

      await adminDb.runTransaction(async (tx) => {
        const existing = await tx.get(docRef);
        if (existing.exists) {
          // Ja escrevemos este evento. No-op silencioso.
          return;
        }
        tx.set(docRef, payload);
      });
    } else {
      await collectionRef.add(payload);
    }
  } catch (err) {
    // Nunca propaga. Log e segue.
    console.error('[appendActivityLog] falhou (kind=%s):', entry.kind, err);
  }
}
