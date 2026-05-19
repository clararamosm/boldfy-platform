// src/components/gamification/dashboard/checkin-card.tsx
// Weekly check-in card: day-by-day posts, streak week counter, cycle stepper.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, Check } from 'lucide-react';
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
    weekSummary: string;
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

  // `currentWeeks` reflects the streak position the user is *in*, not the
  // number of weeks already completed: a new ISO week with a continuing streak
  // bumps `currentWeeks` on the very first publication. We derive
  // `completedWeeks` so the cycle stepper and summary never claim a week is
  // done before the 3-post threshold has been hit.
  const completedWeeks = isWeekCompleted ? currentWeeks : Math.max(0, currentWeeks - 1);

  // Bonus for the week the user just completed (0 if current week isn't done yet)
  const currentWeekIdx = Math.max(0, Math.min(currentWeeks - 1, 6));
  const currentBonus = isWeekCompleted ? WEEK_BONUSES[currentWeekIdx] : 0;

  // Next bonus the user would earn
  const nextBonusIdx = isWeekCompleted
    ? Math.min(currentWeeks, 6)
    : Math.max(0, currentWeeks > 0 ? currentWeeks - 1 : 0);
  const nextBonus = WEEK_BONUSES[nextBonusIdx];

  // Post points this week
  const postPoints = postsDisplay * 30;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            {t.title}
            {streakWeekLabel > 0 && (
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                {t.week} {streakWeekLabel}
              </span>
            )}
          </CardTitle>
          {/* 3/3 status tag */}
          <span className={cn(
            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold',
            isWeekCompleted
              ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'bg-muted text-muted-foreground',
          )}>
            {isWeekCompleted && <Check className="h-3 w-3" />}
            {postsDisplay}/3
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Day-by-day grid — rounded squares, not circles */}
        <div className="flex gap-2 flex-wrap">
          {weekDaysWithPosts.map((published, idx) => {
            const isToday = idx === ((new Date().getDay() + 6) % 7); // Mon=0 ... Sun=6
            return (
              <div key={idx} className="flex flex-col items-center gap-1 min-w-[42px]">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">{t.days[idx]}</span>
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-colors',
                    published && isToday
                      ? 'border-primary bg-green-50 dark:bg-green-900/20'
                      : published
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : isToday
                          ? 'border-primary border-[3px] shadow-sm shadow-primary/15 bg-background'
                          : 'border-border bg-muted/30',
                  )}
                >
                  {published && <Check className="h-3.5 w-3.5 text-green-500" />}
                </div>
                <span className="text-[9px] font-extrabold text-green-500 min-h-[13px]">
                  {published ? '+30' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Week summary */}
        {postsDisplay > 0 && (
          <div className="text-xs font-bold p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40">
            {postsDisplay} {postsDisplay === 1 ? 'post' : 'posts'} esta semana:{' '}
            <span className="text-green-600 dark:text-green-400 font-extrabold">+{postPoints} pts posts</span>
            {isWeekCompleted && currentBonus > 0 && (
              <> + <span className="text-green-600 dark:text-green-400 font-extrabold">+{currentBonus} pts streak</span></>
            )}
          </div>
        )}

        {/* Cycle stepper: S1–S7 as discrete steps */}
        <div className="pt-3 border-t">
          <div className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-2">
            {t.cycle} {cyclesCompleted + 1}
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }, (_, i) => {
              const weekNum = i + 1;
              const done = weekNum <= completedWeeks;
              const isCurrent = !done && weekNum === completedWeeks + 1 && currentWeeks > 0 && weekNum <= 7;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-[1.5px]',
                    done
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/10'
                      : isCurrent
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10 animate-pulse'
                        : 'border-border bg-muted/20',
                  )}
                >
                  <span className={cn(
                    'text-[9px] font-extrabold whitespace-nowrap',
                    done ? 'text-green-600 dark:text-green-400' : isCurrent ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                  )}>
                    {t.week} {weekNum}
                  </span>
                  {/* Circle indicator */}
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center',
                    done
                      ? 'bg-green-500'
                      : isCurrent
                        ? 'border-2 border-amber-400 bg-amber-100 dark:bg-amber-900/30'
                        : 'border-2 border-border bg-muted/30',
                  )}>
                    {done && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className={cn(
                    'text-[9px] font-extrabold',
                    done ? 'text-green-600 dark:text-green-400' : isCurrent ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground opacity-60',
                  )}>
                    +{WEEK_BONUSES[i]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Cycle summary */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs font-bold text-foreground">
              {completedWeeks > 0
                ? t.weeksStreak.replace('{count}', String(completedWeeks))
                : t.noPosts}
            </span>
            {!isWeekCompleted && currentWeeks > 0 && (
              <span className="text-xs font-bold">
                {t.nextBonus.replace('{points}', String(nextBonus))}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
