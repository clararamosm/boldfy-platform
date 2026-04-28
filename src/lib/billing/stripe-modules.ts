// src/lib/billing/stripe-modules.ts
// Helpers server-only para criar e atualizar subscriptions por modulo
// (Platform / TL / Design). Uma empresa = 1 Customer Stripe + ate 3 subs.
//
// Regras:
// - Toda criacao de Checkout passa por aqui (ou por funcoes deste arquivo).
// - Identificacao de modulo via `subscription.metadata.module`.
// - Precos calculados dinamicamente via price_data (sem IDs hardcoded).
// - Valores em centavos BRL.
//
// Nunca importe este arquivo no cliente.

import 'server-only';

import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { db as adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  PLATFORM_MIN_SEATS,
  calculatePlatformMonthlyPriceCents,
  calculateTLMonthlyPriceCents,
  getDesignPack,
  type DesignPackId,
  type TLFrequency,
} from './pricing';
import {
  type BillingModuleStatus,
  type CompanyBillingBlock,
} from './types';
import { computeFirstPaymentDeadline } from './master-rules';

// ────────────────────────────────────────────────────────────
// TIPOS
// ────────────────────────────────────────────────────────────

export type BillingModule = 'platform' | 'tl' | 'design';

export interface StripeModuleMetadata {
  companyId: string;
  module: BillingModule;
  /** Sempre presente — permite reidratar no webhook. */
  [key: string]: string;
}

export interface CreateCheckoutInput {
  companyId: string;
  adminUid: string;
  adminEmail: string;
  /** Quais modulos entram no checkout. Pelo menos 1. */
  modules: BillingModule[];
  /** Para Platform: seats iniciais (default 5). */
  platformSeats?: number;
  /** Para TL: executivos e frequencia. */
  tlExecutives?: number;
  tlFrequency?: TLFrequency;
  /** Para Design: pack escolhido. */
  designPack?: DesignPackId;
  /** URLs de retorno. */
  successPath?: string;
  cancelPath?: string;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  sessionId: string;
}

// ────────────────────────────────────────────────────────────
// CUSTOMER (1 por empresa)
// ────────────────────────────────────────────────────────────

/**
 * Pega ou cria o Stripe Customer da empresa.
 * Idempotente: se ja existe `billing.stripeCustomerId`, reusa.
 */
export async function getOrCreateStripeCustomer(args: {
  companyId: string;
  companyName: string;
  adminEmail: string;
  adminUid: string;
}): Promise<string> {
  const companyRef = adminDb.collection('companies').doc(args.companyId);
  const snap = await companyRef.get();
  if (!snap.exists) {
    throw new Error(`Empresa ${args.companyId} nao encontrada.`);
  }
  const data = snap.data() ?? {};

  // Preferir billing.stripeCustomerId; fallback no campo legado top-level.
  const existing =
    (data.billing as CompanyBillingBlock | undefined)?.stripeCustomerId ??
    (data.stripeCustomerId as string | undefined);

  if (existing) return existing;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: args.companyName || 'Boldfy Company',
    email: args.adminEmail,
    metadata: {
      companyId: args.companyId,
      firebaseUid: args.adminUid,
    },
  });

  await companyRef.update({
    'billing.stripeCustomerId': customer.id,
    stripeCustomerId: customer.id, // manter campo legado em paridade
    'billing.updatedAt': FieldValue.serverTimestamp(),
  });

  return customer.id;
}

// ────────────────────────────────────────────────────────────
// LINE ITEMS POR MODULO
// ────────────────────────────────────────────────────────────

// Line item do Checkout com price_data dinamico. Tipado estruturalmente
// porque o namespace `Stripe.Checkout.SessionCreateParams.LineItem` nao
// resolve bem em algumas versoes da SDK. A Stripe valida o payload final.
interface CheckoutLineItem {
  price_data: {
    currency: string;
    unit_amount: number;
    recurring: { interval: 'month' | 'year' | 'week' | 'day' };
    product_data: {
      name: string;
      description?: string;
    };
  };
  quantity: number;
}

