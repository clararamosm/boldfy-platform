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
  type PlatformBillingState,
  getDefaultBillingBlock,
} from './types';
import { FIRST_PAYMENT_DEADLINE_MS } from './pricing';

// ────────────────────────────────────────────────────────────
// CONSTANTES DO NOVO FLUXO DE TRIAL
// ────────────────────────────────────────────────────────────

/** Opcoes validas para duracao do trial Platform configurado pelo master. */
export const VALID_TRIAL_DURATIONS_DAYS = [15, 30, 60] as const;
export type ValidTrialDurationDays = (typeof VALID_TRIAL_DURATIONS_DAYS)[number];

/** Default quando empresa eh criada sem master setar duracao explicitamente. */
export const DEFAULT_TRIAL_DURATION_DAYS: ValidTrialDurationDays = 15;

/** Janela em dias para admin adicionar cartao apos fim do trial Platform. */
export const CARD_DEADLINE_WINDOW_DAYS = 7;
const CARD_DEADLINE_WINDOW_MS = CARD_DEADLINE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/** Duracao default do beta em meses. */
export const DEFAULT_BETA_DURATION_MONTHS = 5;

// ────────────────────────────────────────────────────────────
// HELPERS DE DEADLINE (usados tambem por crons)
// ────────────────────────────────────────────────────────────

/** Calcula prazo de 7 dias a partir de agora. */
export function computeFirstPaymentDeadline(): Date {
  return new Date(Date.now() + FIRST_PAYMENT_DEADLINE_MS);
}

/** Calcula data de fim do trial Platform a partir de agora. */
export function computePlatformTrialEndDate(durationDays: number): Date {
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
}

/** Calcula deadline para admin adicionar cartao apos fim do trial Platform. */
export function computeCardDeadlineFromTrialEnd(trialEndsAt: Date): Date {
  return new Date(trialEndsAt.getTime() + CARD_DEADLINE_WINDOW_MS);
}

/** Calcula data de fim do beta = startsAt + durationMonths. */
export function computeBetaEndDate(startsAt: Date, durationMonths: number): Date {
  const end = new Date(startsAt);
  end.setMonth(end.getMonth() + durationMonths);
  return end;
}

/** Verifica se um modulo esta bloqueado (deadline vencido sem pagamento). */
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
// LE estado de billing
// ────────────────────────────────────────────────────────────

/**
 * Le o bloco billing de uma empresa. Se nao existe, inicializa com defaults.
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

// ────────────────────────────────────────────────────────────
// MASTER: SETUP DE TRIAL DO PLATFORM (duracao do free trial)
// ────────────────────────────────────────────────────────────

export interface MasterTrialSetupInput {
  companyId: string;
  trialDurationDays: ValidTrialDurationDays;
}

export function validateMasterTrialSetupInput(input: unknown): MasterTrialSetupInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Payload invalido.');
  }
  const raw = input as Record<string, unknown>;

  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : '';
  if (!companyId) {
    throw new Error('companyId obrigatorio.');
  }

  const durationNum = Number(raw.trialDurationDays);
  if (
    !Number.isInteger(durationNum) ||
    !VALID_TRIAL_DURATIONS_DAYS.includes(durationNum as ValidTrialDurationDays)
  ) {
    throw new Error(
      `trialDurationDays deve ser um de: ${VALID_TRIAL_DURATIONS_DAYS.join(', ')}.`,
    );
  }

  return {
    companyId,
    trialDurationDays: durationNum as ValidTrialDurationDays,
  };
}

/**
 * Aplica configuracao de duracao de trial do Platform.
 *
 * FIX (Bug 1): quando billing nao existe, monta defaults em memoria com
 * trialDurationDays ja aplicado e escreve so o objeto pai (billing.platform),
 * sem paths filhos. Quando billing existe, usa so paths filhos (sem pai).
 * Isso evita "Field billing.platform was specified multiple times".
 */
