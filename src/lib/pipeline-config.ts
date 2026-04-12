// src/lib/pipeline-config.ts
// Single source of truth for pipeline status configuration.
// All views (pipeline, calendar, post editor, backlog) consume this.

import type { PipelineStatus } from '@/app/actions/content-pipeline';
import {
  FileText,
  CircleDot,
  Edit3,
  ThumbsUp,
  CheckCircle2,
  Send,
  AlertTriangle,
  Archive,
  type LucideIcon,
} from 'lucide-react';

// ─── Status config ──────────────────────────────────────

export type StatusConfig = {
  label: string;
  icon: LucideIcon;
  // Badge / tag colors (shared across all views)
  badge: string;
  // Kanban column header border
  kanbanBorder: string;
  // Calendar cell background
  calendarBg: string;
  // Calendar text color
  calendarText: string;
  // Calendar dot indicator
  dot: string;
};

export const STATUS_CONFIG: Record<PipelineStatus, StatusConfig> = {
  backlog: {
    label: 'Backlog',
    icon: FileText,
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    kanbanBorder: 'border-gray-300 dark:border-gray-600',
    calendarBg: 'bg-gray-50 dark:bg-gray-800/50',
    calendarText: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-400',
  },
  aprovar_ideia: {
    label: 'Aprovar Ideia',
    icon: CircleDot,
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    kanbanBorder: 'border-amber-400 dark:border-amber-500',
    calendarBg: 'bg-amber-50 dark:bg-amber-900/20',
    calendarText: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  em_producao: {
    label: 'Em Produção',
    icon: Edit3,
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    kanbanBorder: 'border-blue-400 dark:border-blue-500',
    calendarBg: 'bg-blue-50 dark:bg-blue-900/20',
    calendarText: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  aprovar_post: {
    label: 'Aprovar Post',
    icon: ThumbsUp,
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    kanbanBorder: 'border-orange-400 dark:border-orange-500',
    calendarBg: 'bg-orange-50 dark:bg-orange-900/20',
    calendarText: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  post_aprovado: {
    label: 'Aprovado',
    icon: CheckCircle2,
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    kanbanBorder: 'border-emerald-400 dark:border-emerald-500',
    calendarBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    calendarText: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  pronto_pra_postar: {
    label: 'Pronto pra Postar',
    icon: Send,
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    kanbanBorder: 'border-green-500 dark:border-green-500',
    calendarBg: 'bg-green-50 dark:bg-green-900/20',
    calendarText: 'text-green-700 dark:text-green-400',
    dot: 'bg-green-600',
  },
  postado: {
    label: 'Postado',
    icon: CheckCircle2,
    badge: 'bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20',
    kanbanBorder: 'border-[#0A66C2]',
    calendarBg: 'bg-[#0A66C2]/5 dark:bg-[#0A66C2]/10',
    calendarText: 'text-[#0A66C2]',
    dot: 'bg-[#0A66C2]',
  },
  ajuste: {
    label: 'Ajuste',
    icon: AlertTriangle,
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    kanbanBorder: 'border-red-400 dark:border-red-500',
    calendarBg: 'bg-red-50 dark:bg-red-900/20',
    calendarText: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
  arquivado: {
    label: 'Arquivado',
    icon: Archive,
    badge: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
    kanbanBorder: 'border-gray-300 dark:border-gray-500',
    calendarBg: 'bg-gray-50/50 dark:bg-gray-800/30',
    calendarText: 'text-gray-400',
    dot: 'bg-gray-300',
  },
};

// ─── Ordered status lists ──────────────────────────────

/** All statuses in kanban column order */
export const PIPELINE_STATUSES: PipelineStatus[] = [
  'backlog', 'aprovar_ideia', 'em_producao', 'aprovar_post',
  'post_aprovado', 'pronto_pra_postar', 'postado', 'ajuste', 'arquivado',
];

/** Statuses relevant for TL (backlog filter) */
export const TL_VISIBLE_STATUSES: PipelineStatus[] = [
  'aprovar_ideia', 'em_producao', 'aprovar_post',
  'post_aprovado', 'pronto_pra_postar', 'postado', 'ajuste',
];

// ─── Property options ──────────────────────────────────

export const ETAPA_OPTIONS = ['Visibilidade', 'Autoridade', 'Conversão'] as const;

export const FORMATO_OPTIONS = [
  'Vídeo', 'Texto', 'GIF', 'One Pager', 'Carrossel',
  'Foto', 'Quote', 'Meme', 'Print',
] as const;

// ─── Helpers ────────────────────────────────────────────

export function getStatusConfig(status: PipelineStatus): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.backlog;
}

/**
 * Build a getStatusLabel function from i18n translations.
 * Usage: const getStatusLabel = buildGetStatusLabel(t);
 */
export function buildGetStatusLabel(t: {
  contentPipeline: {
    status: {
      backlog: string;
      aprovarIdeia: string;
      emProducao: string;
      aprovarPost: string;
      postAprovado: string;
      prontoPraPostar: string;
      postado: string;
    };
  };
}) {
  return (status: PipelineStatus): string => {
    const map: Record<PipelineStatus, string> = {
      backlog: t.contentPipeline.status.backlog,
      aprovar_ideia: t.contentPipeline.status.aprovarIdeia,
      em_producao: t.contentPipeline.status.emProducao,
      aprovar_post: t.contentPipeline.status.aprovarPost,
      post_aprovado: t.contentPipeline.status.postAprovado,
      pronto_pra_postar: t.contentPipeline.status.prontoPraPostar,
      postado: t.contentPipeline.status.postado,
      ajuste: 'Ajuste',
      arquivado: 'Arquivado',
    };
    return map[status] || status;
  };
}
