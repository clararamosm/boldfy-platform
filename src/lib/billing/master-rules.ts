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
 * Calcula data de fim do trial Platform a partir de agora.
 * Usada quando admin entra pela 1a vez na plataforma.
 */
export function computePlatformTrialEndDate(durationDays: number): Date {
  return new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
}

/**
 * Calcula deadline para admin adicionar cartao apos fim do trial Platform.
 * = trialEndsAt + 7 dias.
 */
export function computeCardDeadlineFromTrialEnd(trialEndsAt: Date): Date {
  return new Date(trialEndsAt.getTime() + CARD_DEADLINE_WINDOW_MS);
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
// MASTER: SETUP DE TRIAL DO PLATFORM (duracao do free trial)
// ────────────────────────────────────────────────────────────
// Master define quanto dura o periodo gratuito da Platform daquela empresa.
// Pode ser chamado a qualquer momento (ate mesmo apos trial ja iniciado).
// Se trial ja comecou, recalcula trialEndsAt = trialStartedAt + novoDurationDays.

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
 * Regras:
 * - Sempre escreve trialDurationDays.
 * - Se trial ainda nao comecou (trialStartedAt undefined): apenas configura,
 *   sem mexer em datas (admin first login que vai disparar).
 * - Se trial ja comecou: recalcula trialEndsAt = trialStartedAt + novoDurationDays.
 *   Tambem recalcula cardDeadlineEndsAt = novoTrialEndsAt + 7 dias.
 *   (mesmo se trial ja terminou — master pode estar dando "extensao").
 * - Se freeTrialUnlimited=true: configura trialDurationDays mesmo assim
 *   (fica como "valor base" caso o ilimitado seja desligado depois),
 *   mas NAO recalcula trialEndsAt/cardDeadlineEndsAt (continuam undefined).
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

  const updates: Record<string, unknown> = {
    'billing.platform.trialDurationDays': input.trialDurationDays,
    'billing.updatedAt': FieldValue.serverTimestamp(),
    'billing.lastUpdatedByMasterUid': masterUid,
  };

  // Se billing nunca foi inicializado, cria defaults dos modulos antes.
  if (!snap.data()?.billing) {
    const defaults = getDefaultBillingBlock();
    updates['billing.enabled'] = defaults.enabled;
    updates['billing.isBetaTester'] = defaults.isBetaTester;
    updates['billing.tl'] = defaults.tl;
    updates['billing.design'] = defaults.design;
    updates['billing.createdAt'] = FieldValue.serverTimestamp();
    // Sobrescreve apenas trialDurationDays no platform default.
    updates['billing.platform'] = {
      ...defaults.platform,
      trialDurationDays: input.trialDurationDays,
    };
  }

  // Se trial ja comecou e nao eh ilimitado, recalcula datas.
  const trialStartedAt = existingBilling.platform?.trialStartedAt;
  const isUnlimited = existingBilling.platform?.freeTrialUnlimited === true;

  let projectedTrialEndsAt: Date | undefined =
    existingBilling.platform?.trialEndsAt instanceof Date
      ? existingBilling.platform.trialEndsAt
      : (existingBilling.platform?.trialEndsAt as Timestamp | null | undefined)?.toDate?.() ?? undefined;
  let projectedCardDeadline: Date | undefined =
    existingBilling.platform?.cardDeadlineEndsAt instanceof Date
      ? existingBilling.platform.cardDeadlineEndsAt
      : (existingBilling.platform?.cardDeadlineEndsAt as Timestamp | null | undefined)?.toDate?.() ?? undefined;

  if (trialStartedAt && !isUnlimited) {
    const startedAtDate =
      trialStartedAt instanceof Date ? trialStartedAt : (trialStartedAt as Timestamp).toDate();
    const newTrialEndsAt = new Date(
      startedAtDate.getTime() + input.trialDurationDays * 24 * 60 * 60 * 1000,
    );
    const newCardDeadline = computeCardDeadlineFromTrialEnd(newTrialEndsAt);

    updates['billing.platform.trialEndsAt'] = Timestamp.fromDate(newTrialEndsAt);
    updates['billing.platform.cardDeadlineEndsAt'] = Timestamp.fromDate(newCardDeadline);

    projectedTrialEndsAt = newTrialEndsAt;
    projectedCardDeadline = newCardDeadline;
  }

  await companyRef.update(updates);

  return {
    ...existingBilling,
    platform: {
      ...existingBilling.platform,
      trialDurationDays: input.trialDurationDays,
      trialEndsAt: projectedTrialEndsAt,
      cardDeadlineEndsAt: projectedCardDeadline,
    },
  };
}

