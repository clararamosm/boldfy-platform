// src/components/calendar/calendar-post-card.tsx
'use client';

import React from 'react';
import { Clock, User, Heart, Eye, FileText, Video } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { getPillarClasses } from '@/lib/pillar-colors';
import { classifyMimeType } from '@/lib/media-rules';

export type CalendarCardPost = {
  id: string;
  title?: string;
  caption?: string;
  scheduledFor: string | null;
  status: string;
  // Post properties
  etapa?: string;
  formato?: string;
  contentPillar?: string;
  // PR 4: chave da cor do pilar (orange/amber/green/blue).
  // Opcional pra retrocompat — quando ausente, render cai no cyan default.
  contentPillarColor?: string;
  // Métricas do LinkedIn Analytics (preenchidas pelo enrichment do XLSX upload)
  analyticsReactions?: number;
  analyticsImpressions?: number;
  // Mídia do post — opcionais, usados só pelo preview no card (prop
  // showMediaPreview). Views que passam o post inteiro (strategist) já
  // trazem tudo; colaborador/TL precisam mapear explicitamente.
  mediaUrl?: string;
  mediaType?: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  // Capa do PDF gerada no upload (página 1 → PNG). PDFs antigos não têm —
  // o preview cai no ícone de documento.
  pdfThumbUrl?: string;
  // Strategist-specific
  tlUserId?: string;
  tlName?: string;
  tlPhotoUrl?: string;
  tlLinkedinConnected?: boolean;
  companyName?: string;
  companySlug?: string;
  tlSlug?: string;
};

export type CalendarCardConfig = {
  label: string;
  badge: string;
  dot: string;
};

interface CalendarPostCardProps {
  post: CalendarCardPost;
  statusConfig: CalendarCardConfig;
  onClick?: () => void;
  /** Show TL name + company (strategist view) */
  showProfile?: boolean;
  /** Quadrado de preview da mídia acima do título (toggle das views de
   *  calendário). Default false — comportamento antigo intacto. */
  showMediaPreview?: boolean;
  /** Enable drag */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  className?: string;
}

