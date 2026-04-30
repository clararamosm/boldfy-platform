// src/app/actions/billing.ts
// Server actions do sistema de billing.
// TODAS as regras de negocio vivem em src/lib/billing/master-rules.ts.
// Este arquivo e apenas o "endpoint" que o front chama.
//
// Principios:
// - Qualquer alteracao em campos sensiveis (billing.*) passa por aqui
//   e valida idToken + role via auth-guard.
// - Nao expor objetos do Firestore diretamente; normalizar antes.
// - Front recebe apenas dados serializaveis.
//
// NOTA: Antigo flag billing.enabled foi REMOVIDO. Toda empresa entra
// no fluxo de cobranca; a unica forma de nao pagar e o toggle nativo
// "Parceiro Boldfy" (freeTrialUnlimited).

'use server';

import { requireAdmin, requireMaster } from '@/lib/auth-guard';
import { db as adminDb } from '@/lib/firebase-admin';
import {
  applyMasterTrialSetup,
  applySaveMasterBilling,
  applyAdminFirstLogin,
  applyToggleFreeUnlimited,
  applyTLBilledOutsidePlatform,
  computeFirstPaymentDeadline,
  getCompanyBillingBlock,
  validateMasterTrialSetupInput,
  validateSaveMasterBillingInput,
  validateToggleFreeUnlimitedInput,
  validateTLBilledOutsidePlatformInput,
  type ValidTrialDurationDays,
  type SaveMasterBillingInput,
} from '@/lib/billing/master-rules';
import {
  createModuleCheckoutSession,
  markModuleAsPending,
  type BillingModule,
} from '@/lib/billing/stripe-modules';
import { resyncPlatformSeats } from '@/lib/billing/seat-management';
import { computeBillingWarnings, type BillingWarning } from '@/lib/billing/warnings';
import type { CompanyBillingBlock } from '@/lib/billing/types';
import type { ActivityLogEntry } from '@/lib/billing/activity-log-types';
import { appendActivityLog } from '@/lib/billing/activity-log';
import {
  calculatePlatformMonthlyPriceCents,
  calculateTLMonthlyPriceCents,
  getDesignPack,
  PLATFORM_MIN_SEATS,
  PLATFORM_ENTERPRISE_THRESHOLD,
  type DesignPackId,
  type TLFrequency,
} from '@/lib/billing/pricing';

export interface BillingActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Marca o tipo de cobranca de um modulo no momento atual. Usado pela UI
 * pra escolher qual badge/tag mostrar no Status dos Modulos.
 *   - 'free'      => Parceiro Boldfy (sem cobranca, permanente)
 *   - 'trial'     => Em teste gratuito (status='free' nao-permanente)
 *   - 'beta'      => Pagando com 30% de desconto
 *   - 'paid'      => Pagando preco cheio
 *   - 'external'  => TL cobrado fora da plataforma (contrato direto)
 *   - 'pending'   => Em pending/blocked (sem cobranca recorrente ainda)
 *   - 'inactive'  => Modulo nunca foi ativado
 */
export type BillingChargeType =
  | 'free'
  | 'trial'
  | 'beta'
  | 'paid'
  | 'external'
  | 'pending'
  | 'inactive';

/**
 * Informacao computada de uso real do modulo Platform. Vem da contagem
 * real de users com role='colaborador' na empresa, nao do snapshot do billing.
 */
export interface PlatformUsageInfo {
  /** Numero real de colaboradores no Firestore (count de users). */
  collaboratorsCount: number;
  /** Seats efetivamente cobrados (max(collabsCount, 5)). */
  billedSeats: number;
  /** True se a empresa esta no minimo (5 seats por menos colabs). */
  atMinimum: boolean;
  /** Preco por seat (em centavos), ja com desconto beta se aplicavel. */
  perSeatCents: number | null;
  /** Preco total mensal (em centavos), perSeat * billedSeats. */
  totalCents: number | null;
  /** Tipo de cobranca atual (free/trial/beta/paid/inactive). */
  chargeType: BillingChargeType;
}

/** Informacao computada de uso real do modulo TL. */
export interface TLUsageInfo {
  /** Numero real de users com role='thoughtleader'. */
  thoughtLeadersCount: number;
  /** Preco total mensal (em centavos), com base em executives + frequency. */
  totalCents: number | null;
  /** Tipo de cobranca atual (external/paid/inactive). */
  chargeType: BillingChargeType;
}

