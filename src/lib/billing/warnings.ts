// src/lib/billing/warnings.ts
// Regras de negocio para computar warnings de billing exibidos na UI.
// server-only: NUNCA importe no cliente.
//
// A funcao recebe o bloco CompanyBillingBlock ja lido do Firestore
// e retorna lista de warnings. UI apenas renderiza — zero decisao no client.
//
// Tipos de warning (ordenados por severidade decrescente):
// 1. critical: bloqueia acesso, acao urgente (ex: modulo blocked)
// 2. warning:  aviso serio, prazo vencendo (ex: deadline <= 2 dias, beta <= 3 dias)
// 3. info:     informativo (ex: beta ativo, pagamento pendente confortavel)

import 'server-only';

import type { BillingModule } from './stripe-modules';
import type { BillingModuleStatus, CompanyBillingBlock, MaybeTimestamp } from './types';

export type BillingWarningSeverity = 'critical' | 'warning' | 'info';

export interface BillingWarning {
  /** Identificador estavel. Front usa para key + dedupe + i18n futuro. */
  id: string;
  severity: BillingWarningSeverity;
  /** Titulo curto (max ~60 chars). */
  title: string;
  /** Corpo explicativo (max ~200 chars). */
  message: string;
  /** CTA opcional: label + destino (caminho interno). */
  cta?: {
    label: string;
    href: string;
  };
  /** Modulo relacionado, quando aplicavel. */
  module?: BillingModule;
  /** Data/hora do gatilho quando relevante (ISO). Util para ordenacao estavel. */
  triggerISO?: string;
}

/** Normaliza MaybeTimestamp em Date | null de forma defensiva. */
function toDate(v: MaybeTimestamp): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
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

