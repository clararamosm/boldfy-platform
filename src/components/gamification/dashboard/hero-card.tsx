// src/components/gamification/dashboard/hero-card.tsx
// Hero card with avatar, gem badge, level pill, subtitle, and 3 top stats.
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
  subtitle?: string;
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
  subtitle,
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

          {/* Name + Level pill + Subtitle */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <h2 className="text-xl font-extrabold text-foreground tracking-tight truncate">
              {t.greeting.replace('{name}', userName)}
            </h2>
            <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
                <GemBadge level={level} size="sm" className="scale-[0.6] origin-center -m-1" />
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  {t.levelPill.replace('{level}', String(level))}
                </span>
              </span>
              {subtitle && (
                <span className="text-xs text-muted-foreground">{subtitle}</span>
              )}
            </div>
          </div>

          {/* 3 Stats with vertical dividers */}
          <div className="flex items-center gap-0 flex-shrink-0">
            {/* Pontos */}
            <div className="flex flex-col items-center px-4 sm:px-5">
              <span className="text-xl font-extrabold text-primary leading-tight">{points.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t.heroPoints}</span>
            </div>
            {/* Divider */}
            <div className="w-px h-9 bg-border" />
            {/* Recompensas */}
            <div className="flex flex-col items-center px-4 sm:px-5">
              <span className="text-xl font-extrabold text-foreground leading-tight">{redeemed}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t.heroRewards}</span>
            </div>
            {/* Divider */}
            <div className="w-px h-9 bg-border" />
            {/* Conquistas */}
            <div className="flex flex-col items-center px-4 sm:px-5">
              <span className="text-xl font-extrabold text-foreground leading-tight">{conquests}</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t.heroConquests}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