export async function applyMasterTrialSetup(
  input: MasterTrialSetupInput,
  masterUid: string,
): Promise<CompanyBillingBlock> {
  const companyRef = adminDb.collection('companies').doc(input.companyId);
  const snap = await companyRef.get();
  if (!snap.exists) {
    throw new Error(`Empresa ${input.companyId} nao encontrada.`);
  }

  const existingBilling: CompanyBillingBlock =
    (snap.data()?.billing as CompanyBillingBlock | undefined) ?? getDefaultBillingBlock();

  const billingExists = !!snap.data()?.billing;

  const updates: Record<string, unknown> = {
    'billing.updatedAt': FieldValue.serverTimestamp(),
    'billing.lastUpdatedByMasterUid': masterUid,
  };

  // Se trial ja comecou e nao eh ilimitado, recalcula datas (apos definir nova duracao).
  const trialStartedAtRaw = existingBilling.platform?.trialStartedAt;
  const isUnlimited = existingBilling.platform?.freeTrialUnlimited === true;

  let projectedTrialStartedAt: Date | undefined;
  if (trialStartedAtRaw instanceof Date) {
    projectedTrialStartedAt = trialStartedAtRaw;
  } else if (trialStartedAtRaw && typeof (trialStartedAtRaw as Timestamp).toDate === 'function') {
    projectedTrialStartedAt = (trialStartedAtRaw as Timestamp).toDate();
  }

  let projectedTrialEndsAt: Date | undefined;
  let projectedCardDeadline: Date | undefined;

  if (!billingExists) {
    // Billing nunca foi inicializado: monta tudo em memoria e escreve so os pais.
    const defaults = getDefaultBillingBlock();
    updates['billing.isBetaTester'] = defaults.isBetaTester;
    updates['billing.betaDurationMonths'] = defaults.betaDurationMonths;
    updates['billing.tl'] = defaults.tl;
    updates['billing.design'] = defaults.design;
    updates['billing.createdAt'] = FieldValue.serverTimestamp();
    updates['billing.platform'] = {
      ...defaults.platform,
      trialDurationDays: input.trialDurationDays,
    };
  } else {
    // Billing existe: escreve so paths filhos.
    updates['billing.platform.trialDurationDays'] = input.trialDurationDays;

    if (projectedTrialStartedAt && !isUnlimited) {
      const newTrialEndsAt = new Date(
        projectedTrialStartedAt.getTime() + input.trialDurationDays * 24 * 60 * 60 * 1000,
      );
      const newCardDeadline = computeCardDeadlineFromTrialEnd(newTrialEndsAt);

      updates['billing.platform.trialEndsAt'] = Timestamp.fromDate(newTrialEndsAt);
      updates['billing.platform.cardDeadlineEndsAt'] = Timestamp.fromDate(newCardDeadline);

      projectedTrialEndsAt = newTrialEndsAt;
      projectedCardDeadline = newCardDeadline;
    }
  }

  await companyRef.update(updates);

  return {
    ...existingBilling,
    platform: {
      ...existingBilling.platform,
      trialDurationDays: input.trialDurationDays,
      trialEndsAt: projectedTrialEndsAt ?? existingBilling.platform?.trialEndsAt,
      cardDeadlineEndsAt: projectedCardDeadline ?? existingBilling.platform?.cardDeadlineEndsAt,
    },
  };
}

// ────────────────────────────────────────────────────────────
// MASTER: TOGGLE FREE UNLIMITED (Boldfy / parceiros)
// ────────────────────────────────────────────────────────────

export interface ToggleFreeUnlimitedInput {
  companyId: string;
  enabled: boolean;
}

export function validateToggleFreeUnlimitedInput(input: unknown): ToggleFreeUnlimitedInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Payload invalido.');
  }
  const raw = input as Record<string, unknown>;

  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : '';
  if (!companyId) {
    throw new Error('companyId obrigatorio.');
  }

  return { companyId, enabled: raw.enabled === true };
}

/**
 * Liga/desliga "Free Unlimited" do Platform.
 *
 * FIX (Bug 1): quando billing nao existe, monta o objeto platform inteiro
 * em memoria com freeTrialUnlimited+status+trialStartedAt aplicados, e
 * escreve so o pai (billing.platform). Quando billing existe, escreve so
 * paths filhos. Evita "Field billing.platform was specified multiple times".
 */
