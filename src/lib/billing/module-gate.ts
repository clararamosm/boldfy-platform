// src/lib/billing/module-gate.ts
// Gate granular por modulo de billing (Platform / TL / Design).
// server-only: NUNCA importe no cliente.
//
// Use em server actions e route handlers que executam acoes vinculadas
// a um modulo especifico. Exemplo:
//
//   await requireActiveModule(user, 'tl');
//   // ... logica de criar post de TL, agendar, publicar etc.
//
// Regras:
// - Master e strategist sao isentos (eles nao pagam — sao internos).
// - Se a empresa e beta tester COM data de expiracao futura, acesso liberado
//   a todos os modulos (cortesia).
// - Beta SEM data de expiracao: tambem liberado (beta permanente).
// - Beta com data VENCIDA: segue regras normais (nao ha bypass).
// - Se billing inteiro ausente:
//     graceLegacy + subscription legacy ativa => libera (legacy-subscription)
//     caso contrario => bloqueia.
// - Se o modulo esta 'free': OK (trial gratuito, com ou sem deadline).
// - Se o modulo esta 'active': OK.
// - Se o modulo esta 'pending' e deadline ainda nao venceu: OK (periodo de gracia).
// - Caso contrario: bloqueia.
//
// NOTA: Antigo flag billing.enabled foi REMOVIDO. Toda empresa entra no
// fluxo de cobranca por padrao; a unica forma de nao pagar e o toggle
// nativo "Parceiro Boldfy" (freeTrialUnlimited) configurado pelo master.

import 'server-only';

import { db as adminDb } from '@/lib/firebase-admin';
import type { AuthUser } from '@/lib/auth-guard';
import type { BillingModule } from './stripe-modules';
import type { CompanyBillingBlock, MaybeTimestamp } from './types';
import { isModuleBlocked } from './master-rules';

export type ModuleGateDecision =
  | { allowed: true; reason: 'beta' | 'active' | 'pending-grace' | 'internal-role' | 'legacy-subscription' | 'free-trial' }
  | { allowed: false; reason: 'no-company' | 'no-billing' | 'module-disabled' | 'module-blocked' | 'pending-expired' | 'no-billing-no-legacy'; message: string };

/**
 * Status de assinatura legacy que contam como "ativa" para o fallback.
 * Mantem paridade com requireActiveSubscription em auth-guard.ts.
 */
const LEGACY_ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

/** Forma minima do bloco subscription legacy do Firestore. */
export interface LegacySubscriptionShape {
  status?: string;
  plan?: string;
}

/** Verifica se a subscription legacy conta como ativa para fallback. */
function isLegacySubscriptionActive(sub: LegacySubscriptionShape | undefined): boolean {
  if (!sub || typeof sub.status !== 'string') return false;
  return LEGACY_ACTIVE_STATUSES.has(sub.status);
}

function toDate(v: MaybeTimestamp): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const p = new Date(v);
    return Number.isNaN(p.getTime()) ? null : p;
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

function moduleState(billing: CompanyBillingBlock, module: BillingModule) {
  if (module === 'platform') {
    // Novo fluxo: cardDeadlineEndsAt tem prioridade. Fallback para firstPaymentDeadline (legado).
    const deadline = toDate(billing.platform.cardDeadlineEndsAt) ?? toDate(billing.platform.firstPaymentDeadline);
    return {
      status: billing.platform.status,
      deadline,
    };
  }
  if (module === 'tl') {
    // Caso especial: TL pode ser cobrado fora da plataforma (contrato direto).
    if (billing.tl.billedOutsidePlatform === true) {
      // Trata como 'active' — a empresa ja paga por outro canal.
      return { status: 'active' as const, deadline: null, outsidePlatform: true };
    }
    return {
      status: billing.tl.status,
      deadline: toDate(billing.tl.firstPaymentDeadline),
    };
  }
  return {
    status: billing.design.status,
    deadline: toDate(billing.design.firstPaymentDeadline),
  };
}

const MODULE_LABEL_PT: Record<BillingModule, string> = {
  platform: 'Plataforma',
  tl: 'Thought Leaders',
  design: 'Design',
};

