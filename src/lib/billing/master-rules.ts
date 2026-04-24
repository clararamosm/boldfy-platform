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

// ────────────────────────────────────────────────────────────
// TL "billedOutsidePlatform" (caso Omie / contratos diretos)
// ────────────────────────────────────────────────────────────
// Casos especiais: empresa paga o modulo TL por fora (contrato direto,
// NAO via Stripe). Master liga a flag e o modulo fica 'active' sem checkout,
// sem deadline. Gate (module-gate.ts) e cron (cron-jobs.ts) ja respeitam
// essa flag — aqui so adicionamos a camada de escrita.

export interface SetTLBilledOutsidePlatformRuleInput {
  companyId: string;
  enabled: boolean;
  executives?: 1 | 2 | 3 | 4 | 5;
  frequency?: 2 | 3 | 4;
}

/** Valida entrada do master para o toggle billedOutsidePlatform do TL. */
export function validateTLBilledOutsidePlatformInput(
  input: unknown,
): SetTLBilledOutsidePlatformRuleInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Payload invalido.');
  }
  const raw = input as Record<string, unknown>;

  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : '';
  if (!companyId) {
    throw new Error('companyId obrigatorio.');
  }

  const enabled = raw.enabled === true;

  // Quando desligando, nao precisa de executives/frequency.
  if (!enabled) {
    return { companyId, enabled: false };
  }

  // Quando ligando, executives (1-5) e frequency (2|3|4) sao obrigatorios.
  const execsNum = Number(raw.executives);
  if (!Number.isInteger(execsNum) || execsNum < 1 || execsNum > 5) {
    throw new Error('executives deve ser inteiro entre 1 e 5.');
  }
  const freqNum = Number(raw.frequency);
  if (freqNum !== 2 && freqNum !== 3 && freqNum !== 4) {
    throw new Error('frequency deve ser 2, 3 ou 4.');
  }

  return {
    companyId,
    enabled: true,
    executives: execsNum as 1 | 2 | 3 | 4 | 5,
    frequency: freqNum as 2 | 3 | 4,
  };
}

/**
 * Liga/desliga a flag billedOutsidePlatform do modulo TL.
 *
 * Regras:
 * - enabled=true exige billing.enabled=true previo (pre-requisito).
 * - Ao ligar: seta tl.billedOutsidePlatform=true, status='active', active=true,
 *   executives, frequency, seats, e limpa firstPaymentDeadline.
 * - Ao desligar: remove a flag, status='disabled', active=false, mantem
 *   executives/frequency/seats como historico.
 * - NUNCA toca em stripeSubscriptionId (pode existir de historico Stripe previo).
 * - Nao faz calls ao Stripe.
 */
export async function applyTLBilledOutsidePlatform(
  input: SetTLBilledOutsidePlatformRuleInput,
  masterUid: string,
): Promise<CompanyBillingBlock> {
  const companyRef = adminDb.collection('companies').doc(input.companyId);
  const snap = await companyRef.get();
  if (!snap.exists) {
    throw new Error(`Empresa ${input.companyId} nao encontrada.`);
  }

  const existingBilling: CompanyBillingBlock =
    (snap.data()?.billing as CompanyBillingBlock | undefined) ?? getDefaultBillingBlock();

  // Pre-requisito: billing.enabled deve estar true para ligar a flag.
  if (input.enabled && existingBilling.enabled !== true) {
    throw new Error(
      'Ative "Cobranca Ativa" (billing.enabled) antes de configurar ativacao especial.',
    );
  }

  const updates: Record<string, unknown> = {
    'billing.updatedAt': FieldValue.serverTimestamp(),
    'billing.lastUpdatedByMasterUid': masterUid,
  };

  if (input.enabled) {
    updates['billing.tl.billedOutsidePlatform'] = true;
    updates['billing.tl.status'] = 'active';
    updates['billing.tl.active'] = true;
    updates['billing.tl.executives'] = input.executives;
    updates['billing.tl.frequency'] = input.frequency;
    updates['billing.tl.seats'] = input.executives; // 1 seat por TL
    // Limpa deadline — nao faz sentido em cobranca externa.
    updates['billing.tl.firstPaymentDeadline'] = FieldValue.delete();
    // NUNCA toca em stripeSubscriptionId.
  } else {
    updates['billing.tl.billedOutsidePlatform'] = FieldValue.delete();
    updates['billing.tl.status'] = 'disabled';
    updates['billing.tl.active'] = false;
    // Preserva executives/frequency/seats como historico.
  }

  await companyRef.update(updates);

  // Projeta em memoria para devolver ao caller sem re-ler Firestore.
  const projectedTl = input.enabled
    ? {
        ...existingBilling.tl,
        billedOutsidePlatform: true,
        status: 'active' as BillingModuleStatus,
        active: true,
        executives: input.executives as number,
        frequency: input.frequency as 2 | 3 | 4,
        seats: input.executives as number,
        firstPaymentDeadline: undefined,
      }
    : {
        ...existingBilling.tl,
        billedOutsidePlatform: undefined,
        status: 'disabled' as BillingModuleStatus,
        active: false,
      };

  return {
    ...existingBilling,
    tl: projectedTl,
  };
}