export async function applyToggleFreeUnlimited(
  input: ToggleFreeUnlimitedInput,
  masterUid: string,
): Promise<CompanyBillingBlock> {
  const companyRef = adminDb.collection('companies').doc(input.companyId);
  const snap = await companyRef.get();
  if (!snap.exists) {
    throw new Error(`Empresa ${input.companyId} nao encontrada.`);
  }

  const existingBilling: CompanyBillingBlock =
    (snap.data()?.billing as CompanyBillingBlock | undefined) ?? getDefaultBillingBlock();

  const billingExists = !!snap.data()?.billing;

  const updates: Record<string, unknown> = {
    'billing.updatedAt': FieldValue.serverTimestamp(),
    'billing.lastUpdatedByMasterUid': masterUid,
  };

  // Normaliza trialStartedAt existente
  const trialStartedAtRaw = existingBilling.platform?.trialStartedAt;
  let projectedTrialStartedAt: Date | undefined;
  if (trialStartedAtRaw instanceof Date) {
    projectedTrialStartedAt = trialStartedAtRaw;
  } else if (trialStartedAtRaw && typeof (trialStartedAtRaw as Timestamp).toDate === 'function') {
    projectedTrialStartedAt = (trialStartedAtRaw as Timestamp).toDate();
  }

  let projectedPlatformStatus: BillingModuleStatus = existingBilling.platform?.status ?? 'disabled';
  let projectedTrialEndsAt: Date | undefined;
  let projectedCardDeadline: Date | undefined;

  if (input.enabled) {
    // LIGAR: free permanente.
    projectedPlatformStatus = 'free';

    // Se nunca comecou trial, marca trialStartedAt=agora para auditoria.
    if (!projectedTrialStartedAt) {
      projectedTrialStartedAt = new Date();
    }

    if (!billingExists) {
      // Monta defaults em memoria com tudo aplicado, escreve so o pai.
      const defaults = getDefaultBillingBlock();
      updates['billing.isBetaTester'] = defaults.isBetaTester;
      updates['billing.betaDurationMonths'] = defaults.betaDurationMonths;
      updates['billing.tl'] = defaults.tl;
      updates['billing.design'] = defaults.design;
      updates['billing.createdAt'] = FieldValue.serverTimestamp();
      updates['billing.platform'] = {
        ...defaults.platform,
        freeTrialUnlimited: true,
        status: 'free',
        trialStartedAt: Timestamp.fromDate(projectedTrialStartedAt),
      };
    } else {
      // Paths filhos individuais.
      updates['billing.platform.freeTrialUnlimited'] = true;
      updates['billing.platform.status'] = 'free';
      updates['billing.platform.trialEndsAt'] = FieldValue.delete();
      updates['billing.platform.cardDeadlineEndsAt'] = FieldValue.delete();
      updates['billing.platform.firstPaymentDeadline'] = FieldValue.delete();

      if (!existingBilling.platform?.trialStartedAt) {
        updates['billing.platform.trialStartedAt'] = Timestamp.fromDate(projectedTrialStartedAt);
      }
    }
  } else {
    // DESLIGAR: volta para fluxo normal.
    const durationDays =
      existingBilling.platform?.trialDurationDays ?? DEFAULT_TRIAL_DURATION_DAYS;

    if (projectedTrialStartedAt) {
      const newTrialEndsAt = new Date(
        projectedTrialStartedAt.getTime() + durationDays * 24 * 60 * 60 * 1000,
      );
      const newCardDeadline = computeCardDeadlineFromTrialEnd(newTrialEndsAt);
      projectedTrialEndsAt = newTrialEndsAt;
      projectedCardDeadline = newCardDeadline;

      if (newTrialEndsAt.getTime() <= Date.now()) {
        projectedPlatformStatus = 'pending';
      } else {
        projectedPlatformStatus = 'free';
      }
    } else {
      projectedPlatformStatus = 'disabled';
    }

    if (!billingExists) {
      const defaults = getDefaultBillingBlock();
      updates['billing.isBetaTester'] = defaults.isBetaTester;
      updates['billing.betaDurationMonths'] = defaults.betaDurationMonths;
      updates['billing.tl'] = defaults.tl;
      updates['billing.design'] = defaults.design;
      updates['billing.createdAt'] = FieldValue.serverTimestamp();
      const platformObj: PlatformBillingState = {
        ...defaults.platform,
        freeTrialUnlimited: false,
        status: projectedPlatformStatus,
      };
      if (projectedTrialStartedAt) {
        platformObj.trialStartedAt = Timestamp.fromDate(projectedTrialStartedAt);
      }
      if (projectedTrialEndsAt) {
        platformObj.trialEndsAt = Timestamp.fromDate(projectedTrialEndsAt);
      }
      if (projectedCardDeadline) {
        platformObj.cardDeadlineEndsAt = Timestamp.fromDate(projectedCardDeadline);
      }
      updates['billing.platform'] = platformObj;
    } else {
      updates['billing.platform.freeTrialUnlimited'] = false;
      updates['billing.platform.status'] = projectedPlatformStatus;
      if (projectedTrialEndsAt && projectedCardDeadline) {
        updates['billing.platform.trialEndsAt'] = Timestamp.fromDate(projectedTrialEndsAt);
        updates['billing.platform.cardDeadlineEndsAt'] = Timestamp.fromDate(projectedCardDeadline);
      } else {
        updates['billing.platform.trialEndsAt'] = FieldValue.delete();
        updates['billing.platform.cardDeadlineEndsAt'] = FieldValue.delete();
      }
    }
  }

  await companyRef.update(updates);

  return {
    ...existingBilling,
    platform: {
      ...existingBilling.platform,
      freeTrialUnlimited: input.enabled,
      status: projectedPlatformStatus,
      trialStartedAt: projectedTrialStartedAt,
      trialEndsAt: projectedTrialEndsAt,
      cardDeadlineEndsAt: projectedCardDeadline,
    },
  };
}

