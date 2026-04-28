// src/lib/billing/cron-jobs.ts
// Regras de negocio dos crons de billing.
// server-only: NUNCA importe no cliente.
//
// Funcoes puras-ish (usam Firestore Admin mas nao acessam request/response).
// Os endpoints HTTP (Route Handlers) apenas validam o Bearer token e chamam
// estas funcoes. Toda logica fica aqui, isolada e testavel.
//
// Tres jobs principais (todos idempotentes):
// 1. runCheckTrialToPending: promove Platform 'free' -> 'pending' quando
//    trialEndsAt venceu, garantindo cardDeadlineEndsAt + firstPaymentDeadline.
// 2. runCheckModuleDeadlines: promove modulos pending -> blocked quando
//    firstPaymentDeadline (ou cardDeadlineEndsAt no Platform) venceu.
// 3. runCheckBetaExpiration: desliga flag isBetaTester quando betaEndsAt
//    venceu.
//
// Ordem ideal de execucao (Cloud Scheduler):
//   check-trials (00:00) -> module-deadlines (00:15) -> beta-expiration (00:30)
// Mas sao independentes; ordem nao quebra correctness, apenas atrasa
// transicoes em 1 dia caso rodem fora de ordem.

import 'server-only';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { BillingModule } from './stripe-modules';
import type { CompanyBillingBlock, MaybeTimestamp } from './types';
import {
  CARD_DEADLINE_WINDOW_DAYS,
  computeCardDeadlineFromTrialEnd,
} from './master-rules';

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
  // Filtramos por billing.platform.status existir (qualquer valor) — funciona
  // como proxy para 'tem bloco billing inicializado'. O loop interno descarta
  // docs sem billing pra robustez.
  const snapshot = await adminDb
    .collection('companies')
    .where('billing.platform.status', 'in', ['disabled', 'free', 'pending', 'active', 'blocked'])
    .get();

  for (const doc of snapshot.docs) {
    scanned += 1;
    const companyId = doc.id;
    const data = doc.data();
    const billing = data.billing as CompanyBillingBlock | undefined;

    if (!billing) continue;

    // Beta tester com tempo restante nao tem modulos bloqueados por deadline.
    // Le betaEndsAt (campo novo) com fallback para betaExpiresAt (deprecated).
    // (data ausente = beta permanente OU ainda nao iniciado — em ambos casos protegemos)
    if (billing.isBetaTester === true) {
      const betaEnd = toDate(billing.betaEndsAt) ?? toDate(billing.betaExpiresAt);
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

    // Le campo novo (betaEndsAt) com fallback para legado (betaExpiresAt).
    const betaEnd = toDate(billing.betaEndsAt) ?? toDate(billing.betaExpiresAt);
    if (!betaEnd) continue; // beta permanente OU ainda nao iniciado (aguardando 1a fatura), ignorar
    if (betaEnd.getTime() > now.getTime()) continue; // ainda no prazo

    try {
      await doc.ref.update({
        'billing.isBetaTester': false,
        // Limpa todos os campos do beta (novo + legado) para nao deixar lixo.
        'billing.betaStartsAt': FieldValue.delete(),
        'billing.betaEndsAt': FieldValue.delete(),
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

// ────────────────────────────────────────────────────────────
// JOB 3: TRIAL TO PENDING (Platform)
// ────────────────────────────────────────────────────────────

export interface TrialToPendingRecord {
  companyId: string;
  trialEndedAtISO: string;
  cardDeadlineEndsAtISO: string;
}

export interface RunCheckTrialToPendingResult {
  scanned: number;
  promoted: TrialToPendingRecord[];
  errors: Array<{ companyId: string; message: string }>;
  ranAtISO: string;
}

/**
 * Varre empresas com platform.status='free' e promove para 'pending'
 * quando trialEndsAt venceu. Garante cardDeadlineEndsAt = trialEndsAt + 7d
 * (recalcula se ausente — protecao contra empresas migradas/legadas).
 *
 * Pula:
 * - freeTrialUnlimited=true (parceiros Boldfy nao expiram)
 * - trialEndsAt ausente (free sem prazo definido — provavel parceiro)
 * - trialEndsAt ainda no futuro
 *
 * Idempotente. NAO bloqueia ninguem — apenas inicia janela de 7 dias
 * para cadastro de cartao. O bloqueio em si fica com runCheckModuleDeadlines
 * (que ja monitora cardDeadlineEndsAt via firstPaymentDeadline pos-migracao).
 *
 * @param now data de referencia (default: Date.now()). Injetavel para testes.
 */
export async function runCheckTrialToPending(
  now: Date = new Date(),
): Promise<RunCheckTrialToPendingResult> {
  const ranAt = now;
  const promoted: TrialToPendingRecord[] = [];
  const errors: Array<{ companyId: string; message: string }> = [];
  let scanned = 0;

  const snapshot = await adminDb
    .collection('companies')
    .where('billing.platform.status', '==', 'free')
    .get();

  for (const doc of snapshot.docs) {
    scanned += 1;
    const companyId = doc.id;
    const data = doc.data();
    const billing = data.billing as CompanyBillingBlock | undefined;

    if (!billing || !billing.platform) continue;
    if (billing.platform.status !== 'free') continue; // paranoia pos-filtro

    // Free permanente (parceiro): nunca expira.
    if (billing.platform.freeTrialUnlimited === true) continue;

    const trialEndsAt = toDate(billing.platform.trialEndsAt);
    if (!trialEndsAt) continue; // sem prazo: deixa para o master configurar
    if (trialEndsAt.getTime() > now.getTime()) continue; // ainda no prazo

    // Garante cardDeadlineEndsAt: respeita o existente; recalcula se ausente.
    let cardDeadline = toDate(billing.platform.cardDeadlineEndsAt);
    if (!cardDeadline) {
      cardDeadline = computeCardDeadlineFromTrialEnd(trialEndsAt);
    }

    const updates: Record<string, unknown> = {
      'billing.platform.status': 'pending',
      'billing.platform.cardDeadlineEndsAt': Timestamp.fromDate(cardDeadline),
      // Espelho legado: gates antigos consultam firstPaymentDeadline.
      'billing.platform.firstPaymentDeadline': Timestamp.fromDate(cardDeadline),
      'billing.updatedAt': FieldValue.serverTimestamp(),
    };

    try {
      await doc.ref.update(updates);
      promoted.push({
        companyId,
        trialEndedAtISO: trialEndsAt.toISOString(),
        cardDeadlineEndsAtISO: cardDeadline.toISOString(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ companyId, message });
    }
  }

  return {
    scanned,
    promoted,
    errors,
    ranAtISO: ranAt.toISOString(),
  };
}

// Manter referencia explicita para evitar tree-shake do constante.
void CARD_DEADLINE_WINDOW_DAYS;