/** Informacao computada de uso real do modulo Design. */
export interface DesignUsageInfo {
  /** Pack contratado (label legivel) ou null. */
  packLabel: string | null;
  /** Preco total mensal (em centavos). */
  totalCents: number | null;
  /** Tipo de cobranca atual (paid/inactive). */
  chargeType: BillingChargeType;
}

export interface SerializableBillingBlock {
  isBetaTester: boolean;
  betaExpiresAtISO: string | null;
  betaStartsAtISO: string | null;
  betaEndsAtISO: string | null;
  betaDurationMonths: number | null;
  notes: string | null;
  platform: {
    active: boolean;
    seats: number;
    status: string;
    stripeSubscriptionId: string | null;
    firstPaymentDeadlineISO: string | null;
    trialDurationDays: number | null;
    freeTrialUnlimited: boolean;
    trialStartedAtISO: string | null;
    trialEndsAtISO: string | null;
    cardDeadlineEndsAtISO: string | null;
    /** Calculado em runtime — nao persistido. */
    usage: PlatformUsageInfo;
  };
  tl: {
    active: boolean;
    seats: number;
    executives: number;
    frequency: 2 | 3 | 4;
    status: string;
    stripeSubscriptionId: string | null;
    firstPaymentDeadlineISO: string | null;
    billedOutsidePlatform: boolean;
    /** Calculado em runtime — nao persistido. */
    usage: TLUsageInfo;
  };
  design: {
    active: boolean;
    pack: 'starter' | 'growth' | 'scale' | null;
    status: string;
    stripeSubscriptionId: string | null;
    firstPaymentDeadlineISO: string | null;
    /** Calculado em runtime — nao persistido. */
    usage: DesignUsageInfo;
  };
  stripeCustomerId: string | null;
  /** Indica que beta esta ativo agora (entre betaStartsAt e betaEndsAt). */
  betaCurrentlyActive: boolean;
}

/** Converte timestamps/undefined do Firestore em tipos JSON-safe para o front. */
function toISO(ts: unknown): string | null {
  if (!ts) return null;
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  if (typeof ts === 'object' && ts !== null) {
    const obj = ts as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
    const seconds = obj._seconds ?? obj.seconds;
    if (typeof seconds === 'number') {
      return new Date(seconds * 1000).toISOString();
    }
  }
  return null;
}

/** Conta usuarios reais por role para uma empresa. */
async function countCompanyUsers(companyId: string): Promise<{
  collaborators: number;
  thoughtLeaders: number;
}> {
  const [collabSnap, tlSnap] = await Promise.all([
    adminDb
      .collection('users')
      .where('companyId', '==', companyId)
      .where('role', '==', 'colaborador')
      .count()
      .get(),
    adminDb
      .collection('users')
      .where('companyId', '==', companyId)
      .where('role', '==', 'thoughtleader')
      .count()
      .get(),
  ]);
  return {
    collaborators: collabSnap.data().count,
    thoughtLeaders: tlSnap.data().count,
  };
}

/** Beta esta efetivamente ativo (entre betaStartsAt e betaEndsAt)? */
function isBetaCurrentlyActive(b: CompanyBillingBlock, now: Date = new Date()): boolean {
  if (b.isBetaTester !== true) return false;
  const start = parseToDate(b.betaStartsAt);
  const end = parseToDate(b.betaEndsAt);
  if (!start) return false;
  if (start.getTime() > now.getTime()) return false;
  if (end && end.getTime() < now.getTime()) return false;
  return true;
}

/** Helper local pra converter timestamps em Date sem alocar string intermediaria. */
function parseToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === 'object' && ts !== null) {
    const obj = ts as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof obj.toDate === 'function') return obj.toDate();
    const seconds = obj._seconds ?? obj.seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return null;
}

/** Computa usage info de Platform (contagem + breakdown monetario + tipo de cobranca). */
function computePlatformUsage(
  b: CompanyBillingBlock,
  collaboratorsCount: number,
  betaActive: boolean,
): PlatformUsageInfo {
  const billedSeats = Math.max(collaboratorsCount, PLATFORM_MIN_SEATS);
  const atMinimum = collaboratorsCount < PLATFORM_MIN_SEATS;

  // Decide tipo de cobranca
  let chargeType: BillingChargeType;
  if (b.platform.freeTrialUnlimited === true) {
    chargeType = 'free';
  } else if (b.platform.status === 'free') {
    chargeType = 'trial';
  } else if (b.platform.status === 'active') {
    chargeType = betaActive ? 'beta' : 'paid';
  } else if (b.platform.status === 'pending' || b.platform.status === 'blocked') {
    chargeType = 'pending';
  } else {
    chargeType = 'inactive';
  }

  // Calcula preco (apenas para tiers suportados; acima de 70 retorna null)
  let perSeatCents: number | null = null;
  let totalCents: number | null = null;
  if (billedSeats <= PLATFORM_ENTERPRISE_THRESHOLD) {
    const calc = calculatePlatformMonthlyPriceCents(billedSeats, betaActive);
    if (calc) {
      totalCents = calc.totalCents;
      perSeatCents = Math.round(calc.totalCents / billedSeats);
    }
  }

  return {
    collaboratorsCount,
    billedSeats,
    atMinimum,
    perSeatCents,
    totalCents,
    chargeType,
  };
}