// ────────────────────────────────────────────────────────────
// HOOK: ADMIN FIRST LOGIN (dispara inicio do trial Platform)
// ────────────────────────────────────────────────────────────

export interface ApplyAdminFirstLoginResult {
  started: boolean;
  billing: CompanyBillingBlock;
}

/**
 * Inicia o trial Platform de uma empresa quando admin loga pela 1a vez.
 * Idempotente: so age se Platform ainda esta 'disabled'.
 */
export async function applyAdminFirstLogin(
  companyId: string,
): Promise<ApplyAdminFirstLoginResult> {
  if (!companyId || typeof companyId !== 'string') {
    throw new Error('companyId obrigatorio.');
  }

  const companyRef = adminDb.collection('companies').doc(companyId);
  const snap = await companyRef.get();
  if (!snap.exists) {
    throw new Error(`Empresa ${companyId} nao encontrada.`);
  }

  const existingBilling: CompanyBillingBlock =
    (snap.data()?.billing as CompanyBillingBlock | undefined) ?? getDefaultBillingBlock();

  if (existingBilling.platform?.status !== 'disabled') {
    return { started: false, billing: existingBilling };
  }

  const billingExists = !!snap.data()?.billing;
  const isUnlimited = existingBilling.platform?.freeTrialUnlimited === true;
  const durationDays =
    existingBilling.platform?.trialDurationDays ?? DEFAULT_TRIAL_DURATION_DAYS;
  const now = new Date();

  let projectedTrialEndsAt: Date | undefined;
  let projectedCardDeadline: Date | undefined;

  const updates: Record<string, unknown> = {
    'billing.updatedAt': FieldValue.serverTimestamp(),
  };

  if (!billingExists) {
    // Empresa sem billing: cria tudo em memoria.
    const defaults = getDefaultBillingBlock();
    updates['billing.isBetaTester'] = defaults.isBetaTester;
    updates['billing.betaDurationMonths'] = defaults.betaDurationMonths;
    updates['billing.tl'] = defaults.tl;
    updates['billing.design'] = defaults.design;
    updates['billing.createdAt'] = FieldValue.serverTimestamp();
    const platformObj: PlatformBillingState = {
      ...defaults.platform,
      status: 'free',
      trialStartedAt: Timestamp.fromDate(now),
      trialDurationDays: durationDays,
    };
    if (!isUnlimited) {
      const trialEndsAt = computePlatformTrialEndDate(durationDays);
      const cardDeadline = computeCardDeadlineFromTrialEnd(trialEndsAt);
      platformObj.trialEndsAt = Timestamp.fromDate(trialEndsAt);
      platformObj.cardDeadlineEndsAt = Timestamp.fromDate(cardDeadline);
      projectedTrialEndsAt = trialEndsAt;
      projectedCardDeadline = cardDeadline;
    }
    updates['billing.platform'] = platformObj;
  } else {
    updates['billing.platform.status'] = 'free';
    updates['billing.platform.trialStartedAt'] = Timestamp.fromDate(now);

    if (isUnlimited) {
      updates['billing.platform.trialEndsAt'] = FieldValue.delete();
      updates['billing.platform.cardDeadlineEndsAt'] = FieldValue.delete();
    } else {
      const trialEndsAt = computePlatformTrialEndDate(durationDays);
      const cardDeadline = computeCardDeadlineFromTrialEnd(trialEndsAt);
      updates['billing.platform.trialEndsAt'] = Timestamp.fromDate(trialEndsAt);
      updates['billing.platform.cardDeadlineEndsAt'] = Timestamp.fromDate(cardDeadline);
      if (existingBilling.platform?.trialDurationDays === undefined) {
        updates['billing.platform.trialDurationDays'] = durationDays;
      }
      projectedTrialEndsAt = trialEndsAt;
      projectedCardDeadline = cardDeadline;
    }
  }

  await companyRef.update(updates);

  return {
    started: true,
    billing: {
      ...existingBilling,
      platform: {
        ...existingBilling.platform,
        status: 'free',
        trialStartedAt: now,
        trialEndsAt: projectedTrialEndsAt,
        cardDeadlineEndsAt: projectedCardDeadline,
        trialDurationDays:
          existingBilling.platform?.trialDurationDays ?? durationDays,
      },
    },
  };
}