export interface EvaluateModuleAccessOptions {
  /**
   * Se true, quando billing novo nao estiver configurado,
   * cai para o sistema antigo (`company.subscription.status`). Isso permite
   * coexistir com empresas ainda nao migradas para o billing modular.
   * Default: false (estrito).
   */
  graceLegacy?: boolean;
  /**
   * Subscription legacy ja lida do Firestore. Obrigatoria quando graceLegacy=true;
   * ignorada caso contrario.
   */
  legacySubscription?: LegacySubscriptionShape;
  /** Data de referencia (injetavel para testes). */
  now?: Date;
}

/**
 * Versao pura, sem I/O: recebe billing ja lido + contexto.
 * Facil de testar; nao faz round trip de Firestore.
 *
 * Ordem de decisao:
 * 1. Beta tester com tempo restante => allow (cortesia).
 * 2. billing ausente:
 *      se graceLegacy && subscription legacy ativa => allow (legacy-subscription)
 *      caso contrario => deny (no-billing-no-legacy | no-billing)
 * 3. Estado do modulo:
 *      free => allow (trial gratuito)
 *      active => allow
 *      pending com deadline no futuro => allow (pending-grace)
 *      pending com deadline vencido => deny (pending-expired)
 *      blocked => deny
 *      disabled => deny (com fallback legacy se graceLegacy)
 */
export function evaluateModuleAccess(
  billing: CompanyBillingBlock | null,
  module: BillingModule,
  options: EvaluateModuleAccessOptions = {},
): ModuleGateDecision {
  const now = options.now ?? new Date();
  const graceLegacy = options.graceLegacy === true;
  const label = MODULE_LABEL_PT[module];

  // Helper pra aplicar fallback legacy sem duplicar codigo.
  const legacyAllowIfActive = (): ModuleGateDecision | null => {
    if (!graceLegacy) return null;
    if (isLegacySubscriptionActive(options.legacySubscription)) {
      return { allowed: true, reason: 'legacy-subscription' };
    }
    return null;
  };

  if (!billing) {
    const legacy = legacyAllowIfActive();
    if (legacy) return legacy;
    return {
      allowed: false,
      reason: graceLegacy ? 'no-billing-no-legacy' : 'no-billing',
      message: 'Empresa sem configuracao de cobranca.',
    };
  }

  // Beta tester — cortesia, vence beta e modulo ao mesmo tempo se estiver ativo.
  // Le betaEndsAt (canonico) com fallback para betaExpiresAt (deprecated) por retrocompat.
  if (billing.isBetaTester === true) {
    const betaEnd = toDate(billing.betaEndsAt) ?? toDate(billing.betaExpiresAt);
    if (!betaEnd || betaEnd.getTime() > now.getTime()) {
      return { allowed: true, reason: 'beta' };
    }
    // Beta expirado: cai nas regras normais abaixo.
  }

  const state = moduleState(billing, module);

  // Trial gratuito ativo (Platform default apos admin first login).
  // Allow independente de deadline — cron 'check-trial-expiration' transiciona para 'pending'.
  if (state.status === 'free') {
    return { allowed: true, reason: 'free-trial' };
  }

  if (state.status === 'active') {
    return { allowed: true, reason: 'active' };
  }

  if (state.status === 'blocked') {
    return {
      allowed: false,
      reason: 'module-blocked',
      message: `Modulo ${label} bloqueado. Regularize o pagamento para restabelecer o acesso.`,
    };
  }

  if (state.status === 'pending') {
    const blocked = isModuleBlocked(state.status, state.deadline);
    if (blocked) {
      return {
        allowed: false,
        reason: 'pending-expired',
        message: `Prazo de pagamento do modulo ${label} expirou. Finalize a cobranca.`,
      };
    }
    return { allowed: true, reason: 'pending-grace' };
  }

  // disabled: tenta legacy como ultima chance.
  const legacy = legacyAllowIfActive();
  if (legacy) return legacy;

  return {
    allowed: false,
    reason: 'module-disabled',
    message: `Modulo ${label} nao esta ativo nesta empresa. Ative em Planos e cobranca.`,
  };
}