/** Computa usage info de TL. */
function computeTLUsage(
  b: CompanyBillingBlock,
  thoughtLeadersCount: number,
): TLUsageInfo {
  let chargeType: BillingChargeType;
  if (b.tl.billedOutsidePlatform === true) {
    chargeType = 'external';
  } else if (b.tl.status === 'active') {
    chargeType = 'paid';
  } else if (b.tl.status === 'pending' || b.tl.status === 'blocked') {
    chargeType = 'pending';
  } else {
    chargeType = 'inactive';
  }

  // Cobranca externa nao gera valor visivel na plataforma.
  // Inativo tambem nao tem valor.
  let totalCents: number | null = null;
  if (chargeType === 'paid' && b.tl.executives && b.tl.frequency) {
    totalCents = calculateTLMonthlyPriceCents(b.tl.executives, b.tl.frequency) ?? null;
  }

  return {
    thoughtLeadersCount,
    totalCents,
    chargeType,
  };
}

/** Computa usage info de Design. */
function computeDesignUsage(b: CompanyBillingBlock): DesignUsageInfo {
  let chargeType: BillingChargeType;
  if (b.design.status === 'active') {
    chargeType = 'paid';
  } else if (b.design.status === 'pending' || b.design.status === 'blocked') {
    chargeType = 'pending';
  } else {
    chargeType = 'inactive';
  }

  let packLabel: string | null = null;
  let totalCents: number | null = null;
  if (b.design.pack) {
    const pack = getDesignPack(b.design.pack);
    if (pack) {
      packLabel = pack.label;
      if (chargeType === 'paid') {
        totalCents = pack.priceCents;
      }
    }
  }

  return {
    packLabel,
    totalCents,
    chargeType,
  };
}

/** Atalho: conta usuarios + serializa. Usado por todas as actions. */
async function serializeWithCounts(
  companyId: string,
  b: CompanyBillingBlock,
): Promise<SerializableBillingBlock> {
  const counts = await countCompanyUsers(companyId);
  return serializeBilling(b, counts);
}

/** Serializa o block + enriquece com usage info computado. */
function serializeBilling(
  b: CompanyBillingBlock,
  counts: { collaborators: number; thoughtLeaders: number },
): SerializableBillingBlock {
  const betaActive = isBetaCurrentlyActive(b);
  return {
    isBetaTester: b.isBetaTester,
    betaExpiresAtISO: toISO(b.betaExpiresAt),
    betaStartsAtISO: toISO(b.betaStartsAt),
    betaEndsAtISO: toISO(b.betaEndsAt),
    betaDurationMonths:
      typeof b.betaDurationMonths === 'number' ? b.betaDurationMonths : null,
    notes: b.notes ?? null,
    platform: {
      active: b.platform.active,
      seats: b.platform.seats,
      status: b.platform.status,
      stripeSubscriptionId: b.platform.stripeSubscriptionId ?? null,
      firstPaymentDeadlineISO: toISO(b.platform.firstPaymentDeadline),
      trialDurationDays:
        typeof b.platform.trialDurationDays === 'number'
          ? b.platform.trialDurationDays
          : null,
      freeTrialUnlimited: b.platform.freeTrialUnlimited === true,
      trialStartedAtISO: toISO(b.platform.trialStartedAt),
      trialEndsAtISO: toISO(b.platform.trialEndsAt),
      cardDeadlineEndsAtISO: toISO(b.platform.cardDeadlineEndsAt),
      usage: computePlatformUsage(b, counts.collaborators, betaActive),
    },
    tl: {
      active: b.tl.active,
      seats: b.tl.seats,
      executives: b.tl.executives,
      frequency: b.tl.frequency,
      status: b.tl.status,
      stripeSubscriptionId: b.tl.stripeSubscriptionId ?? null,
      firstPaymentDeadlineISO: toISO(b.tl.firstPaymentDeadline),
      billedOutsidePlatform: b.tl.billedOutsidePlatform === true,
      usage: computeTLUsage(b, counts.thoughtLeaders),
    },
    design: {
      active: b.design.active,
      pack: b.design.pack ?? null,
      status: b.design.status,
      stripeSubscriptionId: b.design.stripeSubscriptionId ?? null,
      firstPaymentDeadlineISO: toISO(b.design.firstPaymentDeadline),
      usage: computeDesignUsage(b),
    },
    stripeCustomerId: b.stripeCustomerId ?? null,
    betaCurrentlyActive: betaActive,
  };
}


