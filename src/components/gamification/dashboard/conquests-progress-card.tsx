// src/components/gamification/dashboard/conquests-progress-card.tsx
// Shows the 3 active conquest categories (pub/trail/mission) with progress bars.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FileText, BookOpen, Zap, Target } from 'lucide-react';
import { CoinIcon } from '@/components/coin-icon';
import { cn } from '@/lib/utils';

// ─── Category visual config ──────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  progressColor: string;
}> = {
  pub: {
    icon: FileText,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    progressColor: '[&>div]:bg-blue-500',
  },
  trail: {
    icon: BookOpen,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    progressColor: '[&>div]:bg-emerald-500',
  },
  mission: {
    icon: Zap,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    progressColor: '[&>div]:bg-orange-500',
  },
};

// ─── Types ────────────────────────────────────────────────────────

type ConquestProgress = {
  category: string;
  current: number;
  target: number;
  label: string;
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
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          {t.conquestsInProgress}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
              <div key={c.category} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn('rounded-full p-1.5', config.bgColor)}>
                      <IconComponent className={cn('h-3.5 w-3.5', config.color)} />
                    </div>
                    <span className="text-sm font-medium">{c.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {c.current}/{c.target}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <CoinIcon size="xs" />
                      <span className="text-[10px] font-medium text-primary">+50</span>
                    </div>
                  </div>
                </div>
                <Progress value={pct} className={cn('h-2', config.progressColor)} />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
