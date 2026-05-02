// src/components/gamification/dashboard/checkin-card.tsx
// Weekly check-in card: day-by-day posts, streak week counter, cycle progress.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, Check, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────

type CheckinCardProps = {
  postsThisWeek: number;
  currentWeeks: number;     // 0-7
  weekDaysWithPosts: boolean[];  // [Mon..Sun] — true if user published that day
  cyclesCompleted: number;
  isWeekCompleted: boolean;
  t: {
    title: string;
    week: string;
    postsCount: string;
    completed: string;
    streakBonus: string;
    nextBonus: string;
    cycleComplete: string;
    noPosts: string;
    cycle: string;
    weeksStreak: string;
    days: string[];
  };
  className?: string;
};

// ─── Bonus table (weeks 1–7) ──────────────────────────────────────

const WEEK_BONUSES = [10, 20, 40, 80, 160, 320, 640];

// ─── Component ────────────────────────────────────────────────────

export function CheckinCard({
  postsThisWeek,
  currentWeeks,
  weekDaysWithPosts,
  cyclesCompleted,
  isWeekCompleted,
  t,
  className,
}: CheckinCardProps) {
  const postsDisplay = Math.min(postsThisWeek, 3);
  const streakWeekLabel = currentWeeks > 0 ? currentWeeks : (isWeekCompleted ? 1 : 0);

  // Current bonus for this week (or next if week isn't done)
  const currentWeekIdx = Math.max(0, Math.min(currentWeeks - 1, 6));
  const nextBonusIdx = isWeekCompleted
    ? Math.min(currentWeeks, 6)  // Already completed this week, show next
    : Math.max(0, Math.min(currentWeeks - 1, 6));
  const currentBonus = isWeekCompleted ? WEEK_BONUSES[currentWeekIdx] : 0;
  const nextBonus = WEEK_BONUSES[isWeekCompleted ? Math.min(currentWeeks, 6) : Math.max(0, currentWeeks > 0 ? currentWeeks - 1 : 0)];

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            {t.title}
          </CardTitle>
          {streakWeekLabel > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-semibold">
              <Flame className="h-3 w-3" />
              {t.week} {streakWeekLabel}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Week status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {t.postsCount.replace('{count}', String(postsDisplay))}
          </span>
          {isWeekCompleted && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
              <Check className="h-3 w-3" />
              {t.completed}
            </span>
          )}
        </div>

        {/* Day-by-day row */}
        <div className="grid grid-cols-7 gap-1.5">
          {weekDaysWithPosts.map((published, idx) => {
            const isToday = idx === ((new Date().getDay() + 6) % 7); // Mon=0 ... Sun=6
            return (
              <div key={idx} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{t.days[idx]}</span>
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                    published
                      ? 'bg-green-500 text-white'
                      : isToday
                        ? 'border-2 border-primary bg-primary/5 text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {published ? <Check className="h-3.5 w-3.5" /> : ''}
                </div>
                {published && (
                  <span className="text-[9px] font-medium text-primary">+30</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Streak bonus info */}
        {isWeekCompleted && currentBonus > 0 && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {t.streakBonus.replace('{points}', String(currentBonus))}
          </p>
        )}
        {!isWeekCompleted && currentWeeks > 0 && (
          <p className="text-xs text-muted-foreground">
            {t.nextBonus.replace('{points}', String(nextBonus))}
          </p>
        )}

        {/* Cycle progress: S1–S7 */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">
              {t.cycle} {cyclesCompleted + 1}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {t.weeksStreak.replace('{count}', String(currentWeeks))}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 7 }, (_, i) => {
              const weekNum = i + 1;
              const done = weekNum <= currentWeeks;
              const isCurrent = weekNum === currentWeeks + 1 && !isWeekCompleted;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      'w-full h-2 rounded-full transition-colors',
                      done
                        ? 'bg-green-500'
                        : isCurrent
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-muted',
                    )}
                  />
                  <span className="text-[8px] text-muted-foreground">S{weekNum}</span>
                  <span className="text-[8px] text-muted-foreground">+{WEEK_BONUSES[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
