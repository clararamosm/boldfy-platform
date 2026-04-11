// src/lib/slack-types.ts
// Shared types, constants, and metadata for Slack notifications.
// Safe to import from both client and server code (no firebase-admin dependency).

// ---- Types ----

export type SlackNotificationType =
  | 'resumo_semanal'
  | 'lembrete_aprovacao'
  | 'dropin_semanal'
  | 'post_pronto'
  | 'feedback_recebido';

export type NotificationEntry = {
  enabled: boolean;
  channelId: string | null;
  channelName: string | null;
  template: string;
  tag: 'interna' | 'cliente';
  dayOfWeek?: number;
  timeOfDay?: string;
  lastSentAt?: string;
};

export type SlackNotificationConfig = {
  companyId: string;
  tlId: string;
  companyName: string;
  tlName: string;
  notifications: Record<SlackNotificationType, NotificationEntry>;
  updatedAt: string;
};

export type TemplateContext = {
  companyId: string;
  companyName: string;
  tlId: string;
  tlName: string;
  strategistName: string;
  // Event-based (single post):
  post?: { id: string; title: string; scheduledFor?: string | null };
  feedbackText?: string;
};

// ---- Default Templates ----

export const DEFAULT_TEMPLATES: Record<SlackNotificationType, string> = {
  resumo_semanal: `*Resumo Semanal — {{empresa}} / {{perfil}}*
Semana: {{semana}}

*Posts esta semana:*
{{lista_posts_essa_semana}}

*Posts semana seguinte:*
{{lista_posts_semana_seguinte}}

Total do mes: {{total_posts_mes}} | Pendentes: {{total_pendentes}} | Aprovados: {{total_aprovados}}`,

  lembrete_aprovacao: `*Lembrete de Aprovacao — {{perfil}}*

Posts aguardando aprovacao:
{{lista_pendentes_aprovacao}}`,

  dropin_semanal: `*Drop-in Semanal — {{empresa}} / {{perfil}}*
{{data_hoje}}

*Posts prontos para publicar:*
{{lista_posts_prontos}}

*Posts aprovados:*
{{lista_posts_aprovados}}`,

  post_pronto: `*Post Pronto para Publicar* — {{empresa}} / {{perfil}}

{{titulo_post}}`,

  feedback_recebido: `*Feedback Recebido* — {{empresa}} / {{perfil}}

Post: {{titulo_post}}

_"{{feedback_texto}}"_`,
};

// ---- Notification Metadata ----

export const NOTIFICATION_META: Record<SlackNotificationType, {
  label: string;
  tag: 'interna' | 'cliente';
  schedule: string;
}> = {
  resumo_semanal: { label: 'Resumo Semanal', tag: 'interna', schedule: 'Sexta 9h' },
  lembrete_aprovacao: { label: 'Lembrete de Aprovacao', tag: 'cliente', schedule: 'Seg-Sex 9h' },
  dropin_semanal: { label: 'Drop-in Semanal', tag: 'cliente', schedule: 'Configuravel' },
  post_pronto: { label: 'Post Pronto para Publicar', tag: 'cliente', schedule: 'Evento' },
  feedback_recebido: { label: 'Feedback Recebido', tag: 'interna', schedule: 'Evento' },
};

// ---- Variable Definitions (for info popup) ----

export const TEMPLATE_VARIABLES = [
  { key: '{{empresa}}', description: 'Nome da empresa' },
  { key: '{{perfil}}', description: 'Nome do perfil (TL)' },
  { key: '{{estrategista}}', description: 'Nome do estrategista' },
  { key: '{{data_hoje}}', description: 'Data de hoje (ex: 11 de abril de 2026)' },
  { key: '{{semana}}', description: 'Intervalo da semana atual (ex: 07/abr – 13/abr)' },
  { key: '{{semana_seguinte}}', description: 'Intervalo da proxima semana' },
  { key: '{{lista_posts_essa_semana}}', description: 'Posts agendados para esta semana (titulo + link + data)' },
  { key: '{{lista_posts_semana_seguinte}}', description: 'Posts agendados para a proxima semana' },
  { key: '{{lista_posts_aprovados}}', description: 'Posts com status aprovado' },
  { key: '{{lista_posts_prontos}}', description: 'Posts prontos para publicar' },
  { key: '{{lista_pendentes_aprovacao}}', description: 'Posts aguardando aprovacao' },
  { key: '{{lista_posts_postados_semana}}', description: 'Posts publicados esta semana' },
  { key: '{{total_posts_mes}}', description: 'Total de posts do mes' },
  { key: '{{total_pendentes}}', description: 'Total pendentes de aprovacao' },
  { key: '{{total_aprovados}}', description: 'Total aprovados' },
  { key: '{{titulo_post}}', description: 'Titulo do post (com link) — apenas em notificacoes de evento' },
  { key: '{{link_post}}', description: 'Link direto para o post — apenas em notificacoes de evento' },
  { key: '{{feedback_texto}}', description: 'Texto do feedback do TL — apenas em feedback recebido' },
];