// ────────────────────────────────────────────────────────────
// MASTER: TOGGLE FREE UNLIMITED (Boldfy / parceiros)
// ────────────────────────────────────────────────────────────
// Marca uma empresa como "Plataforma free ilimitada" (caso Boldfy).
// Quando ligado: status='free' permanente, sem trialEndsAt, sem cardDeadline.
// Quando desligado: volta a fluxo normal de trial (mantem trialDurationDays).

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
 * Regras LIGAR:
 * - freeTrialUnlimited=true.
 * - status='free' (forca de volta mesmo se estava em pending/blocked — resgate).
 * - Limpa trialEndsAt e cardDeadlineEndsAt (nao fazem sentido em ilimitado).
 * - Se trialStartedAt undefined, seta agora (efetivamente "destrava" o uso).
 *
 * Regras DESLIGAR:
 * - freeTrialUnlimited=false.
 * - Se trialStartedAt definido e trialDurationDays definido: recalcula
 *   trialEndsAt = trialStartedAt + trialDurationDays e
 *   cardDeadlineEndsAt = trialEndsAt + 7 dias.
 *   Se trial ja teria terminado, status vira 'pending'. Senao, fica 'free'.
 * - Se trial nunca comecou: status volta para 'disabled' (espera admin login).
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

  const updates: Record<string, unknown> = {
    'billing.updatedAt': FieldValue.serverTimestamp(),
    'billing.lastUpdatedByMasterUid': masterUid,
  };

  // Se billing nunca foi inicializado, cria defaults antes.
  if (!snap.data()?.billing) {
    const defaults = getDefaultBillingBlock();
    updates['billing.enabled'] = defaults.enabled;
    updates['billing.isBetaTester'] = defaults.isBetaTester;
    updates['billing.tl'] = defaults.tl;
    updates['billing.design'] = defaults.design;
    updates['billing.createdAt'] = FieldValue.serverTimestamp();
    updates['billing.platform'] = defaults.platform;
  }

  let projectedPlatformStatus: BillingModuleStatus = existingBilling.platform?.status ?? 'disabled';
  let projectedTrialStartedAt: Date | undefined =
    existingBilling.platform?.trialStartedAt instanceof Date
      ? existingBilling.platform?.trialStartedAt
      : (existingBilling.platform?.trialStartedAt as Timestamp | undefined)?.toDate();
  let projectedTrialEndsAt: Date | undefined;
  let projectedCardDeadline: Date | undefined;

  if (input.enabled) {
    // LIGAR: free permanente.
    updates['billing.platform.freeTrialUnlimited'] = true;
    updates['billing.platform.status'] = 'free';
    updates['billing.platform.trialEndsAt'] = FieldValue.delete();
    updates['billing.platform.cardDeadlineEndsAt'] = FieldValue.delete();
    // Mantem firstPaymentDeadline (deprecated) limpo tambem.
    updates['billing.platform.firstPaymentDeadline'] = FieldValue.delete();

    // Se nunca comecou, marca trialStartedAt=agora para fins de auditoria.
    if (!projectedTrialStartedAt) {
      const now = new Date();
      updates['billing.platform.trialStartedAt'] = Timestamp.fromDate(now);
      projectedTrialStartedAt = now;
    }

    projectedPlatformStatus = 'free';
    projectedTrialEndsAt = undefined;
    projectedCardDeadline = undefined;
  } else {
    // DESLIGAR: volta para fluxo normal.
    updates['billing.platform.freeTrialUnlimited'] = false;

    const durationDays =
      existingBilling.platform?.trialDurationDays ?? DEFAULT_TRIAL_DURATION_DAYS;

    if (projectedTrialStartedAt) {
      const newTrialEndsAt = new Date(
        projectedTrialStartedAt.getTime() + durationDays * 24 * 60 * 60 * 1000,
      );
      const newCardDeadline = computeCardDeadlineFromTrialEnd(newTrialEndsAt);

      updates['billing.platform.trialEndsAt'] = Timestamp.fromDate(newTrialEndsAt);
      updates['billing.platform.cardDeadlineEndsAt'] = Timestamp.fromDate(newCardDeadline);
      projectedTrialEndsAt = newTrialEndsAt;
      projectedCardDeadline = newCardDeadline;

      if (newTrialEndsAt.getTime() <= Date.now()) {
        // Trial ja teria acabado — entra em pending (admin tem 7d para cartao).
        updates['billing.platform.status'] = 'pending';
        projectedPlatformStatus = 'pending';
      } else {
        // Ainda no trial.
        updates['billing.platform.status'] = 'free';
        projectedPlatformStatus = 'free';
      }
    } else {
      // Nunca comecou trial (admin nao logou ainda) — espera login.
      updates['billing.platform.status'] = 'disabled';
      updates['billing.platform.trialEndsAt'] = FieldValue.delete();
      updates['billing.platform.cardDeadlineEndsAt'] = FieldValue.delete();
      projectedPlatformStatus = 'disabled';
      projectedTrialEndsAt = undefined;
      projectedCardDeadline = undefined;
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
// Chamado quando admin entra na plataforma pela 1a vez.
// Idempotente: chamadas seguintes nao alteram nada (so atualiza se for transicao valida).

export interface ApplyAdminFirstLoginResult {
  /** True se a chamada efetivamente iniciou o trial agora. */
  started: boolean;
  billing: CompanyBillingBlock;
}

/**
 * Inicia o trial Platform de uma empresa quando admin loga pela 1a vez.
 *
 * Regras:
 * - So age se status='disabled' (estado inicial pos-criacao pelo master).
 * - Se freeTrialUnlimited=true: pula transicao (mantem 'free' indefinido,
 *   sem trialEndsAt). Apenas marca trialStartedAt=agora para auditoria
 *   e seta status='free' se ainda estava 'disabled'.
 * - Caso normal: status='free', trialStartedAt=agora,
 *   trialEndsAt=agora+trialDurationDays, cardDeadlineEndsAt=trialEndsAt+7d.
 * - Idempotente: se status ja eh diferente de 'disabled', retorna sem mudar.
 *
 * IMPORTANTE: nao valida quem chamou — caller deve garantir que eh admin
 * da empresa em questao.
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

  // Idempotencia: so age se Platform ainda esta 'disabled'.
  if (existingBilling.platform?.status !== 'disabled') {
    return { started: false, billing: existingBilling };
  }

  const isUnlimited = existingBilling.platform?.freeTrialUnlimited === true;
  const durationDays =
    existingBilling.platform?.trialDurationDays ?? DEFAULT_TRIAL_DURATION_DAYS;
  const now = new Date();

  const updates: Record<string, unknown> = {
    'billing.platform.status': 'free',
    'billing.platform.trialStartedAt': Timestamp.fromDate(now),
    'billing.updatedAt': FieldValue.serverTimestamp(),
  };

  let projectedTrialEndsAt: Date | undefined;
  let projectedCardDeadline: Date | undefined;

  if (isUnlimited) {
    // Free ilimitado: nao seta trialEndsAt nem cardDeadline.
    updates['billing.platform.trialEndsAt'] = FieldValue.delete();
    updates['billing.platform.cardDeadlineEndsAt'] = FieldValue.delete();
  } else {
    const trialEndsAt = computePlatformTrialEndDate(durationDays);
    const cardDeadline = computeCardDeadlineFromTrialEnd(trialEndsAt);
    updates['billing.platform.trialEndsAt'] = Timestamp.fromDate(trialEndsAt);
    updates['billing.platform.cardDeadlineEndsAt'] = Timestamp.fromDate(cardDeadline);
    // Garante trialDurationDays escrito caso seja empresa antiga sem o campo.
    if (existingBilling.platform?.trialDurationDays === undefined) {
      updates['billing.platform.trialDurationDays'] = durationDays;
    }
    projectedTrialEndsAt = trialEndsAt;
    projectedCardDeadline = cardDeadline;
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