// ────────────────────────────────────────────────────────────
// TL "billedOutsidePlatform" (contratos diretos / cobrados fora da plataforma)
// ────────────────────────────────────────────────────────────

export interface SetTLBilledOutsidePlatformRuleInput {
  companyId: string;
  enabled: boolean;
  executives?: 1 | 2 | 3 | 4 | 5;
  frequency?: 2 | 3 | 4;
}

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

  if (!enabled) {
    return { companyId, enabled: false };
  }

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
 * Removido pre-requisito billing.enabled (campo nao existe mais).
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
    updates['billing.tl.seats'] = input.executives;
    updates['billing.tl.firstPaymentDeadline'] = FieldValue.delete();
  } else {
    updates['billing.tl.billedOutsidePlatform'] = FieldValue.delete();
    updates['billing.tl.status'] = 'disabled';
    updates['billing.tl.active'] = false;
  }

  await companyRef.update(updates);

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

// ────────────────────────────────────────────────────────────
// MASTER: BETA TESTER (dataDuracao + isBetaTester)
// ────────────────────────────────────────────────────────────

export interface MasterBetaSetupInput {
  companyId: string;
  isBetaTester: boolean;
  betaDurationMonths?: number;
  notes?: string;
}

export function validateMasterBetaSetupInput(input: unknown): MasterBetaSetupInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Payload invalido.');
  }
  const raw = input as Record<string, unknown>;

  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : '';
  if (!companyId) {
    throw new Error('companyId obrigatorio.');
  }

  const isBetaTester = raw.isBetaTester === true;

  let betaDurationMonths: number | undefined;
  if (raw.betaDurationMonths !== undefined && raw.betaDurationMonths !== null) {
    const n = Number(raw.betaDurationMonths);
    if (!Number.isInteger(n) || n < 1 || n > 24) {
      throw new Error('betaDurationMonths deve ser inteiro entre 1 e 24.');
    }
    betaDurationMonths = n;
  }

  let notes: string | undefined;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      throw new Error('notes deve ser string.');
    }
    notes = raw.notes.slice(0, 1000);
  }

  return { companyId, isBetaTester, betaDurationMonths, notes };
}

// ────────────────────────────────────────────────────────────
// MASTER: SAVE BILLING (transacao unica — substitui multiplos botoes)
// ────────────────────────────────────────────────────────────
//
// Aplica TODAS as mudancas do painel master de uma vez, atomicamente.
// Substitui os multiplos botoes "Salvar" da UI antiga, evitando estados
// intermediarios inconsistentes (ex: salvou trial mas falhou em TL).

export interface SaveMasterBillingInput {
  companyId: string;
  // Plano Platform
  trialDurationDays: ValidTrialDurationDays;
  freeTrialUnlimited: boolean;
  // Beta tester (card independente)
  isBetaTester: boolean;
  /** Obrigatorio quando isBetaTester=true; ignorado quando false */
  betaDurationMonths?: number;
  // Plano TL
  tlBilledOutsidePlatform: boolean;
  tlExecutives?: 1 | 2 | 3 | 4 | 5;
  tlFrequency?: 2 | 3 | 4;
  // Notas
  notes?: string;
}

