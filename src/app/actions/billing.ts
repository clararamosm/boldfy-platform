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

'use server';

import { requireMaster } from '@/lib/auth-guard';
import {
  applyMasterBillingToggle,
  getCompanyBillingBlock,
  validateMasterToggleInput,
} from '@/lib/billing/master-rules';
import type { CompanyBillingBlock } from '@/lib/billing/types';

export interface BillingActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export interface SerializableBillingBlock {
  enabled: boolean;
  isBetaTester: boolean;
  betaExpiresAtISO: string | null;
  notes: string | null;
  platform: {
    active: boolean;
    seats: number;
    status: string;
    stripeSubscriptionId: string | null;
    firstPaymentDeadlineISO: string | null;
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
  };
  design: {
    active: boolean;
    pack: 'starter' | 'growth' | 'scale' | null;
    status: string;
    stripeSubscriptionId: string | null;
    firstPaymentDeadlineISO: string | null;
  };
  stripeCustomerId: string | null;
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

function serializeBilling(b: CompanyBillingBlock): SerializableBillingBlock {
  return {
    enabled: b.enabled,
    isBetaTester: b.isBetaTester,
    betaExpiresAtISO: toISO(b.betaExpiresAt),
    notes: b.notes ?? null,
    platform: {
      active: b.platform.active,
      seats: b.platform.seats,
      status: b.platform.status,
      stripeSubscriptionId: b.platform.stripeSubscriptionId ?? null,
      firstPaymentDeadlineISO: toISO(b.platform.firstPaymentDeadline),
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
    },
    design: {
      active: b.design.active,
      pack: b.design.pack ?? null,
      status: b.design.status,
      stripeSubscriptionId: b.design.stripeSubscriptionId ?? null,
      firstPaymentDeadlineISO: toISO(b.design.firstPaymentDeadline),
    },
    stripeCustomerId: b.stripeCustomerId ?? null,
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
    return { success: true, data: serializeBilling(block) };
  } catch (e: unknown) {
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao carregar billing.',
    };
  }
}

// ────────────────────────────────────────────────────────────
// WRITE (Master toggle)
// ────────────────────────────────────────────────────────────

export interface MasterToggleBillingFormInput {
  idToken: string;
  companyId: string;
  enabled: boolean;
  isBetaTester: boolean;
  betaExpiresAt: string | null; // ISO string ou null
  notes?: string;
}

export async function updateCompanyBillingToggles(
  input: MasterToggleBillingFormInput,
): Promise<BillingActionResult<SerializableBillingBlock>> {
  try {
    if (!input?.idToken) {
      return { success: false, error: 'Token de autenticacao ausente.' };
    }
    const master = await requireMaster(input.idToken);

    // Delega validacao para camada de regras (zero logica no endpoint)
    const validated = validateMasterToggleInput({
      companyId: input.companyId,
      enabled: input.enabled,
      isBetaTester: input.isBetaTester,
      betaExpiresAt: input.betaExpiresAt,
      notes: input.notes,
    });

    const updated = await applyMasterBillingToggle(validated, master.uid);
    return { success: true, data: serializeBilling(updated) };
  } catch (e: unknown) {
    console.error('[updateCompanyBillingToggles] falhou:', e);
    return {
      success: false,
      error: e instanceof Error ? e.message : 'Erro ao atualizar billing.',
    };
  }
}
