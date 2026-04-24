// src/lib/billing/cron-jobs.ts
// Regras de negocio dos crons de billing.
// server-only: NUNCA importe no cliente.
//
// Funcoes puras-ish (usam Firestore Admin mas nao acessam request/response).
// Os endpoints HTTP (Route Handlers) apenas validam o Bearer token e chamam
// estas funcoes. Toda logica fica aqui, isolada e testavel.
//
// Dois jobs principais:
// 1. runCheckModuleDeadlines: promove modulos pending -> blocked quando
//    firstPaymentDeadline venceu.
// 2. runCheckBetaExpiration: desliga flag isBetaTester quando betaExpiresAt
//    venceu.
//
// Ambos sao idempotentes: rodar 2x no mesmo dia nao quebra nada.

import 'server-only';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { BillingModule } from './stripe-modules';
import type { CompanyBillingBlock, MaybeTimestamp } from './types';

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

/** Normaliza MaybeTimestamp para Date | null. */
function toDate(v: MaybeTimestamp): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === 'string') {
    const parsed = new Date(v);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof v === 'object') {
    const obj = v as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof obj.toDate === 'function') {
      try {
        return obj.toDate();
      } catch {
        return null;
      }
    }
    const s = obj.seconds ?? obj._seconds;
    if (typeof s === 'number') return new Date(s * 1000);
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// JOB 1: CHECK MODULE DEADLINES
// ────────────────────────────────────────────────────────────

export interface ModuleDeadlineBlockRecord {
  companyId: string;
  module: BillingModule;
  deadlineISO: string | null;
}

export interface RunCheckModuleDeadlinesResult {
  scanned: number;
  blocked: ModuleDeadlineBlockRecord[];
  blockedByModule: Record<BillingModule, number>;
  errors: Array<{ companyId: string; message: string }>;
  ranAtISO: string;
}

/**
 * Varre todas as empresas com billing configurado e promove modulos
 * pending -> blocked quando o prazo de primeiro pagamento venceu.
 *
 * Idempotente: modulos ja blocked nao sao tocados.
 * Nao cancela subscriptions no Stripe — apenas flipa status no Firestore.
 * O bloqueio de acesso e feito pelo module-gate em tempo de request.
 *
 * @param now data de referencia (default: Date.now()). Injetavel para testes.
 */
export async function runCheckModuleDeadlines(
  now: Date = new Date(),
): Promise<RunCheckModuleDeadlinesResult> {
  const ranAt = now;
  const blocked: ModuleDeadlineBlockRecord[] = [];
  const blockedByModule: Record<BillingModule, number> = {
    platform: 0,
    tl: 0,
    design: 0,
  };
  const errors: Array<{ companyId: string; message: string }> = [];
  let scanned = 0;

  // Varre apenas empresas com billing existente. Sem billing, nada pra checar.
  // Nota: nao filtramos por billing.enabled aqui porque mesmo em enabled=false
  // o status 'pending' de um modulo pode ter vencido — o gate ja bloqueia,
  // mas marcar blocked mantem o estado coerente pra reports do master.
  const snapshot = await adminDb
    .collection('companies')
    .where('billing.enabled', '==', true)
    .get();

  for (const doc of snapshot.docs) {
    scanned += 1;
    const companyId = doc.id;
    const data = doc.data();
    const billing = data.billing as CompanyBillingBlock | undefined;

    if (!billing) continue;

    // Beta tester com tempo restante nao tem modulos bloqueados por deadline.
    // (betaExpiresAt ausente = beta permanente)
    if (billing.isBetaTester === true) {
      const betaEnd = toDate(billing.betaExpiresAt);
      if (!betaEnd || betaEnd.getTime() > now.getTime()) {
        continue;
      }
      // beta expirado: segue regras normais abaixo.
    }

    const updates: Record<string, unknown> = {};
    const thisCompanyBlocks: ModuleDeadlineBlockRecord[] = [];

    const modules: BillingModule[] = ['platform', 'tl', 'design'];
    for (const mod of modules) {
      const state = billing[mod];
      if (!state) continue;

      // Caso especial: TL billedOutsidePlatform nunca bloqueia por deadline.
      if (mod === 'tl' && billing.tl.billedOutsidePlatform === true) continue;

      if (state.status !== 'pending') continue;

      const deadline = toDate(state.firstPaymentDeadline);
      if (!deadline) continue; // sem deadline definido, nao bloqueia
      if (deadline.getTime() >= now.getTime()) continue; // ainda no prazo

      updates[`billing.${mod}.status`] = 'blocked';
      thisCompanyBlocks.push({
        companyId,
        module: mod,
        deadlineISO: deadline.toISOString(),
      });
    }

    if (Object.keys(updates).length === 0) continue;

    updates['billing.updatedAt'] = FieldValue.serverTimestamp();

    try {
      await doc.ref.update(updates);
      for (const record of thisCompanyBlocks) {
        blocked.push(record);
        blockedByModule[record.module] += 1;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ companyId, message });
    }
  }

  return {
    scanned,
    blocked,
    blockedByModule,
    errors,
    ranAtISO: ranAt.toISOString(),
  };
}

// ────────────────────────────────────────────────────────────
// JOB 2: CHECK BETA EXPIRATION
// ────────────────────────────────────────────────────────────

export interface BetaExpirationRecord {
  companyId: string;
  expiredAtISO: string;
}

export interface RunCheckBetaExpirationResult {
  scanned: number;
  expired: BetaExpirationRecord[];
  errors: Array<{ companyId: string; message: string }>;
  ranAtISO: string;
}

/**
 * Varre empresas com isBetaTester=true e betaExpiresAt vencido.
 * Desliga a flag e remove betaExpiresAt.
 *
 * Importante: NAO reseta status de modulos. Se uma empresa estava em beta
 * e o modulo estava pending, o deadline do modulo vai reger a transicao
 * (runCheckModuleDeadlines cuida disso na proxima rodada).
 *
 * Beta permanente (sem betaExpiresAt) nunca expira — ignorado pelo filtro.
 *
 * Idempotente: empresas ja fora do beta nao sao tocadas.
 */
export async function runCheckBetaExpiration(
  now: Date = new Date(),
): Promise<RunCheckBetaExpirationResult> {
  const ranAt = now;
  const expired: BetaExpirationRecord[] = [];
  const errors: Array<{ companyId: string; message: string }> = [];
  let scanned = 0;

  // Busca apenas beta testers. betaExpiresAt pode estar ausente (permanente)
  // ou ser um Timestamp — filtramos em memoria pra cobrir ambos casos sem
  // dois queries.
  const snapshot = await adminDb
    .collection('companies')
    .where('billing.isBetaTester', '==', true)
    .get();

  for (const doc of snapshot.docs) {
    scanned += 1;
    const companyId = doc.id;
    const data = doc.data();
    const billing = data.billing as CompanyBillingBlock | undefined;

    if (!billing) continue;
    if (billing.isBetaTester !== true) continue; // paranoia pos-filtro

    const betaEnd = toDate(billing.betaExpiresAt);
    if (!betaEnd) continue; // beta permanente, ignorar
    if (betaEnd.getTime() > now.getTime()) continue; // ainda no prazo

    try {
      await doc.ref.update({
        'billing.isBetaTester': false,
        'billing.betaExpiresAt': FieldValue.delete(),
        'billing.updatedAt': FieldValue.serverTimestamp(),
      });
      expired.push({
        companyId,
        expiredAtISO: betaEnd.toISOString(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ companyId, message });
    }
  }

  return {
    scanned,
    expired,
    errors,
    ranAtISO: ranAt.toISOString(),
  };
}