/** Calcula dias restantes (arredondado pra cima), minimo 0. */
function daysUntil(target: Date, now: Date = new Date()): number {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const MODULE_LABEL: Record<BillingModule, string> = {
  platform: 'Plataforma',
  tl: 'Thought Leaders',
  design: 'Design',
};

interface ModuleCheckInput {
  module: BillingModule;
  status: BillingModuleStatus;
  firstPaymentDeadline: MaybeTimestamp;
}

/**
 * Avalia um unico modulo e retorna 0 ou 1 warning.
 * Regra:
 * - status 'blocked' => critical (prazo vencido)
 * - status 'pending' com deadline <= 0 dias => critical (hoje ou passou)
 * - status 'pending' com deadline <= 2 dias => warning
 * - status 'pending' com deadline > 2 dias => info
 * - demais => null
 */
function evaluateModule(input: ModuleCheckInput, now: Date): BillingWarning | null {
  const moduleLabel = MODULE_LABEL[input.module];
  const deadline = toDate(input.firstPaymentDeadline);

  if (input.status === 'blocked') {
    return {
      id: `module-${input.module}-blocked`,
      severity: 'critical',
      title: `${moduleLabel} bloqueado`,
      message: `O prazo de 7 dias para primeiro pagamento expirou. Finalize a cobranca para restabelecer o acesso.`,
      cta: { label: 'Ir para cobranca', href: '/admin/billing' },
      module: input.module,
      triggerISO: deadline ? deadline.toISOString() : undefined,
    };
  }

  if (input.status === 'pending' && deadline) {
    const daysLeft = daysUntil(deadline, now);
    if (daysLeft <= 0) {
      return {
        id: `module-${input.module}-deadline-today`,
        severity: 'critical',
        title: `${moduleLabel}: prazo de pagamento expira hoje`,
        message: `Conclua o pagamento agora para evitar bloqueio automatico.`,
        cta: { label: 'Pagar agora', href: '/admin/billing' },
        module: input.module,
        triggerISO: deadline.toISOString(),
      };
    }
    if (daysLeft <= 2) {
      return {
        id: `module-${input.module}-deadline-soon`,
        severity: 'warning',
        title: `${moduleLabel}: ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'} para o pagamento`,
        message: `Apos o prazo o modulo e bloqueado automaticamente. Finalize a cobranca.`,
        cta: { label: 'Pagar agora', href: '/admin/billing' },
        module: input.module,
        triggerISO: deadline.toISOString(),
      };
    }
    return {
      id: `module-${input.module}-deadline-info`,
      severity: 'info',
      title: `${moduleLabel}: pagamento pendente`,
      message: `Voce tem ${daysLeft} dias para concluir a cobranca antes do bloqueio.`,
      cta: { label: 'Ver cobranca', href: '/admin/billing' },
      module: input.module,
      triggerISO: deadline.toISOString(),
    };
  }

  return null;
}

/**
 * Funcao pura: recebe bloco de billing + data de referencia, retorna warnings ordenados.
 * Nao le Firestore, nao escreve, nao lanca — ideal para testar isolado.
 */
export function computeBillingWarnings(
  billing: CompanyBillingBlock | null | undefined,
  now: Date = new Date(),
): BillingWarning[] {
  const out: BillingWarning[] = [];

  if (!billing) return out;

  // 2. Beta tester
  // Le campo novo (betaEndsAt) com fallback para legado (betaExpiresAt).
  // Ausencia significa: beta permanente OU ainda nao iniciou (pre 1a fatura paga).
  if (billing.isBetaTester === true) {
    const betaEnd = toDate(billing.betaEndsAt) ?? toDate(billing.betaExpiresAt);
    if (!betaEnd) {
      // Beta permanente (sem data) — apenas info discreta
      out.push({
        id: 'beta-active-permanent',
        severity: 'info',
        title: 'Voce esta no programa beta',
        message: 'Sua empresa tem acesso cortesia. Aproveite e nos de feedback quando puder.',
      });
    } else {
      const daysLeft = daysUntil(betaEnd, now);
      if (daysLeft <= 0) {
        // Expirou hoje ou antes — cron trata, mas avisa urgencia
        out.push({
          id: 'beta-expired',
          severity: 'critical',
          title: 'Periodo beta encerrado',
          message:
            'Seu acesso cortesia terminou. Configure um modulo ativo para continuar usando a plataforma.',
          cta: { label: 'Ver planos', href: '/admin/billing' },
          triggerISO: betaEnd.toISOString(),
        });
      } else if (daysLeft <= 3) {
        out.push({
          id: 'beta-expiring-soon',
          severity: 'warning',
          title: `Beta termina em ${daysLeft} ${daysLeft === 1 ? 'dia' : 'dias'}`,
          message:
            'Finalize sua ativacao de Plataforma antes do fim do beta para nao interromper o acesso.',
          cta: { label: 'Ativar plano', href: '/admin/billing' },
          triggerISO: betaEnd.toISOString(),
        });
      } else if (daysLeft <= 14) {
        out.push({
          id: 'beta-expiring',
          severity: 'info',
          title: `Beta termina em ${daysLeft} dias`,
          message: 'Aproveite o periodo restante. Quando terminar, ative um plano para continuar.',
          cta: { label: 'Ver planos', href: '/admin/billing' },
          triggerISO: betaEnd.toISOString(),
        });
      }
      // > 14 dias: silencio, nao precisa avisar ainda
    }
  }

  // 3. Modulos individuais
  if (billing.platform) {
    const w = evaluateModule(
      {
        module: 'platform',
        status: billing.platform.status,
        firstPaymentDeadline: billing.platform.firstPaymentDeadline,
      },
      now,
    );
    if (w) out.push(w);
  }
  if (billing.tl) {
    const w = evaluateModule(
      {
        module: 'tl',
        status: billing.tl.status,
        firstPaymentDeadline: billing.tl.firstPaymentDeadline,
      },
      now,
    );
    if (w) out.push(w);
  }
  if (billing.design) {
    const w = evaluateModule(
      {
        module: 'design',
        status: billing.design.status,
        firstPaymentDeadline: billing.design.firstPaymentDeadline,
      },
      now,
    );
    if (w) out.push(w);
  }

  // Ordenacao: critical > warning > info. Dentro do mesmo nivel, preservar ordem (modulo primeiro, beta depois).
  const severityRank: Record<BillingWarningSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  out.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return out;
}