interface ModuleLineItem {
  lineItem: CheckoutLineItem;
  subscriptionMetadata: StripeModuleMetadata;
}

/**
 * Constroi line item e metadata para o modulo Platform.
 * @throws se seats < PLATFORM_MIN_SEATS ou sem tier.
 */
function buildPlatformLineItem(args: {
  companyId: string;
  seats: number;
  isBeta: boolean;
}): ModuleLineItem {
  const seats = Math.max(args.seats, PLATFORM_MIN_SEATS);
  const calc = calculatePlatformMonthlyPriceCents(seats, args.isBeta);
  if (!calc) {
    throw new Error(
      `Seats invalidos para Platform (${seats}). Contate Master para enterprise.`,
    );
  }
  const perSeat = Math.round(calc.totalCents / seats);

  return {
    lineItem: {
      price_data: {
        currency: 'brl',
        unit_amount: perSeat,
        recurring: { interval: 'month' },
        product_data: {
          name: `Boldfy Platform — ${seats} licencas (${calc.tier.name})`,
          description: args.isBeta
            ? `${seats} colaboradores (beta -30%)`
            : `${seats} colaboradores`,
        },
      },
      quantity: seats,
    },
    subscriptionMetadata: {
      companyId: args.companyId,
      module: 'platform',
      seats: String(seats),
      tier: calc.tier.name,
      isBeta: String(!!args.isBeta),
    },
  };
}

/**
 * Constroi line item e metadata para o modulo TL.
 * TL usa matriz (exec x freq), sem beta.
 */
function buildTLLineItem(args: {
  companyId: string;
  executives: number;
  frequency: TLFrequency;
}): ModuleLineItem {
  const totalCents = calculateTLMonthlyPriceCents(args.executives, args.frequency);
  if (totalCents == null) {
    throw new Error(
      `Combinacao invalida para TL (${args.executives} exec / ${args.frequency} posts sem). Acima de 5 exec = enterprise.`,
    );
  }

  return {
    lineItem: {
      price_data: {
        currency: 'brl',
        unit_amount: totalCents,
        recurring: { interval: 'month' },
        product_data: {
          name: `Boldfy Thought Leaders — ${args.executives} exec x ${args.frequency} posts/sem`,
          description: 'Content Full-Service para Thought Leaders',
        },
      },
      quantity: 1, // TL e pacote fixo, nao per-seat
    },
    subscriptionMetadata: {
      companyId: args.companyId,
      module: 'tl',
      executives: String(args.executives),
      frequency: String(args.frequency),
    },
  };
}

/**
 * Constroi line item e metadata para o modulo Design.
 */
function buildDesignLineItem(args: {
  companyId: string;
  pack: DesignPackId;
}): ModuleLineItem {
  const pack = getDesignPack(args.pack);
  if (!pack) {
    throw new Error(`Pack Design invalido: ${args.pack}`);
  }

  return {
    lineItem: {
      price_data: {
        currency: 'brl',
        unit_amount: pack.priceCents,
        recurring: { interval: 'month' },
        product_data: {
          name: `Boldfy Design — Pack ${pack.label}`,
          description: `${pack.piecesPerMonth} pecas por mes`,
        },
      },
      quantity: 1,
    },
    subscriptionMetadata: {
      companyId: args.companyId,
      module: 'design',
      pack: pack.id,
    },
  };
}

// ────────────────────────────────────────────────────────────
// CHECKOUT SESSION UNICO (multi-modulo)
// ────────────────────────────────────────────────────────────

