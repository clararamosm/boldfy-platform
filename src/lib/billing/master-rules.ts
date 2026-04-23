// src/lib/billing/master-rules.ts
// Regras de negocio para operacoes de billing executadas pelo Master.
// server-only: NUNCA importe no cliente.
//
// Principio: qualquer decisao sobre habilitar/desabilitar cobranca,
// status de modulo, prazos e descontos vive aqui, NUNCA no front.

import 'server-only';

import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  type CompanyBillingBlock,
  type BillingModuleStatus,
  getDefaultBillingBlock,
} from './types';
import { FIRST_PAYMENT_DEADLINE_MS } from './pricing';

// ────────────────────────────────────────────────────────────
// INPUT VALIDATION
// ────────────────────────────────────────────────────────────

export interface MasterToggleBillingInput {
  companyId: string;
  enabled: boolean;
  isBetaTester: boolean;
  betaExpiresAt?: Date | null;
  notes?: string;
}

/** Valida entrada do master. Lanca erros legiveis. */
export function validateMasterToggleInput(input: unknown): MasterToggleBillingInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Payload invalido.');
  }
  const raw = input as Record<string, unknown>;

  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : '';
  if (!companyId) {
    throw new Error('companyId obrigatorio.');
  }

  const enabled = raw.enabled === true;
  const isBetaTester = raw.isBetaTester === true;

  let betaExpiresAt: Date | null | undefined;
  if (raw.betaExpiresAt === null || raw.betaExpiresAt === undefined || raw.betaExpiresAt === '') {
    betaExpiresAt = null;
  } else if (raw.betaExpiresAt instanceof Date) {
    betaExpiresAt = raw.betaExpiresAt;
  } else if (typeof raw.betaExpiresAt === 'string') {
    const parsed = new Date(raw.betaExpiresAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Data de expiracao beta invalida.');
    }
    betaExpiresAt = parsed;
  } else {
    throw new Error('betaExpiresAt deve ser data ISO ou null.');
  }

  // Regra: se nao e beta tester, nao pode ter data de expiracao.
  if (!isBetaTester && betaExpiresAt) {
    throw new Error('Empresa nao-beta nao pode ter data de expiracao beta.');
  }

  // Regra: expiracao beta deve ser no futuro.
  if (betaExpiresAt && betaExpiresAt.getTime() <= Date.now()) {
    throw new Error('Data de expiracao beta deve ser no futuro.');
  }

  let notes: string | undefined;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      throw new Error('notes deve ser string.');
    }
    notes = raw.notes.slice(0, 1000); // hard cap anti-spam
  }

  return { companyId, enabled, isBetaTester, betaExpiresAt, notes };
}

// ────────────────────────────────────────────────────────────
// OPERACOES
// ────────────────────────────────────────────────────────────

/**
 * Le o bloco billing de uma empresa. Se nao existe, inicializa com defaults.
 * Retorna copia imutavel — nao modifique diretamente.
 */
export async function getCompanyBillingBlock(companyId: string): Promise<CompanyBillingBlock> {
  const snap = await adminDb.collection('companies').doc(companyId).get();
  if (!snap.exists) {
    throw new Error(`Empresa ${companyId} nao encontrada.`);
  }
  const data = snap.data() ?? {};
  const billing = data.billing as CompanyBillingBlock | undefined;
  if (!billing) {
    return getDefaultBillingBlock();
  }
  return billing;
}

/**
 * Aplica os toggles do master em uma empresa.
 *
 * Regras:
 * - Se passar de enabled=false para enabled=true e existem modulos ja 'active',
 *   mantem os ativos (nao reseta status).
 * - Se passar de enabled=true para enabled=false, NAO cancela subscriptions
 *   (isso e feito em action separada, com confirmacao dupla).
 *   Apenas marca enabled=false e pausa novas cobrancas futuras.
 * - Beta toggle: se ativado sem data de expiracao, e permanente ate master
 *   desligar manualmente.
 *
 * Esta funcao apenas atualiza flags. Nao faz calls ao Stripe.
 * Integracao com Stripe vem na Fase 2.
 */
export async function applyMasterBillingToggle(
  input: MasterToggleBillingInput,
  masterUid: string,
): Promise<CompanyBillingBlock> {
  const companyRef = adminDb.collection('companies').doc(input.companyId);
  const snap = await companyRef.get();
  if (!snap.exists) {
    throw new Error(`Empresa ${input.companyId} nao encontrada.`);
  }

  const existingBilling: CompanyBillingBlock =
    (snap.data()?.billing as CompanyBillingBlock | undefined) ?? getDefaultBillingBlock();

  const betaExpiresAtValue: Timestamp | FieldValue = input.betaExpiresAt
    ? Timestamp.fromDate(input.betaExpiresAt)
    : FieldValue.delete();

  const notesValue: string | FieldValue =
    input.notes !== undefined && input.notes !== ''
      ? input.notes
      : FieldValue.delete();

  // Monta atualizacao cirurgica (nao sobrescreve estados dos modulos).
  // Usa dot notation para preservar platform/tl/design existentes.
  const updates: Record<string, unknown> = {
    'billing.enabled': input.enabled,
    'billing.isBetaTester': input.isBetaTester,
    'billing.betaExpiresAt': betaExpiresAtValue,
    'billing.notes': notesValue,
    'billing.updatedAt': FieldValue.serverTimestamp(),
    'billing.lastUpdatedByMasterUid': masterUid,
  };

  // Se billing nunca foi inicializado, cria defaults dos modulos.
  if (!snap.data()?.billing) {
    const defaults = getDefaultBillingBlock();
    updates['billing.platform'] = defaults.platform;
    updates['billing.tl'] = defaults.tl;
    updates['billing.design'] = defaults.design;
    updates['billing.createdAt'] = FieldValue.serverTimestamp();
  }

  await companyRef.update(updates);

  // Retorna estado em memoria atualizado (nao re-le Firestore para evitar round trip extra).
  return {
    ...existingBilling,
    enabled: input.enabled,
    isBetaTester: input.isBetaTester,
    betaExpiresAt: input.betaExpiresAt ?? undefined,
    notes: input.notes,
  };
}

// ────────────────────────────────────────────────────────────
// HELPERS DE DEADLINE (usados tambem por crons futuros)
// ────────────────────────────────────────────────────────────

/** Calcula prazo de 7 dias a partir de agora. */
export function computeFirstPaymentDeadline(): Date {
  return new Date(Date.now() + FIRST_PAYMENT_DEADLINE_MS);
}

/**
 * Verifica se um modulo esta bloqueado (deadline vencido sem pagamento).
 * Util para SubscriptionGate no futuro.
 */
export function isModuleBlocked(
  status: BillingModuleStatus,
  deadline: Date | null,
): boolean {
  if (status === 'blocked') return true;
  if (status !== 'pending') return false;
  if (!deadline) return false;
  return deadline.getTime() < Date.now();
}
