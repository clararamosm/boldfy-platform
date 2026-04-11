// src/lib/slack-templates.ts
// Server-only template rendering engine for Slack notifications.
// Resolves {{variables}} into Slack mrkdwn content.
// Types and constants are in slack-types.ts (shared with client).

import { db as adminDb } from '@/lib/firebase-admin';
import type { TemplateContext } from '@/lib/slack-types';

// Re-export everything from slack-types for backward-compat with existing server imports
export type { SlackNotificationType, NotificationEntry, SlackNotificationConfig, TemplateContext } from '@/lib/slack-types';
export { DEFAULT_TEMPLATES, NOTIFICATION_META, TEMPLATE_VARIABLES } from '@/lib/slack-types';

// ---- Date Helpers ----

const MONTH_NAMES_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTH_NAMES_FULL_PT = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES_PT[d.getMonth()];
  return `${day}/${month}`;
}

function formatDateFull(date: Date): string {
  const day = date.getDate();
  const month = MONTH_NAMES_FULL_PT[date.getMonth()];
  const year = date.getFullYear();
  return `${day} de ${month} de ${year}`;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getSunday(date: Date): Date {
  const monday = getMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function getWeekRange(date: Date): string {
  const monday = getMonday(date);
  const sunday = getSunday(date);
  return `${formatDateShort(monday.toISOString())} – ${formatDateShort(sunday.toISOString())}`;
}

function getNextWeekDate(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 7);
  return d;
}

// ---- Post Formatting ----

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'https://app.boldfy.com.br';
}

function formatPostLink(post: { id: string; title: string; scheduledFor?: string | null }, companyId: string, tlId: string): string {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/strategist/pipeline?companyId=${companyId}&tlId=${tlId}&postId=${post.id}`;
  const date = post.scheduledFor ? ` — ${formatDateShort(post.scheduledFor)}` : '';
  // Slack mrkdwn link format: <URL|Label>
  return `• <${url}|${post.title}>${date}`;
}

function formatPostList(posts: Array<{ id: string; title: string; scheduledFor?: string | null }>, companyId: string, tlId: string): string {
  if (posts.length === 0) return '_Nenhum post_';
  return posts.map(p => formatPostLink(p, companyId, tlId)).join('\n');
}

// ---- Firestore Queries for Variables ----

type PostBasic = { id: string; title: string; scheduledFor: string | null; status: string; publishedAt?: string };

async function fetchTlPosts(tlId: string): Promise<PostBasic[]> {
  const snap = await adminDb.collection(`users/${tlId}/contentPipeline`).get();
  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.title || '',
      scheduledFor: d.scheduledFor || null,
      status: d.status || 'backlog',
      publishedAt: d.publishedAt || undefined,
    };
  });
}

function filterPostsThisWeek(posts: PostBasic[]): PostBasic[] {
  const now = new Date();
  const monday = getMonday(now);
  const sunday = getSunday(now);
  return posts.filter(p => {
    if (!p.scheduledFor) return false;
    const d = new Date(p.scheduledFor);
    return d >= monday && d <= sunday;
  });
}

function filterPostsNextWeek(posts: PostBasic[]): PostBasic[] {
  const now = new Date();
  const nextWeek = getNextWeekDate(now);
  const monday = getMonday(nextWeek);
  const sunday = getSunday(nextWeek);
  return posts.filter(p => {
    if (!p.scheduledFor) return false;
    const d = new Date(p.scheduledFor);
    return d >= monday && d <= sunday;
  });
}

function filterPostsByStatus(posts: PostBasic[], statuses: string[]): PostBasic[] {
  return posts.filter(p => statuses.includes(p.status));
}

function filterPostedThisWeek(posts: PostBasic[]): PostBasic[] {
  const now = new Date();
  const monday = getMonday(now);
  const sunday = getSunday(now);
  return posts.filter(p => {
    if (p.status !== 'postado' || !p.publishedAt) return false;
    const d = new Date(p.publishedAt);
    return d >= monday && d <= sunday;
  });
}

function countPostsThisMonth(posts: PostBasic[]): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return posts.filter(p => {
    if (!p.scheduledFor) return false;
    const d = new Date(p.scheduledFor);
    return d.getFullYear() === year && d.getMonth() === month;
  }).length;
}

// ---- Main Template Renderer ----

export async function renderTemplate(
  template: string,
  context: TemplateContext
): Promise<string> {
  const baseUrl = getBaseUrl();
  const now = new Date();

  // Simple variables (always resolved)
  const simpleVars: Record<string, string> = {
    '{{empresa}}': context.companyName,
    '{{perfil}}': context.tlName,
    '{{estrategista}}': context.strategistName,
    '{{data_hoje}}': formatDateFull(now),
    '{{semana}}': getWeekRange(now),
    '{{semana_seguinte}}': getWeekRange(getNextWeekDate(now)),
    '{{feedback_texto}}': context.feedbackText || '',
  };

  // Event-based single post variables
  if (context.post) {
    const postUrl = `${baseUrl}/strategist/pipeline?companyId=${context.companyId}&tlId=${context.tlId}&postId=${context.post.id}`;
    simpleVars['{{titulo_post}}'] = `<${postUrl}|${context.post.title}>`;
    simpleVars['{{link_post}}'] = postUrl;
  } else {
    simpleVars['{{titulo_post}}'] = '';
    simpleVars['{{link_post}}'] = '';
  }

  let result = template;

  // Replace simple vars first
  for (const [key, value] of Object.entries(simpleVars)) {
    result = result.replaceAll(key, value);
  }

  // Check if we need to fetch posts (lazy — only if list/count vars are present)
  const needsPosts = [
    '{{lista_posts_semana_seguinte}}',
    '{{lista_posts_essa_semana}}',
    '{{lista_posts_aprovados}}',
    '{{lista_posts_prontos}}',
    '{{lista_pendentes_aprovacao}}',
    '{{lista_posts_postados_semana}}',
    '{{total_posts_mes}}',
    '{{total_pendentes}}',
    '{{total_aprovados}}',
  ].some(v => result.includes(v));

  if (needsPosts) {
    const allPosts = await fetchTlPosts(context.tlId);

    const listVars: Record<string, string> = {
      '{{lista_posts_semana_seguinte}}': formatPostList(filterPostsNextWeek(allPosts), context.companyId, context.tlId),
      '{{lista_posts_essa_semana}}': formatPostList(filterPostsThisWeek(allPosts), context.companyId, context.tlId),
      '{{lista_posts_aprovados}}': formatPostList(filterPostsByStatus(allPosts, ['post_aprovado']), context.companyId, context.tlId),
      '{{lista_posts_prontos}}': formatPostList(filterPostsByStatus(allPosts, ['pronto_pra_postar']), context.companyId, context.tlId),
      '{{lista_pendentes_aprovacao}}': formatPostList(filterPostsByStatus(allPosts, ['aprovar_ideia', 'aprovar_post']), context.companyId, context.tlId),
      '{{lista_posts_postados_semana}}': formatPostList(filterPostedThisWeek(allPosts), context.companyId, context.tlId),
      '{{total_posts_mes}}': String(countPostsThisMonth(allPosts)),
      '{{total_pendentes}}': String(filterPostsByStatus(allPosts, ['aprovar_ideia', 'aprovar_post']).length),
      '{{total_aprovados}}': String(filterPostsByStatus(allPosts, ['post_aprovado']).length),
    };

    for (const [key, value] of Object.entries(listVars)) {
      if (result.includes(key)) {
        result = result.replaceAll(key, value);
      }
    }
  }

  return result;
}