export interface RequireActiveModuleOptions {
  /**
   * Se true, empresas sem billing modular configurado caem para o sistema
   * antigo (`company.subscription.status in {active, trialing, past_due}`).
   * Use durante a transicao. Default: true — maximo de compatibilidade.
   */
  graceLegacy?: boolean;
}

/**
 * Versao I/O: le Firestore e decide. Use direto em server actions.
 *
 * Comportamento padrao (graceLegacy=true):
 * - Empresas com billing modular ativo: regras novas aplicam.
 * - Empresas sem billing modular mas com subscription legacy ativa: libera.
 * - Empresas sem nenhum dos dois: bloqueia.
 *
 * Para tornar o gate estrito (recusar legacy), passe { graceLegacy: false }.
 *
 * @param user  Resultado de requireAdmin / requireAuth / requireAdminOrStrategist.
 * @param module Qual modulo a acao exige.
 * @throws Error quando nao autorizado. Masters e strategists passam direto.
 */
export async function requireActiveModule(
  user: AuthUser,
  module: BillingModule,
  options: RequireActiveModuleOptions = {},
): Promise<void> {
  // Roles internos nao pagam. Liberados.
  if (user.role === 'master' || user.role === 'strategist') return;

  if (!user.companyId) {
    throw new Error('Usuario sem empresa vinculada.');
  }

  const graceLegacy = options.graceLegacy !== false; // default true
  const snap = await adminDb.collection('companies').doc(user.companyId).get();
  if (!snap.exists) {
    throw new Error('Empresa nao encontrada.');
  }

  const data = snap.data() ?? {};
  const billing = (data.billing as CompanyBillingBlock | undefined) ?? null;
  const legacySubscription = graceLegacy
    ? (data.subscription as LegacySubscriptionShape | undefined)
    : undefined;

  const decision = evaluateModuleAccess(billing, module, {
    graceLegacy,
    legacySubscription,
  });

  if (!decision.allowed) {
    throw new Error(decision.message);
  }
}

/**
 * Mapeia o role do user para o modulo de billing correspondente.
 * - thoughtleader => 'tl'
 * - admin, colaborador => 'platform'
 * - master, strategist => null (internos, nao pagam)
 * - outros => null (nao gatea)
 */
export function moduleFromRole(role: string | undefined): BillingModule | null {
  if (!role) return null;
  if (role === 'thoughtleader') return 'tl';
  if (role === 'admin' || role === 'colaborador') return 'platform';
  return null;
}

/**
 * Gate automatico: decide o modulo pelo role do user. Conveniente para
 * actions compartilhadas (ex: geracao de IA usada por TL e por colaborador).
 * Se o role nao mapeia para modulo, nao faz nada (internos passam).
 */
export async function requireActiveModuleByRole(
  user: AuthUser,
  options: RequireActiveModuleOptions = {},
): Promise<void> {
  const module = moduleFromRole(user.role);
  if (!module) return;
  await requireActiveModule(user, module, options);
}

/**
 * Variante "em nome de": checa billing da empresa-alvo, nao do user chamador.
 * Use quando strategist/master executa acao para uma empresa terceira
 * (ex: strategist criando post no pipeline de TL de cliente X).
 *
 * Esta funcao NAO valida permissao do user sobre a empresa — faca isso antes
 * com requireStrategistForTL, requireAdminOrStrategist etc.
 *
 * Regras iguais a requireActiveModule, mas companyId vem de parametro.
 */
export async function requireActiveModuleForCompany(
  companyId: string,
  module: BillingModule,
  options: RequireActiveModuleOptions = {},
): Promise<void> {
  if (!companyId) {
    throw new Error('companyId obrigatorio.');
  }

  const graceLegacy = options.graceLegacy !== false;
  const snap = await adminDb.collection('companies').doc(companyId).get();
  if (!snap.exists) {
    throw new Error('Empresa nao encontrada.');
  }

  const data = snap.data() ?? {};
  const billing = (data.billing as CompanyBillingBlock | undefined) ?? null;
  const legacySubscription = graceLegacy
    ? (data.subscription as LegacySubscriptionShape | undefined)
    : undefined;

  const decision = evaluateModuleAccess(billing, module, {
    graceLegacy,
    legacySubscription,
  });

  if (!decision.allowed) {
    throw new Error(decision.message);
  }
}