export const CalendarPostCard = React.memo(function CalendarPostCard({
  post,
  statusConfig,
  onClick,
  showProfile = false,
  showMediaPreview = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
  className,
}: CalendarPostCardProps) {
  const time = post.scheduledFor ? format(parseISO(post.scheduledFor), 'HH:mm') : '';
  const showTime = !!time && time !== '00:00';
  const displayTitle = post.title || post.caption?.slice(0, 40) || 'Sem titulo';

  // Métricas vêm exclusivamente do XLSX enrichment (analyticsReactions / analyticsImpressions)
  const reactions = post.analyticsReactions;
  const impressions = post.analyticsImpressions;
  const isPublished = post.status === 'postado' || post.status === 'published';
  const hasMetrics = isPublished && (reactions != null || impressions != null);

  // Preview de mídia: primeira mídia do post (galeria tem prioridade,
  // igual aos editores). Imagem/GIF usam a própria URL; PDF usa a capa
  // gerada no upload (pdfThumbUrl) ou ícone quando não há; vídeo fica no
  // ícone (sem thumbnail de vídeo por ora). Sem mídia = sem quadrado.
  const previewMediaUrl = post.mediaUrls?.[0] ?? post.mediaUrl;
  const previewMediaKind = previewMediaUrl
    ? classifyMimeType(post.mediaTypes?.[0] ?? post.mediaType)
    : null;
  const previewImageSrc =
    previewMediaKind === 'image' || previewMediaKind === 'gif'
      ? previewMediaUrl
      : previewMediaKind === 'pdf'
        ? post.pdfThumbUrl
        : undefined;
  const renderPreview = showMediaPreview && previewMediaKind != null;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'w-full text-left rounded-md border bg-card p-1.5 transition-all hover:ring-1 hover:ring-primary/40 hover:shadow-sm space-y-0.5',
        draggable && 'cursor-grab active:cursor-grabbing',
        !draggable && 'cursor-pointer',
        isDragging && 'opacity-40 bg-muted/30',
        className,
      )}
      title={`${displayTitle}${post.tlName ? ` — ${post.tlName}` : ''}${post.companyName ? ` · ${post.companyName}` : ''} — ${statusConfig.label}`}
    >
      {/* Preview de mídia (quadrado acima do título, atrás do toggle) */}
      {renderPreview && (
        <div className="relative aspect-square w-full rounded overflow-hidden border bg-muted">
          {previewImageSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewImageSrc}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            // Fallback: PDF sem capa (anexado antes da geração existir) ou vídeo.
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              {previewMediaKind === 'video' ? (
                <Video className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </div>
          )}
          {/* Badge de tipo pra PDF/vídeo — bate o olho e sabe o formato */}
          {(previewMediaKind === 'pdf' || previewMediaKind === 'video') && (
            <span className="absolute bottom-0.5 right-0.5 px-1 rounded text-[7px] font-semibold bg-background/85 text-muted-foreground border">
              {previewMediaKind === 'pdf' ? 'PDF' : 'VÍDEO'}
            </span>
          )}
          {/* Contador de galeria */}
          {previewMediaKind === 'image' && (post.mediaUrls?.length ?? 0) > 1 && (
            <span className="absolute bottom-0.5 right-0.5 px-1 rounded text-[7px] font-semibold bg-background/85 text-muted-foreground border">
              +{(post.mediaUrls?.length ?? 1) - 1}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <p className="text-[11px] font-medium leading-tight line-clamp-2 text-foreground">
        {displayTitle}
      </p>

      {/* Time (logo abaixo do título) */}
      {showTime && (
        <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          <span>{time}</span>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center gap-1">
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusConfig.dot)} />
        <span className={cn('inline-flex items-center px-1.5 py-px rounded text-[8px] font-semibold', statusConfig.badge)}>
          {statusConfig.label}
        </span>
      </div>

      {/* Etapa + Formato (gray tags, same line) */}
      {(post.etapa || post.formato) && (
        <div className="flex flex-wrap items-center gap-0.5">
          {post.etapa && (
            <span className="inline-flex items-center px-1 py-px rounded text-[7px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {post.etapa}
            </span>
          )}
          {post.formato && (
            <span className="inline-flex items-center px-1 py-px rounded text-[7px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {post.formato}
            </span>
          )}
        </div>
      )}

      {/* Pilar (own line, colorida). A cor vem de `contentPillarColor` via
          getPillarClasses — herda a paleta configurada no pilar. Reativada
          em maio/2026 (antes estava cinza neutro): agora que tags de status
          ficaram distinguíveis (verde published, azul scheduled, etc), a cor
          do pilar volta a ajudar a bater o olho e identificar o tema. Sem
          colorKey, mantém o cyan default antigo (retrocompat com strategist). */}
      {post.contentPillar && (() => {
        const pillarClasses = post.contentPillarColor
          ? getPillarClasses(post.contentPillarColor)
          : null;
        return (
          <div className="flex items-center">
            <span
              className={cn(
                'inline-flex items-center px-1 py-px rounded text-[7px] font-medium truncate max-w-[80px]',
                pillarClasses
                  ? `${pillarClasses.bg} ${pillarClasses.text}`
                  : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
              )}
            >
              {post.contentPillar}
            </span>
          </div>
        );
      })()}

      {/* Métricas (reações + impressões) — linha própria abaixo de tudo */}
      {hasMetrics && (
        <div className="flex items-center gap-1.5 text-[9px]">
          {reactions != null && (
            <span className="flex items-center gap-0.5 text-rose-500">
              <Heart className="h-2.5 w-2.5" />
              {reactions.toLocaleString('pt-BR')}
            </span>
          )}
          {impressions != null && (
            <span className="flex items-center gap-0.5 text-sky-500">
              <Eye className="h-2.5 w-2.5" />
              {impressions >= 1000
                ? `${(impressions / 1000).toFixed(1)}k`
                : impressions.toLocaleString('pt-BR')}
            </span>
          )}
        </div>
      )}

      {/* Profile + Company (strategist only) */}
      {showProfile && post.tlName && (
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          {post.tlPhotoUrl ? (
            <img src={post.tlPhotoUrl} alt="" className="h-3.5 w-3.5 rounded-full object-cover shrink-0" />
          ) : (
            <User className="h-2.5 w-2.5" />
          )}
          <span className="truncate">{post.tlName.split(' ')[0]}</span>
          {post.companyName && (
            <>
              <span>·</span>
              <span className="truncate">{post.companyName}</span>
            </>
          )}
        </div>
      )}
    </button>
  );
});
