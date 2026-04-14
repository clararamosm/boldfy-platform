// src/components/calendar/calendar-post-card.tsx
'use client';

import React from 'react';
import { Clock, User, Heart, MessageCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

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
  // Strategist-specific
  tlUserId?: string;
  tlName?: string;
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
  /** Enable drag */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  className?: string;
  /** LinkedIn engagement — shown only when post is published (status=postado) */
  reactions?: number;
  comments?: number;
}

export const CalendarPostCard = React.memo(function CalendarPostCard({
  post,
  statusConfig,
  onClick,
  showProfile = false,
  draggable = false,
  onDragStart,
  onDragEnd,
  isDragging = false,
  className,
  reactions,
  comments,
}: CalendarPostCardProps) {
  const time = post.scheduledFor ? format(parseISO(post.scheduledFor), 'HH:mm') : '';
  const showTime = !!time && time !== '00:00';
  const displayTitle = post.title || post.caption?.slice(0, 40) || 'Sem titulo';

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
      {/* Title */}
      <p className="text-[11px] font-medium leading-tight line-clamp-2 text-foreground">
        {displayTitle}
      </p>

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

      {/* Pilar (own line, colored) */}
      {post.contentPillar && (
        <div className="flex items-center">
          <span className="inline-flex items-center px-1 py-px rounded text-[7px] font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 truncate max-w-[80px]">
            {post.contentPillar}
          </span>
        </div>
      )}

      {/* Time + Engagement (for published posts) */}
      {(showTime || ((post.status === 'postado' || post.status === 'published') && reactions != null)) && (
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          {showTime && (
            <>
              <Clock className="h-2.5 w-2.5" />
              <span>{time}</span>
            </>
          )}
          {(post.status === 'postado' || post.status === 'published') && reactions != null && (
            <span className="ml-auto flex items-center gap-1.5">
              <span className="flex items-center gap-0.5 text-rose-500">
                <Heart className="h-2.5 w-2.5" />
                {reactions}
              </span>
              {comments != null && (
                <span className="flex items-center gap-0.5 text-blue-500">
                  <MessageCircle className="h-2.5 w-2.5" />
                  {comments}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Profile + Company (strategist only) */}
      {showProfile && post.tlName && (
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <User className="h-2.5 w-2.5" />
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
