// src/lib/post-status-config.ts
//
// Config visual dos status de post (ScheduledPost.status). Compartilhada
// entre calendario e editor do colaborador pra que a badge/tag aparente
// igual nos dois lugares.
//
// Cada status tem: label (do dicionario i18n), classes Tailwind pra
// background/text/border/dot, e um icone Lucide.

import {
  CheckCircle2,
  Clock,
  Edit3,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react';
import type { Dictionary } from '@/lib/i18n/dictionaries/pt-BR';

export type PostStatus = 'published' | 'scheduled' | 'in_progress' | 'draft' | 'failed';

export type PostStatusConfig = {
  tag: string;
  color: string;       // background + text combo pra badge inline (cor de fundo claro)
  cardBorder: string;  // border-l-4 com cor — usado em cards do sidebar
  badge: string;       // versao "badge" da cor — mesma do color em geral
  dot: string;         // bolinha de cor cheia (no card do calendario)
  icon: LucideIcon;
};

/**
 * Devolve a config visual de cada status. Recebe `t` (dicionario i18n)
 * porque os labels mudam por idioma.
 */
export function getPostStatusConfig(t: Dictionary): Record<PostStatus, PostStatusConfig> {
  return {
    // Publicado: verde (sucesso). Antes usava o mesmo azul do LinkedIn que
    // o `scheduled`, só com opacidades diferentes — visualmente confundia.
    // Verde sinaliza claramente o estado terminal de sucesso.
    published: {
      tag: t.colabCalendar.tagPostPublished,
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      cardBorder: 'border-l-4 border-l-green-500',
      badge: 'bg-green-100 text-green-700',
      dot: 'bg-green-500',
      icon: CheckCircle2,
    },
    // Agendado: azul LinkedIn cheio (sem opacidade). A opacidade /60 da dot
    // anterior fazia a bolinha sumir visualmente no card do calendário (1.5px
    // + 60% alpha + fundo branco = imperceptível). Agora bolinha e borda
    // ficam sólidas, igual aos outros status.
    scheduled: {
      tag: t.colabCalendar.tagPostScheduled,
      color: 'bg-[#0A66C2]/10 text-[#0A66C2] dark:bg-[#0A66C2]/20',
      cardBorder: 'border-l-4 border-l-[#0A66C2]',
      badge: 'bg-[#0A66C2]/10 text-[#0A66C2]',
      dot: 'bg-[#0A66C2]',
      icon: Clock,
    },
    in_progress: {
      tag: t.colabCalendar.tagPostInProgress,
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      cardBorder: 'border-l-4 border-l-yellow-500',
      badge: 'bg-yellow-100 text-yellow-700',
      dot: 'bg-yellow-500',
      icon: Edit3,
    },
    draft: {
      tag: t.colabCalendar.tagPostIdea,
      color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      cardBorder: 'border-l-4 border-l-gray-400',
      badge: 'bg-gray-100 text-gray-600',
      dot: 'bg-gray-400',
      icon: Edit3,
    },
    failed: {
      tag: t.colabCalendar.tagPostFailed,
      color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      cardBorder: 'border-l-4 border-l-red-500',
      badge: 'bg-red-100 text-red-700',
      dot: 'bg-red-500',
      icon: AlertCircle,
    },
  };
}

/**
 * Devolve a config de um status especifico, com fallback pra 'draft' se
 * o status for desconhecido. Util pra UIs que so precisam da config de 1.
 */
export function getStatusConfig(t: Dictionary, status: string | undefined): PostStatusConfig {
  const all = getPostStatusConfig(t);
  return (all[status as PostStatus] ?? all.draft);
}