// ────────────────────────────────────────────────────────────
// READ
// ────────────────────────────────────────────────────────────

export async function getCompanyBilling(
  idToken: string,
  companyId: string,
): Promise<BillingActionResult<SerializableBillingBlock>> {
  try {
    await requireMaster(idToken);
    if (!companyId || typeof companyId !== 'string') {
      return { success: false, error: 'companyId invalido.' };
    }
    const block = await getCompanyBillingBlock(companyId);
    const data = await serializeWithCounts(companyId, block);
    return { success: true, data };
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao carregar billing.',
    };
  }
}

/**
 * Versao admin: admin so le billing da propria empresa.
 * companyId e inferido do token — nao aceita param para evitar leak cross-tenant.
 */
export async function getMyCompanyBilling(
  idToken: string,
): Promise<BillingActionResult<SerializableBillingBlock>> {
  try {
    if (!idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const admin = await requireAdmin(idToken);
    if (!admin.companyId) {
      return { success: false, error: 'Admin sem empresa vinculada.' };
    }
    const block = await getCompanyBillingBlock(admin.companyId);
    const data = await serializeWithCounts(admin.companyId, block);
    return { success: true, data };
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao carregar billing.',
    };
  }
}
/**
 * Dispara onboarding billing apos primeiro login do admin.
 * Idempotente: so age se Platform ainda esta 'disabled'.
 * Seguro chamar a cada login.
 */
export async function triggerAdminFirstLogin(
  idToken: string,
): Promise<BillingActionResult> {
  try {
    if (!idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const admin = await requireAdmin(idToken);
    if (!admin.companyId) {
      return { success: false, error: 'Admin sem empresa vinculada.' };
    }
    await applyAdminFirstLogin(admin.companyId);
    // Log best-effort: idempotente via uid do admin (1 entry por admin/empresa)
    await appendActivityLog(
      admin.companyId,
      {
        kind: 'admin.first_login',
        actorRole: 'admin',
        actorUid: admin.uid,
        summary: 'Admin acessou a plataforma pela primeira vez',
      },
      { idempotencyKey: admin.uid },
    );
    return { success: true };
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao iniciar onboarding.',
    };
  }
}


// ────────────────────────────────────────────────────────────
// WRITE (Master — Save consolidado: 1 botao para tudo)
// ────────────────────────────────────────────────────────────

export interface SaveMasterBillingFormInput {
  idToken: string;
  companyId: string;
  // Plano Platform
  trialDurationDays: 15 | 30 | 60;
  freeTrialUnlimited: boolean;
  // Beta tester
  isBetaTester: boolean;
  /** Obrigatorio quando isBetaTester=true; ignorado caso contrario */
  betaDurationMonths?: number | null;
  // NOTA: betaStartsAt nao e mais aceito do cliente. O webhook do Stripe
  // (`invoice.paid`) seta automaticamente quando a 1a fatura do Platform e paga.
  // TL cobrado fora da plataforma (contrato direto)
  tlBilledOutsidePlatform: boolean;
  tlExecutives?: number;
  tlFrequency?: 2 | 3 | 4;
  // Notas (opcional)
  notes?: string;
}

/**
 * Aplica TODAS as mudancas do painel master de billing numa unica transacao.
 * Substitui as varias actions individuais que existiam antes.
 *
 * Idempotente: pode ser chamada com os mesmos valores que ja estao no Firestore
 * sem efeito colateral. Internamente, applySaveMasterBilling decide quais
 * sub-regras disparar.
 */
