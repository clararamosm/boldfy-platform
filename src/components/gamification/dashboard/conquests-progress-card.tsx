// src/components/gamification/dashboard/conquests-progress-card.tsx
// Shows the 3 active conquest categories (pub/trail/mission) with progress bars.
// Uses Trophy + Clock icon, dashed-border category icons, and goal name labels.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FileText, BookOpen, Zap, Trophy, Clock } from 'lucide-react';
import { CoinIcon } from '@/components/coin-icon';
import { cn } from '@/lib/utils';

// ─── Category visual config ──────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  borderColor: string;
  progressColor: string;
}> = {
  pub: {
    icon: FileText,
    color: 'text-blue-500',
    borderColor: 'border-blue-300/50',
    progressColor: '[&>div]:bg-blue-500',
  },
  trail: {
    icon: BookOpen,
    color: 'text-emerald-500',
    borderColor: 'border-emerald-300/50',
    progressColor: '[&>div]:bg-emerald-500',
  },
  mission: {
    icon: Zap,
    color: 'text-orange-500',
    borderColor: 'border-orange-300/50',
    progressColor: '[&>div]:bg-orange-500',
  },
};

// ─── Types ────────────────────────────────────────────────────────

type ConquestProgress = {
  category: string;
  current: number;
  target: number;
  label: string;
  goalName: string; // e.g. "30 publicações"
};

type ConquestsProgressCardProps = {
  conquests: ConquestProgress[];
  t: {
    conquestsInProgress: string;
  };
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────

export function ConquestsProgressCard({
  conquests,
  t,
  className,
}: ConquestsProgressCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          {/* Trophy + clock icon */}
          <span className="relative inline-flex">
            <Trophy className="h-4 w-4 text-amber-500" />
            <Clock className="h-2.5 w-2.5 text-amber-500 absolute -bottom-0.5 -right-1 bg-card rounded-full" />
          </span>
          {t.conquestsInProgress}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {conquests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Todas as conquistas foram alcançadas!
          </p>
        ) : (
          conquests.map((c) => {
            const config = CATEGORY_CONFIG[c.category] || CATEGORY_CONFIG.pub;
            const IconComponent = config.icon;
            const pct = c.target > 0 ? Math.min(100, Math.round((c.current / c.target) * 100)) : 0;

            return (
              <div key={c.category} className="flex items-center gap-2.5 py-1.5 border-b border-border/40 last:border-0">
                {/* Dashed-border icon */}
                <div className={cn(
                  'w-[34px] h-[34px] rounded-xl flex items-center justify-center flex-shrink-0 border-2 border-dashed bg-muted/20',
                  config.borderColor,
                )}>
                  <IconComponent className={cn('h-3.5 w-3.5', config.color)} />
                </div>
                {/* Info + progress */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-foreground">{c.goalName}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={pct} className={cn('h-[5px] flex-1', config.progressColor)} />
                    <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                      {c.current}/{c.target}
                    </span>
                    <span className="text-[10px] font-bold text-primary whitespace-nowrap">+50 pts</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
