// src/components/calendar/calendar-day-cell.tsx
'use client';

import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CalendarDayCellProps {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected?: boolean;
  /** Enable this cell as a drop target */
  droppable?: boolean;
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  minHeight?: string;
}

export const CalendarDayCell = React.memo(function CalendarDayCell({
  day,
  inMonth,
  isToday: today,
  isSelected = false,
  droppable = false,
  isDragOver = false,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
  children,
  className,
  minHeight = 'min-h-[140px]',
}: CalendarDayCellProps) {
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      onDragOver={droppable ? (e) => { e.preventDefault(); onDragOver?.(e); } : undefined}
      onDragLeave={droppable ? onDragLeave : undefined}
      onDrop={droppable ? (e) => { e.preventDefault(); onDrop?.(e); } : undefined}
      className={cn(
        minHeight,
        'p-1.5 border-b border-r text-left transition-colors',
        !inMonth && 'bg-muted/10',
        isSelected && 'ring-2 ring-primary ring-inset bg-primary/5',
        isDragOver && 'bg-primary/10 ring-2 ring-primary/40 ring-inset',
        onClick && 'hover:bg-muted/30',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-medium',
          today && 'bg-primary text-primary-foreground',
          !inMonth && !today && 'text-muted-foreground/50',
          inMonth && !today && 'text-foreground',
        )}
      >
        {format(day, 'd')}
      </span>

      {/* Post cards / indicators */}
      <div className="mt-1 space-y-1">
        {children}
      </div>
    </Tag>
  );
});
