// src/lib/billing/activity-log-types.ts
// Tipos compartilhados (server + client) para a Activity Log de empresa.
// O log vive na subcolecao `companies/{companyId}/activityLog/{entryId}`
// e e visivel apenas para o master, na pagina unificada de gerenciamento.
//
// Compliance:
// - O campo `summary` JAMAIS contem subscriptionId (sub_*), customerId (cus_*),
//   email cru, ou valor monetario por linha. Use maskEmail() quando precisar
//   referenciar usuario.
// - Se algum dia precisarmos guardar dados sensiveis (ex: subscription id pra
//   auditoria interna), usar campo separado `redactedDetails` que e strippado
//   antes do read action devolver pro client.

export type ActivityLogActorRole = 'master' | 'admin' | 'system' | 'webhook';

/**
 * Tipos de evento que podem ser logados.
 *
 * Convencoes:
 * - `<dominio>.<verbo_no_passado>`
 * - 'system.*' = entradas geradas automaticamente sem actor humano
 * - 'webhook' como actorRole quando o evento foi disparado por Stripe
 */
export type ActivityLogKind =
  // Ciclo de vida da empresa
  | 'company.created'
  | 'company.identity_changed'
  // Admin
  | 'admin.invited'
  | 'admin.first_login'
  // Colaboradores
  | 'collaborator.invited'
  | 'collaborator.activated'
  // Billing — config e status
  | 'billing.status_changed'
  | 'billing.config_changed'
  | 'seats.changed'
  // Stripe — eventos financeiros
  | 'payment.received'
  | 'payment.failed'
  | 'subscription.updated'
  // Trilhas
  | 'template_personalizado.seeded'
  // Sistema — placeholders
  | 'system.log_started';

export interface ActivityLogEntry {
  /** Doc ID no Firestore. Auto-id na maioria dos casos; deterministico quando o
   *  evento veio de webhook (idempotencia). */
  id: string;
  /** ISO string do momento do evento. Server-side serializa de Firestore Timestamp. */
  ts: string;
  kind: ActivityLogKind;
  actorRole: ActivityLogActorRole;
  /** uid do master quando actorRole='master'. null para webhook/system. */
  actorUid: string | null;
  /** Texto curto, mobile-friendly, sem dados sensiveis. Pt-BR. */
  summary: string;
}