/**
 * Cria uma sessao de Checkout com um OU MAIS modulos.
 *
 * Regra: Stripe Checkout com line_items de price_data diferentes gera
 * 1 Subscription unica, NAO multiplas. Por isso, aqui usamos a abordagem:
 *   - Se vier 1 modulo: Checkout normal + metadata do modulo.
 *   - Se vier >1 modulo: criamos subscriptions separadas via flow de
 *     "1 Checkout por modulo" mas com um merge do primeiro pagamento
 *     (cada Checkout tem seu success_url).
 *
 * Para V2 simplificamos: retornamos o Checkout do PRIMEIRO modulo. Os
 * demais modulos sao ativados via /billing/activate-module em server
 * action separada apos ter billing ativo (fase posterior).
 *
 * TODO Fase 2.1: implementar verdadeiro "checkout combinado" criando
 * sub inicial invoiced com multiplos items OU usando SetupIntent +
 * criacao manual de 2-3 subs back-to-back.
 */
export async function createModuleCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  if (!input.modules || input.modules.length === 0) {
    throw new Error('Nenhum modulo selecionado para checkout.');
  }

  // Por ora (Fase 2 inicial) tratamos 1 modulo por chamada. Multi-modulo
  // sera um refinamento futuro. Garantimos consistencia travando isso.
  if (input.modules.length > 1) {
    throw new Error(
      'Multi-modulo em um unico Checkout ainda nao suportado. Ative 1 modulo por vez.',
    );
  }
  const moduleKey = input.modules[0];

  // Ler empresa para beta flag + customer id
  const companyRef = adminDb.collection('companies').doc(input.companyId);
  const snap = await companyRef.get();
  if (!snap.exists) {
    throw new Error(`Empresa ${input.companyId} nao encontrada.`);
  }
  const data = snap.data() ?? {};
  const companyName = (data.companyName as string | undefined) ?? 'Boldfy Company';
  const billing = (data.billing as CompanyBillingBlock | undefined);
  if (!billing) {
    throw new Error(
      `Empresa ${input.companyId} sem bloco de billing. Contate o suporte.`,
    );
  }
  const isBeta = billing.isBetaTester === true;

  const customerId = await getOrCreateStripeCustomer({
    companyId: input.companyId,
    companyName,
    adminEmail: input.adminEmail,
    adminUid: input.adminUid,
  });

  // Montar line item do modulo
  let moduleLineItem: ModuleLineItem;
  switch (moduleKey) {
    case 'platform': {
      const seats = input.platformSeats ?? PLATFORM_MIN_SEATS;
      moduleLineItem = buildPlatformLineItem({
        companyId: input.companyId,
        seats,
        isBeta,
      });
      break;
    }
    case 'tl': {
      const executives = input.tlExecutives ?? 0;
      const frequency = (input.tlFrequency ?? 2) as TLFrequency;
      if (executives < 1) {
        throw new Error('Informe numero de executivos para TL.');
      }
      moduleLineItem = buildTLLineItem({
        companyId: input.companyId,
        executives,
        frequency,
      });
      break;
    }
    case 'design': {
      if (!input.designPack) {
        throw new Error('Informe pack de Design.');
      }
      // Design so pode ser ativado se Platform ja esta active
      if (billing.platform.status !== 'active') {
        throw new Error(
          'Design requer Platform ativo. Ative e pague Platform primeiro.',
        );
      }
      moduleLineItem = buildDesignLineItem({
        companyId: input.companyId,
        pack: input.designPack,
      });
      break;
    }
    default:
      throw new Error(`Modulo desconhecido: ${moduleKey}`);
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const successPath = input.successPath || `/admin/configuracoes/billing?checkout=success&module=${moduleKey}`;
  const cancelPath = input.cancelPath || `/admin/configuracoes/billing?checkout=cancelled&module=${moduleKey}`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [moduleLineItem.lineItem],
    subscription_data: {
      metadata: moduleLineItem.subscriptionMetadata,
    },
    metadata: {
      companyId: input.companyId,
      module: moduleKey,
      firebaseUid: input.adminUid,
    },
    success_url: `${baseUrl}${successPath}${successPath.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    locale: 'pt-BR',
    allow_promotion_codes: false, // descontos vem do beta toggle, nao de codes
    tax_id_collection: { enabled: true }, // coleta CNPJ (Fase 5 fiscal)
    billing_address_collection: 'required',
  });

  if (!session.url) {
    throw new Error('Stripe nao retornou URL do Checkout.');
  }

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

// ────────────────────────────────────────────────────────────
// PERSISTENCIA DO ESTADO DO MODULO
// ────────────────────────────────────────────────────────────

/**
 * Marca um modulo como 'pending' (aguardando primeiro pagamento).
 * Chamado ANTES do redirect para Checkout. Se o admin nao pagar em 7 dias,
 * cron marca como 'blocked'.
 */
export async function markModuleAsPending(args: {
  companyId: string;
  module: BillingModule;
  deadline?: Date;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const deadline = args.deadline ?? computeFirstPaymentDeadline();
  const companyRef = adminDb.collection('companies').doc(args.companyId);

  const updates: Record<string, unknown> = {
    [`billing.${args.module}.active`]: true,
    [`billing.${args.module}.status`]: 'pending' satisfies BillingModuleStatus,
    [`billing.${args.module}.firstPaymentDeadline`]: Timestamp.fromDate(deadline),
    'billing.updatedAt': FieldValue.serverTimestamp(),
  };

  if (args.extra) {
    for (const [k, v] of Object.entries(args.extra)) {
      updates[`billing.${args.module}.${k}`] = v;
    }
  }

  await companyRef.update(updates);
}

/**
 * Marca um modulo como 'active' (webhook confirmou primeiro pagamento).
 */
export async function markModuleAsActive(args: {
  companyId: string;
  module: BillingModule;
  stripeSubscriptionId: string;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const companyRef = adminDb.collection('companies').doc(args.companyId);
  const updates: Record<string, unknown> = {
    [`billing.${args.module}.active`]: true,
    [`billing.${args.module}.status`]: 'active' satisfies BillingModuleStatus,
    [`billing.${args.module}.stripeSubscriptionId`]: args.stripeSubscriptionId,
    [`billing.${args.module}.firstPaymentDeadline`]: FieldValue.delete(),
    'billing.updatedAt': FieldValue.serverTimestamp(),
  };
  if (args.extra) {
    for (const [k, v] of Object.entries(args.extra)) {
      updates[`billing.${args.module}.${k}`] = v;
    }
  }
  await companyRef.update(updates);
}

/**
 * Marca um modulo como 'blocked' (prazo vencido sem pagamento OU cancelado).
 */
export async function markModuleAsBlocked(args: {
  companyId: string;
  module: BillingModule;
  reason: 'deadline_expired' | 'canceled' | 'payment_failed';
}): Promise<void> {
  const companyRef = adminDb.collection('companies').doc(args.companyId);
  await companyRef.update({
    [`billing.${args.module}.status`]: 'blocked' satisfies BillingModuleStatus,
    [`billing.${args.module}.blockedReason`]: args.reason,
    [`billing.${args.module}.blockedAt`]: FieldValue.serverTimestamp(),
    'billing.updatedAt': FieldValue.serverTimestamp(),
  });
}

/**
 * Recupera companyId + module a partir de metadata de uma subscription Stripe.
 * Falha gracefully se metadata incompleta.
 */
export function extractModuleFromSubscriptionMetadata(
  metadata: Stripe.Metadata | null | undefined,
): { companyId: string; module: BillingModule } | null {
  if (!metadata) return null;
  const companyId = metadata.companyId;
  const moduleKey = metadata.module as BillingModule | undefined;
  if (!companyId || !moduleKey) return null;
  if (moduleKey !== 'platform' && moduleKey !== 'tl' && moduleKey !== 'design') {
    return null;
  }
  return { companyId, module: moduleKey };
}