export function validateSaveMasterBillingInput(input: unknown): SaveMasterBillingInput {
  if (!input || typeof input !== 'object') {
    throw new Error('Payload invalido.');
  }
  const raw = input as Record<string, unknown>;

  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : '';
  if (!companyId) {
    throw new Error('companyId obrigatorio.');
  }

  const trialNum = Number(raw.trialDurationDays);
  if (!VALID_TRIAL_DURATIONS_DAYS.includes(trialNum as ValidTrialDurationDays)) {
    throw new Error(
      `trialDurationDays deve ser um de: ${VALID_TRIAL_DURATIONS_DAYS.join(', ')}.`,
    );
  }

  const freeTrialUnlimited = raw.freeTrialUnlimited === true;
  const isBetaTester = raw.isBetaTester === true;

  // betaDurationMonths so e validado quando isBetaTester=true.
  // Quando o switch esta desligado, a UI envia null/undefined — aceitamos.
  let betaDurationMonths: number | undefined;
  if (isBetaTester) {
    const betaNum = Number(raw.betaDurationMonths);
    if (!Number.isInteger(betaNum) || betaNum < 1 || betaNum > 24) {
      throw new Error('betaDurationMonths deve ser inteiro entre 1 e 24.');
    }
    betaDurationMonths = betaNum;
  }

  const tlBilledOutsidePlatform = raw.tlBilledOutsidePlatform === true;

  let tlExecutives: 1 | 2 | 3 | 4 | 5 | undefined;
  let tlFrequency: 2 | 3 | 4 | undefined;
  if (tlBilledOutsidePlatform) {
    const e = Number(raw.tlExecutives);
    if (!Number.isInteger(e) || e < 1 || e > 5) {
      throw new Error('tlExecutives deve ser inteiro entre 1 e 5.');
    }
    const f = Number(raw.tlFrequency);
    if (f !== 2 && f !== 3 && f !== 4) {
      throw new Error('tlFrequency deve ser 2, 3 ou 4.');
    }
    tlExecutives = e as 1 | 2 | 3 | 4 | 5;
    tlFrequency = f as 2 | 3 | 4;
  }

  let notes: string | undefined;
  if (raw.notes !== undefined && raw.notes !== null) {
    if (typeof raw.notes !== 'string') {
      throw new Error('notes deve ser string.');
    }
    notes = raw.notes.slice(0, 1000);
  }

  return {
    companyId,
    trialDurationDays: trialNum as ValidTrialDurationDays,
    freeTrialUnlimited,
    isBetaTester,
    betaDurationMonths,
    tlBilledOutsidePlatform,
    tlExecutives,
    tlFrequency,
    notes,
  };
}

/**
 * Aplica TODAS as mudancas do painel master atomicamente.
 *
 * Estrategia: monta UM unico companyRef.update() com todos os campos.
 * Se billing nao existe, monta defaults em memoria e escreve so os pais.
 * Se billing existe, escreve so paths filhos (sem mistura pai+filho).
 */
