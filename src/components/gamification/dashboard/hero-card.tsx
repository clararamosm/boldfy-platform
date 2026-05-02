// src/components/gamification/dashboard/hero-card.tsx
// Hero card with avatar, gem badge, level pill, and 3 top stats.
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GemBadge } from '@/components/gamification/gem-badge';
import { CoinIcon } from '@/components/coin-icon';
import { Gift, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Level border colors ─────────────────────────────────────────

const LEVEL_BORDER: Record<number, string> = {
  1: 'border-purple-200',
  2: 'border-purple-300',
  3: 'border-purple-400',
  4: 'border-purple-500',
  5: 'border-purple-600',
  6: 'border-purple-700',
  7: 'border-purple-800',
  8: 'border-purple-900',
};

// ─── Props ────────────────────────────────────────────────────────

type HeroCardProps = {
  userName: string;
  avatarUrl?: string;
  level: number;
  points: number;
  redeemed: number;
  conquests: number;
  t: {
    greeting: string;
    levelPill: string;
    heroPoints: string;
    heroRewards: string;
    heroConquests: string;
  };
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────

export function HeroCard({
  userName,
  avatarUrl,
  level,
  points,
  redeemed,
  conquests,
  t,
  className,
}: HeroCardProps) {
  const initials = userName.substring(0, 2).toUpperCase();
  const borderColor = LEVEL_BORDER[level] || 'border-primary';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-5">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          {/* Avatar + Gem Badge */}
          <div className="relative flex-shrink-0">
            <Avatar className={cn('h-16 w-16 border-[3px]', borderColor)}>
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
            </Avatar>
            {/* Gem badge overlapping bottom-right */}
            <div className="absolute -bottom-1 -right-1">
              <GemBadge level={level} size="sm" />
            </div>
          </div>

          {/* Name + Level pill */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">
              {t.greeting.replace('{name}', userName)}
            </h2>
            <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <GemBadge level={level} size="sm" className="scale-[0.6] origin-center -m-1" />
              <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                {t.levelPill.replace('{level}', String(level))}
              </span>
            </div>
          </div>

          {/* 3 Stats */}
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex flex-col items-center gap-0.5">
              <CoinIcon size="lg" />
              <span className="text-lg font-bold text-foreground">{points.toLocaleString()}</span>
              <span className="text-[10px] text-muted-foreground">{t.heroPoints}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Gift className="h-5 w-5 text-green-500" />
              <span className="text-lg font-bold text-foreground">{redeemed}</span>
              <span className="text-[10px] text-muted-foreground">{t.heroRewards}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Award className="h-5 w-5 text-purple-500" />
              <span className="text-lg font-bold text-foreground">{conquests}</span>
              <span className="text-[10px] text-muted-foreground">{t.heroConquests}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