export async function saveMasterBilling(
  input: SaveMasterBillingFormInput,
): Promise<BillingActionResult<SerializableBillingBlock>> {
  try {
    if (!input?.idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const master = await requireMaster(input.idToken);

    const validated: SaveMasterBillingInput = validateSaveMasterBillingInput({
      companyId: input.companyId,
      trialDurationDays: input.trialDurationDays as ValidTrialDurationDays,
      freeTrialUnlimited: input.freeTrialUnlimited,
      isBetaTester: input.isBetaTester,
      betaDurationMonths: input.betaDurationMonths ?? null,
      tlBilledOutsidePlatform: input.tlBilledOutsidePlatform,
      tlExecutives: input.tlExecutives,
      tlFrequency: input.tlFrequency,
      notes: input.notes,
    });

    const updated = await applySaveMasterBilling(validated, master.uid);
    const data = await serializeWithCounts(input.companyId, updated);
    // Log best-effort: cada save = 1 entrada (auto-id, sem idempotencia).
    // Summary descritivo sem expor valores cobrados ou IDs sensiveis.
    await appendActivityLog(input.companyId, {
      kind: 'billing.config_changed',
      actorRole: 'master',
      actorUid: master.uid,
      summary: 'Configuracoes de billing atualizadas pelo master',
    });
    return { success: true, data };
  } catch (e: unknown) {
    console.error('[saveMasterBilling] falhou:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao salvar configuracoes de billing.',
    };
  }
}

// ────────────────────────────────────────────────────────────
// WRITE (Master — TL cobrado fora da plataforma)
// ────────────────────────────────────────────────────────────

export interface SetTLBilledOutsidePlatformInput {
  idToken: string;
  companyId: string;
  enabled: boolean;
  executives?: number;
  frequency?: 2 | 3 | 4;
}

/**
 * Master marca/desmarca TL como "cobrado fora da plataforma".
 * - enabled=true: TL fica active sem cobranca Stripe (exige executives + frequency).
 * - enabled=false: TL volta para disabled, preserva historico (executives/frequency).
 * Nunca toca em stripeSubscriptionId.
 *
 * Mantida para compatibilidade. A nova UI master usa saveMasterBilling.
 */
export async function setTLBilledOutsidePlatform(
  input: SetTLBilledOutsidePlatformInput,
): Promise<BillingActionResult<SerializableBillingBlock>> {
  try {
    if (!input?.idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const master = await requireMaster(input.idToken);
    const validated = validateTLBilledOutsidePlatformInput({
      companyId: input.companyId,
      enabled: input.enabled,
      executives: input.executives,
      frequency: input.frequency,
    });
    const updated = await applyTLBilledOutsidePlatform(validated, master.uid);
    const data = await serializeWithCounts(input.companyId, updated);
    return { success: true, data };
  } catch (e: unknown) {
    console.error('[setTLBilledOutsidePlatform] falhou:', e);
    return {
      success: false,
      error:
        e instanceof Error ? e.message : 'Erro ao atualizar ativacao especial do TL.',
    };
  }
}

// ────────────────────────────────────────────────────────────
// WRITE (Master — Setup do trial Platform)
// ────────────────────────────────────────────────────────────

export interface SetMasterTrialDurationInput {
  idToken: string;
  companyId: string;
  trialDurationDays: 15 | 30 | 60;
}

/**
 * Master configura quanto tempo dura o trial Platform da empresa.
 * Pode ser chamado mesmo apos o trial ja ter iniciado — neste caso,
 * recalcula trialEndsAt = trialStartedAt + novoDurationDays e
 * cardDeadlineEndsAt = trialEndsAt + 7 dias (extensao/reducao do trial).
 *
 * Mantida para compatibilidade. A nova UI master usa saveMasterBilling.
 */
export async function setMasterTrialDuration(
  input: SetMasterTrialDurationInput,
): Promise<BillingActionResult<SerializableBillingBlock>> {
  try {
    if (!input?.idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const master = await requireMaster(input.idToken);
    const validated = validateMasterTrialSetupInput({
      companyId: input.companyId,
      trialDurationDays: input.trialDurationDays as ValidTrialDurationDays,
    });
    const updated = await applyMasterTrialSetup(validated, master.uid);
    const data = await serializeWithCounts(input.companyId, updated);
    return { success: true, data };
  } catch (e: unknown) {
    console.error('[setMasterTrialDuration] falhou:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao configurar duracao do trial.',
    };
  }
}

// ────────────────────────────────────────────────────────────
// WRITE (Master — Free trial unlimited / parceiros como Boldfy)
// ────────────────────────────────────────────────────────────

export interface ToggleFreeTrialUnlimitedInput {
  idToken: string;
  companyId: string;
  enabled: boolean;
}

/**
 * Master liga/desliga "Plataforma free ilimitada" para a empresa.
 * - enabled=true: status='free' permanente, sem trialEndsAt e sem cardDeadline.
 *   Se Platform estava em pending/blocked, e resgatado de volta para 'free'.
 * - enabled=false: volta ao fluxo normal de trial. Recalcula datas a partir
 *   de trialStartedAt + trialDurationDays (se trial ja tinha comecado).
 *
 * Mantida para compatibilidade. A nova UI master usa saveMasterBilling.
 */
export async function toggleFreeTrialUnlimited(
  input: ToggleFreeTrialUnlimitedInput,
): Promise<BillingActionResult<SerializableBillingBlock>> {
  try {
    if (!input?.idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const master = await requireMaster(input.idToken);
    const validated = validateToggleFreeUnlimitedInput({
      companyId: input.companyId,
      enabled: input.enabled,
    });
    const updated = await applyToggleFreeUnlimited(validated, master.uid);
    const data = await serializeWithCounts(input.companyId, updated);
    return { success: true, data };
  } catch (e: unknown) {
    console.error('[toggleFreeTrialUnlimited] falhou:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao alterar free trial ilimitado.',
    };
  }
}

// ────────────────────────────────────────────────────────────
// ADMIN: ativar um modulo e iniciar Checkout
// ────────────────────────────────────────────────────────────

export interface ActivateModuleInput {
  idToken: string;
  module: BillingModule;
  /** Para Platform: seats desejados (opcional — default = colabs atuais ou 5). */
  platformSeats?: number;
  /** Para TL: quantidade de executivos e frequencia. */
  tlExecutives?: number;
  tlFrequency?: TLFrequency;
  /** Para Design: pack escolhido. */
  designPack?: DesignPackId;
}

export interface ActivateModuleResult {
  checkoutUrl: string;
  deadlineISO: string;
}

/**
 * Admin ativa um modulo:
 * 1. Valida que admin pertence a empresa
 * 2. Marca modulo como 'pending' + deadline 7 dias
 * 3. Cria Checkout Stripe e retorna URL
 *
 * O webhook promove para 'active' apos pagamento. Cron bloqueia se passar prazo.
 */
export async function activateBillingModule(
  input: ActivateModuleInput,
): Promise<BillingActionResult<ActivateModuleResult>> {
  try {
    if (!input?.idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const admin = await requireAdmin(input.idToken);
    if (!admin.companyId) {
      return { success: false, error: 'Admin sem empresa vinculada.' };
    }
    if (!admin.email) {
      return { success: false, error: 'Admin sem email.' };
    }
    // Validar modulo
    const moduleKey = input.module;
    if (moduleKey !== 'platform' && moduleKey !== 'tl' && moduleKey !== 'design') {
      return { success: false, error: 'Modulo invalido.' };
    }
    // Ler estado do billing
    const billing = await getCompanyBillingBlock(admin.companyId);
    // Para Platform: resyncar seats antes de ativar, garantindo min 5
    let platformSeats = input.platformSeats;
    if (moduleKey === 'platform') {
      const sync = await resyncPlatformSeats(admin.companyId);
      platformSeats = Math.max(platformSeats ?? sync.newSeats, sync.newSeats);
    }
    // Design requer Platform active — checa aqui tambem pra mensagem melhor
    if (moduleKey === 'design' && billing.platform.status !== 'active') {
      return {
        success: false,
        error: 'Design so pode ser ativado apos Platform estar ativo (pago).',
      };
    }
    const deadline = computeFirstPaymentDeadline();
    // Marcar modulo como pending com dados de config
    const extra: Record<string, unknown> = {};
    if (moduleKey === 'tl') {
      extra.executives = input.tlExecutives ?? 0;
      extra.frequency = input.tlFrequency ?? 2;
    }
    if (moduleKey === 'design') {
      extra.pack = input.designPack;
    }
    if (moduleKey === 'platform') {
      extra.seats = platformSeats;
    }
    await markModuleAsPending({
      companyId: admin.companyId,
      module: moduleKey,
      deadline,
      extra,
    });
    // Criar Checkout
    const result = await createModuleCheckoutSession({
      companyId: admin.companyId,
      adminUid: admin.uid,
      adminEmail: admin.email,
      modules: [moduleKey],
      platformSeats,
      tlExecutives: input.tlExecutives,
      tlFrequency: input.tlFrequency,
      designPack: input.designPack,
    });
    return {
      success: true,
      data: {
        checkoutUrl: result.checkoutUrl,
        deadlineISO: deadline.toISOString(),
      },
    };
  } catch (e: unknown) {
    console.error('[activateBillingModule] falhou:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao ativar modulo.',
    };
  }
}

// ────────────────────────────────────────────────────────────
// ADMIN: simulador de preco (read-only)
// ────────────────────────────────────────────────────────────

export interface SimulatePricingInput {
  idToken: string;
  platform?: {
    seats: number;
  };
  tl?: {
    executives: number;
    frequency: TLFrequency;
  };
  design?: {
    pack: DesignPackId;
  };
}

export interface SimulatedModule {
  valid: boolean;
  /** Preco total mensal do modulo em centavos BRL. */
  totalCents: number;
  /** Para platform: tier aplicado. */
  tierName?: string;
  /** Para platform: preco por seat em centavos. */
  perSeatCents?: number;
  /** Para design: nome do pack. */
  packName?: string;
  /** Mensagem de erro quando valid=false. */
  error?: string;
}

export interface SimulatePricingResult {
  isBetaTester: boolean;
  platform: SimulatedModule | null;
  tl: SimulatedModule | null;
  design: SimulatedModule | null;
  /** Soma mensal de todos os modulos validos, em centavos. */
  grandTotalCents: number;
  /** Limites da tabela de Platform para exibir no UI. */
  platformLimits: {
    min: number;
    max: number;
  };
}

/**
 * Calcula precos para o admin ver no simulador. Nao persiste nada.
 * O flag isBetaTester e lido do Firestore — admin nao escolhe (so Master).
 * Nenhum calculo de preco ocorre no client; tudo passa por aqui.
 */
export async function simulatePricing(
  input: SimulatePricingInput,
): Promise<BillingActionResult<SimulatePricingResult>> {
  try {
    if (!input?.idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const admin = await requireAdmin(input.idToken);
    if (!admin.companyId) {
      return { success: false, error: 'Admin sem empresa vinculada.' };
    }
    const billing = await getCompanyBillingBlock(admin.companyId);
    const isBetaTester = billing.isBetaTester === true;
    let grandTotal = 0;
    // Platform
    let platformResult: SimulatedModule | null = null;
    if (input.platform) {
      const seats = Math.floor(input.platform.seats);
      if (!Number.isFinite(seats) || seats < 1) {
        platformResult = { valid: false, totalCents: 0, error: 'Seats invalidos.' };
      } else {
        const calc = calculatePlatformMonthlyPriceCents(seats, isBetaTester);
        if (!calc) {
          platformResult = {
            valid: false,
            totalCents: 0,
            error:
              seats > PLATFORM_ENTERPRISE_THRESHOLD
                ? 'Acima de 70 licencas e enterprise — fale com o time Boldfy.'
                : `Minimo de ${PLATFORM_MIN_SEATS} licencas.`,
          };
        } else {
          const perSeat = Math.round(calc.totalCents / seats);
          platformResult = {
            valid: true,
            totalCents: calc.totalCents,
            tierName: calc.tier.name,
            perSeatCents: perSeat,
          };
          grandTotal += calc.totalCents;
        }
      }
    }
    // TL
    let tlResult: SimulatedModule | null = null;
    if (input.tl) {
      const execs = Math.floor(input.tl.executives);
      const freq = input.tl.frequency;
      const totalCents = calculateTLMonthlyPriceCents(execs, freq);
      if (totalCents == null) {
        tlResult = {
          valid: false,
          totalCents: 0,
          error:
            execs > 5
              ? 'Acima de 5 executivos e enterprise — fale com o time Boldfy.'
              : 'Combinacao invalida de executivos e frequencia.',
        };
      } else {
        tlResult = { valid: true, totalCents };
        grandTotal += totalCents;
      }
    }
    // Design
    let designResult: SimulatedModule | null = null;
    if (input.design) {
      const pack = getDesignPack(input.design.pack);
      if (!pack) {
        designResult = { valid: false, totalCents: 0, error: 'Pack invalido.' };
      } else {
        designResult = { valid: true, totalCents: pack.priceCents, packName: pack.label };
        grandTotal += pack.priceCents;
      }
    }
    return {
      success: true,
      data: {
        isBetaTester,
        platform: platformResult,
        tl: tlResult,
        design: designResult,
        grandTotalCents: grandTotal,
        platformLimits: {
          min: PLATFORM_MIN_SEATS,
          max: PLATFORM_ENTERPRISE_THRESHOLD,
        },
      },
    };
  } catch (e: unknown) {
    console.error('[simulatePricing] falhou:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao simular precos.',
    };
  }
}

// ────────────────────────────────────────────────────────────
// ADMIN: warnings de billing (banners/notificacoes)
// ────────────────────────────────────────────────────────────

export interface GetBillingWarningsResult {
  warnings: BillingWarning[];
  /** Timestamp de quando foi gerado (server). Client pode exibir "atualizado ha X". */
  generatedAtISO: string;
}

/**
 * Retorna lista de warnings ativos para a empresa do admin.
 * - companyId inferido do token (sem cross-tenant).
 * - Ordem: critical > warning > info.
 * - Client apenas renderiza; nao decide severidade.
 *
 * Use em loops de polling no AdminLayout. Sugestao: refetch a cada 5 min.
 */
export async function getBillingWarnings(
  idToken: string,
): Promise<BillingActionResult<GetBillingWarningsResult>> {
  try {
    if (!idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const admin = await requireAdmin(idToken);
    if (!admin.companyId) {
      return { success: false, error: 'Admin sem empresa vinculada.' };
    }
    const billing = await getCompanyBillingBlock(admin.companyId);
    const warnings = computeBillingWarnings(billing);
    return {
      success: true,
      data: {
        warnings,
        generatedAtISO: new Date().toISOString(),
      },
    };
  } catch (e: unknown) {
    console.error('[getBillingWarnings] falhou:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao carregar avisos.',
    };
  }
}

// ────────────────────────────────────────────────────────────
// MASTER: Activity Log da empresa (read-only)
// ────────────────────────────────────────────────────────────

export interface GetCompanyActivityLogOptions {
  /** Quantos itens trazer. Default 50, max 100. */
  limit?: number;
  /** ISO string do `ts` do ultimo item da pagina anterior. Usado em startAfter(). */
  cursorTs?: string;
}

export interface GetCompanyActivityLogResult {
  entries: ActivityLogEntry[];
  hasMore: boolean;
}

const ACTIVITY_LOG_DEFAULT_LIMIT = 50;
const ACTIVITY_LOG_MAX_LIMIT = 100;

/**
 * Master le a activity log de uma empresa, ordenada por ts desc.
 *
 * Compliance: campos como `redactedDetails` (se existirem no doc) sao strippados
 * automaticamente pela tipagem — o ActivityLogEntry exposto so tem os campos
 * publicos (id, ts, kind, actorRole, actorUid, summary).
 *
 * Quando a colecao esta vazia (empresa antiga, sem nenhum log gerado pos-deploy),
 * retorna 1 entrada sintetica 'system.log_started' calculada em runtime — nao
 * persiste nada. Isso evita backfill artificial e da contexto pro master.
 */
export async function getCompanyActivityLog(
  idToken: string,
  companyId: string,
  opts?: GetCompanyActivityLogOptions,
): Promise<BillingActionResult<GetCompanyActivityLogResult>> {
  try {
    if (!idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    await requireMaster(idToken);
    if (!companyId || typeof companyId !== 'string') {
      return { success: false, error: 'companyId invalido.' };
    }

    const requested = Math.floor(opts?.limit ?? ACTIVITY_LOG_DEFAULT_LIMIT);
    const limit = Math.max(1, Math.min(requested, ACTIVITY_LOG_MAX_LIMIT));

    let query = adminDb
      .collection('companies')
      .doc(companyId)
      .collection('activityLog')
      .orderBy('ts', 'desc')
      .limit(limit + 1); // +1 pra detectar hasMore sem segundo round-trip

    if (opts?.cursorTs) {
      const cursorDate = new Date(opts.cursorTs);
      if (!Number.isNaN(cursorDate.getTime())) {
        query = query.startAfter(cursorDate);
      }
    }

    const snap = await query.get();

    // Empresa sem log algum: devolve placeholder sintetico (nao persiste).
    if (snap.empty && !opts?.cursorTs) {
      const placeholder: ActivityLogEntry = {
        id: 'synthetic_log_started',
        ts: new Date().toISOString(),
        kind: 'system.log_started',
        actorRole: 'system',
        actorUid: null,
        summary: 'Histórico de atividades iniciado.',
      };
      return {
        success: true,
        data: { entries: [placeholder], hasMore: false },
      };
    }

    const docs = snap.docs;
    const hasMore = docs.length > limit;
    const sliced = hasMore ? docs.slice(0, limit) : docs;

    const entries: ActivityLogEntry[] = sliced.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ts: toISO(data.ts) ?? new Date(0).toISOString(),
        kind: data.kind,
        actorRole: data.actorRole,
        actorUid: data.actorUid ?? null,
        summary: typeof data.summary === 'string' ? data.summary : '',
      };
    });

    return { success: true, data: { entries, hasMore } };
  } catch (e: unknown) {
    console.error('[getCompanyActivityLog] falhou:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao carregar histórico.',
    };
  }
}