export async function applySaveMasterBilling(
  input: SaveMasterBillingInput,
  masterUid: string,
): Promise<CompanyBillingBlock> {
  const companyRef = adminDb.collection('companies').doc(input.companyId);
  const snap = await companyRef.get();
  if (!snap.exists) {
    throw new Error(`Empresa ${input.companyId} nao encontrada.`);
  }

  const existingBilling: CompanyBillingBlock =
    (snap.data()?.billing as CompanyBillingBlock | undefined) ?? getDefaultBillingBlock();

  const billingExists = !!snap.data()?.billing;
  const now = new Date();

  // Normaliza trialStartedAt
  const trialStartedAtRaw = existingBilling.platform?.trialStartedAt;
  let projectedTrialStartedAt: Date | undefined;
  if (trialStartedAtRaw instanceof Date) {
    projectedTrialStartedAt = trialStartedAtRaw;
  } else if (trialStartedAtRaw && typeof (trialStartedAtRaw as Timestamp).toDate === 'function') {
    projectedTrialStartedAt = (trialStartedAtRaw as Timestamp).toDate();
  }

  // Calcula estado projetado do Platform
  let projectedPlatformStatus: BillingModuleStatus = existingBilling.platform?.status ?? 'disabled';
  let projectedTrialEndsAt: Date | undefined;
  let projectedCardDeadline: Date | undefined;

  if (input.freeTrialUnlimited) {
    projectedPlatformStatus = 'free';
    if (!projectedTrialStartedAt) {
      projectedTrialStartedAt = now;
    }
    projectedTrialEndsAt = undefined;
    projectedCardDeadline = undefined;
  } else if (projectedTrialStartedAt) {
    const newEnd = new Date(
      projectedTrialStartedAt.getTime() + input.trialDurationDays * 24 * 60 * 60 * 1000,
    );
    const newDeadline = computeCardDeadlineFromTrialEnd(newEnd);
    projectedTrialEndsAt = newEnd;
    projectedCardDeadline = newDeadline;
    if (newEnd.getTime() <= now.getTime()) {
      // Trial ja terminou — cron promove para pending; aqui mantem free se ainda
      // estava free (cron decide), ou conserva status atual se nao era free.
      if (projectedPlatformStatus === 'free') {
        projectedPlatformStatus = newDeadline.getTime() < now.getTime() ? 'blocked' : 'pending';
      }
    } else if (projectedPlatformStatus === 'disabled') {
      // Empresa tinha trial mas estava disabled? Deixa assim — admin first login dispara.
    }
  }

  // Calcula estado projetado do Beta
  // IMPORTANTE: master NUNCA seta betaStartsAt manualmente. Apenas o webhook
  // do Stripe (`invoice.paid`) seta quando a 1a fatura do Platform e paga.
  // Aqui apenas preservamos data existente e recalculamos betaEndsAt se a
  // duracao mudou no meio do beta (ex: master estendeu de 3 pra 5 meses).
  const existingBetaStartsAtRaw = existingBilling.betaStartsAt;
  let projectedBetaStartsAt: Date | undefined;
  if (existingBetaStartsAtRaw instanceof Date) {
    projectedBetaStartsAt = existingBetaStartsAtRaw;
  } else if (existingBetaStartsAtRaw && typeof (existingBetaStartsAtRaw as Timestamp).toDate === 'function') {
    projectedBetaStartsAt = (existingBetaStartsAtRaw as Timestamp).toDate();
  }

  let projectedBetaEndsAt: Date | undefined;
  if (input.isBetaTester && projectedBetaStartsAt && input.betaDurationMonths) {
    projectedBetaEndsAt = computeBetaEndDate(projectedBetaStartsAt, input.betaDurationMonths);
  }

  // ─── Monta updates ───────────────────────────────────────
  const updates: Record<string, unknown> = {
    'billing.updatedAt': FieldValue.serverTimestamp(),
    'billing.lastUpdatedByMasterUid': masterUid,
    'billing.isBetaTester': input.isBetaTester,
    'billing.notes':
      input.notes !== undefined && input.notes !== '' ? input.notes : FieldValue.delete(),
  };

  // Beta duration: persistido somente quando beta ligado.
  if (input.isBetaTester && input.betaDurationMonths !== undefined) {
    updates['billing.betaDurationMonths'] = input.betaDurationMonths;
  } else if (!input.isBetaTester) {
    // Beta desligado: limpa duration tambem para nao deixar lixo no doc.
    updates['billing.betaDurationMonths'] = FieldValue.delete();
  }

  // Beta dates: master NUNCA cria betaStartsAt — webhook invoice.paid faz isso.
  if (input.isBetaTester) {
    if (projectedBetaStartsAt) {
      // Beta ja iniciado — preserva data e recalcula fim (caso duration mudou).
      updates['billing.betaStartsAt'] = Timestamp.fromDate(projectedBetaStartsAt);
      if (projectedBetaEndsAt) {
        updates['billing.betaEndsAt'] = Timestamp.fromDate(projectedBetaEndsAt);
      } else {
        updates['billing.betaEndsAt'] = FieldValue.delete();
      }
    }
    // Beta ainda nao comecou: nao toca em betaStartsAt/betaEndsAt — webhook fara.
  } else {
    // Beta desligado: limpa datas (preserva historico via betaExpiresAt deprecated)
    updates['billing.betaStartsAt'] = FieldValue.delete();
    updates['billing.betaEndsAt'] = FieldValue.delete();
  }

  if (!billingExists) {
    // Caso 1: empresa nunca teve billing — monta tudo em memoria.
    const defaults = getDefaultBillingBlock();
    updates['billing.createdAt'] = FieldValue.serverTimestamp();
    updates['billing.design'] = defaults.design;

    const platformObj: PlatformBillingState = {
      ...defaults.platform,
      trialDurationDays: input.trialDurationDays,
      freeTrialUnlimited: input.freeTrialUnlimited,
      status: projectedPlatformStatus,
    };
    if (projectedTrialStartedAt) {
      platformObj.trialStartedAt = Timestamp.fromDate(projectedTrialStartedAt);
    }
    if (projectedTrialEndsAt && !input.freeTrialUnlimited) {
      platformObj.trialEndsAt = Timestamp.fromDate(projectedTrialEndsAt);
    }
    if (projectedCardDeadline && !input.freeTrialUnlimited) {
      platformObj.cardDeadlineEndsAt = Timestamp.fromDate(projectedCardDeadline);
    }
    updates['billing.platform'] = platformObj;

    // TL
    if (input.tlBilledOutsidePlatform && input.tlExecutives && input.tlFrequency) {
      updates['billing.tl'] = {
        ...defaults.tl,
        billedOutsidePlatform: true,
        status: 'active' as BillingModuleStatus,
        active: true,
        executives: input.tlExecutives,
        frequency: input.tlFrequency,
        seats: input.tlExecutives,
      };
    } else {
      updates['billing.tl'] = defaults.tl;
    }
  } else {
    // Caso 2: empresa tem billing — escreve so paths filhos.

    // Platform
    updates['billing.platform.trialDurationDays'] = input.trialDurationDays;
    updates['billing.platform.freeTrialUnlimited'] = input.freeTrialUnlimited;
    updates['billing.platform.status'] = projectedPlatformStatus;

    if (projectedTrialStartedAt) {
      updates['billing.platform.trialStartedAt'] = Timestamp.fromDate(projectedTrialStartedAt);
    }

    if (input.freeTrialUnlimited) {
      updates['billing.platform.trialEndsAt'] = FieldValue.delete();
      updates['billing.platform.cardDeadlineEndsAt'] = FieldValue.delete();
      updates['billing.platform.firstPaymentDeadline'] = FieldValue.delete();
    } else if (projectedTrialEndsAt && projectedCardDeadline) {
      updates['billing.platform.trialEndsAt'] = Timestamp.fromDate(projectedTrialEndsAt);
      updates['billing.platform.cardDeadlineEndsAt'] = Timestamp.fromDate(projectedCardDeadline);
    }

    // TL
    if (input.tlBilledOutsidePlatform && input.tlExecutives && input.tlFrequency) {
      updates['billing.tl.billedOutsidePlatform'] = true;
      updates['billing.tl.status'] = 'active';
      updates['billing.tl.active'] = true;
      updates['billing.tl.executives'] = input.tlExecutives;
      updates['billing.tl.frequency'] = input.tlFrequency;
      updates['billing.tl.seats'] = input.tlExecutives;
      updates['billing.tl.firstPaymentDeadline'] = FieldValue.delete();
    } else {
      updates['billing.tl.billedOutsidePlatform'] = FieldValue.delete();
      // So mexe no status TL se ele estava como billedOutsidePlatform antes
      // (nao queremos resetar TL pago via Stripe quando master desliga o toggle externo).
      if (existingBilling.tl?.billedOutsidePlatform === true) {
        updates['billing.tl.status'] = 'disabled';
        updates['billing.tl.active'] = false;
      }
    }
  }

  await companyRef.update(updates);

  // Projeta resultado em memoria
  const projectedTl = input.tlBilledOutsidePlatform && input.tlExecutives && input.tlFrequency
    ? {
        ...existingBilling.tl,
        billedOutsidePlatform: true,
        status: 'active' as BillingModuleStatus,
        active: true,
        executives: input.tlExecutives as number,
        frequency: input.tlFrequency as 2 | 3 | 4,
        seats: input.tlExecutives as number,
        firstPaymentDeadline: undefined,
      }
    : existingBilling.tl?.billedOutsidePlatform === true
    ? {
        ...existingBilling.tl,
        billedOutsidePlatform: undefined,
        status: 'disabled' as BillingModuleStatus,
        active: false,
      }
    : existingBilling.tl;

  return {
    ...existingBilling,
    isBetaTester: input.isBetaTester,
    betaDurationMonths: input.betaDurationMonths,
    betaStartsAt: input.isBetaTester ? projectedBetaStartsAt : undefined,
    betaEndsAt: input.isBetaTester ? projectedBetaEndsAt : undefined,
    notes: input.notes,
    platform: {
      ...existingBilling.platform,
      trialDurationDays: input.trialDurationDays,
      freeTrialUnlimited: input.freeTrialUnlimited,
      status: projectedPlatformStatus,
      trialStartedAt: projectedTrialStartedAt,
      trialEndsAt: input.freeTrialUnlimited ? undefined : projectedTrialEndsAt,
      cardDeadlineEndsAt: input.freeTrialUnlimited ? undefined : projectedCardDeadline,
    },
    tl: projectedTl,
  };
}
