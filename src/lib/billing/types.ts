// src/lib/billing/types.ts
// Tipos compartilhados do sistema de billing modular.
// Seguro importar no cliente (apenas tipos, zero logica).

import type { Timestamp } from 'firebase/firestore';

/**
 * Status de um modulo de billing.
 * - disabled: modulo nao ativado (admin convidado mas nao aceitou ainda, ou TL/Design nao ligado)
 * - free: trial gratuito ativo (Platform default apos admin first login)
 * - pending: trial acabou, aguardando admin cadastrar cartao (7 dias)
 * - active: pagamento realizado, subscription ativa no Stripe
 * - blocked: deadline de cartao venceu, acesso bloqueado
 */
export type BillingModuleStatus = 'disabled' | 'free' | 'pending' | 'active' | 'blocked';

/**
 * Representa um Timestamp que pode vir como:
 * - Firestore Timestamp (client SDK)
 * - Admin SDK Timestamp
 * - string ISO (serializado)
 * - null/undefined
 */
export type MaybeTimestamp =
  | Timestamp
  | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
  | string
  | Date
  | null
  | undefined;

/**
 * Estado do modulo Platform (colaboradores).
 * seats: quantidade atual, minimo 5 quando active, 0 quando disabled.
 */
export interface PlatformBillingState {
  active: boolean;
  seats: number;
  stripeSubscriptionId?: string;
  /** @deprecated use cardDeadlineEndsAt */
  firstPaymentDeadline?: MaybeTimestamp;
  status: BillingModuleStatus;

  // Trial flow (refactor billing-trial-flow)
  /** Duracao do trial em dias (default 15, configuravel pelo Master) */
  trialDurationDays?: number;
  /** Setado quando admin faz primeiro login bem-sucedido */
  trialStartedAt?: MaybeTimestamp;
  /** Calculado: trialStartedAt + trialDurationDays. Ausente se freeTrialUnlimited=true */
  trialEndsAt?: MaybeTimestamp;
  /** Boldfy/parceiros: pula trial countdown, fica em 'free' indefinidamente */
  freeTrialUnlimited?: boolean;
  /** Deadline de 7 dias apos trialEndsAt para cadastrar cartao. Substitui firstPaymentDeadline */
  cardDeadlineEndsAt?: MaybeTimestamp;
}

/**
 * Estado do modulo TL (thought leaders).
 * executives/frequency: usados para calcular preco via matriz.
 * billedOutsidePlatform: caso especial (ex: Omie).
 */
export interface TLBillingState {
  active: boolean;
  seats: number;
  executives: number;
  frequency: 2 | 3 | 4;
  stripeSubscriptionId?: string;
  firstPaymentDeadline?: MaybeTimestamp;
  status: BillingModuleStatus;
  billedOutsidePlatform?: boolean;
}

/**
 * Estado do modulo Design (add-on).
 */
export interface DesignBillingState {
  active: boolean;
  pack?: 'starter' | 'growth' | 'scale';
  stripeSubscriptionId?: string;
  firstPaymentDeadline?: MaybeTimestamp;
  status: BillingModuleStatus;
}

/**
 * Dados fiscais para emissao futura de NFS-e (Fase 5).
 * Por ora apenas coletados; emissao automatica ainda nao implementada.
 */
export interface FiscalData {
  cnpj?: string;
  razaoSocial?: string;
  inscricaoMunicipal?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  lastNFNumber?: string;
  lastNFEmittedAt?: MaybeTimestamp;
}

/**
 * Bloco `billing` completo dentro de `companies/{id}`.
 * So o server pode modificar. Cliente apenas le.
 */
export interface CompanyBillingBlock {
  enabled: boolean;
  isBetaTester: boolean;
  betaExpiresAt?: MaybeTimestamp;
  notes?: string;

  platform: PlatformBillingState;
  tl: TLBillingState;
  design: DesignBillingState;

  stripeCustomerId?: string;
  fiscal?: FiscalData;

  // Beta com timeline propria (refactor billing-trial-flow)
  /** Duracao do beta em meses (default 5). Master configura por empresa */
  betaDurationMonths?: number;
  /** Setado quando platform vira 'active' pela primeira vez */
  betaStartsAt?: MaybeTimestamp;
  /** Calculado: betaStartsAt + betaDurationMonths */
  betaEndsAt?: MaybeTimestamp;

  createdAt?: MaybeTimestamp;
  updatedAt?: MaybeTimestamp;
}

/**
 * Defaults seguros para uma empresa recem-criada.
 * Sem trial, sem beta, sem Stripe. Master liga quando quiser cobrar.
 */
export function getDefaultBillingBlock(): Omit<CompanyBillingBlock, 'createdAt' | 'updatedAt'> {
  return {
    enabled: false,
    isBetaTester: false,
    betaDurationMonths: 5,
    platform: {
      active: false,
      seats: 0,
      status: 'disabled',
      trialDurationDays: 15,
      freeTrialUnlimited: false,
    },
    tl: {
      active: false,
      seats: 0,
      executives: 0,
      frequency: 2,
      status: 'disabled',
    },
    design: {
      active: false,
      status: 'disabled',
    },
  };
}
