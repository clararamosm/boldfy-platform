// src/components/gamification/dashboard/conquests-badges-card.tsx
// Grid of collected conquest badges + level journey visualization.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BookOpen, Zap, Trophy, ArrowRight } from 'lucide-react';
import { GemBadge } from '@/components/gamification/gem-badge';
import { cn } from '@/lib/utils';

// ─── Category config ──────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  pub: { icon: FileText, color: 'text-blue-500', bgColor: 'bg-blue-500/8', borderColor: 'border-blue-200/50 dark:border-blue-800/50' },
  trail: { icon: BookOpen, color: 'text-emerald-500', bgColor: 'bg-emerald-500/8', borderColor: 'border-emerald-200/50 dark:border-emerald-800/50' },
  mission: { icon: Zap, color: 'text-orange-500', bgColor: 'bg-orange-500/8', borderColor: 'border-orange-200/50 dark:border-orange-800/50' },
};

// ─── Level journey data ──────────────────────────────────────────

const LEVEL_JOURNEY = [
  { level: 2, weeks: 7 },
  { level: 3, weeks: 14 },
  { level: 4, weeks: 28 },
  { level: 5, weeks: 49 },
  { level: 6, weeks: 70 },
  { level: 7, weeks: 98 },
  { level: 8, weeks: 140 },
];

// ─── Types ────────────────────────────────────────────────────────

type ConquestBadge = {
  id: string;        // e.g. "pub_10"
  category: string;  // e.g. "pub"
  label: string;     // display label
};

type ConquestsBadgesCardProps = {
  badges: ConquestBadge[];
  userLevel: number;
  completedConquests: string[];
  t: {
    conquestsBadges: string;
    badgesCollected: string;
    pubCategory: string;
    trailCategory: string;
    missionCategory: string;
    seqCategory: string;
  };
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────

export function ConquestsBadgesCard({
  badges,
  userLevel,
  completedConquests,
  t,
  className,
}: ConquestsBadgesCardProps) {
  // Group badges by category (only pub/trail/mission — seq handled separately)
  const grouped: Record<string, ConquestBadge[]> = {};
  for (const badge of badges) {
    if (badge.category === 'seq') continue; // handled in journey
    if (!grouped[badge.category]) grouped[badge.category] = [];
    grouped[badge.category].push(badge);
  }

  const categoryLabels: Record<string, string> = {
    pub: t.pubCategory,
    trail: t.trailCategory,
    mission: t.missionCategory,
  };

  const categoryOrder = ['pub', 'trail', 'mission'];

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            {t.conquestsBadges}
          </CardTitle>
          <span className="text-[10px] font-semibold text-muted-foreground">
            {t.badgesCollected.replace('{count}', String(badges.length))}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {badges.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma conquista ainda. Continue publicando!
          </p>
        ) : (
          <>
            {/* Pub / Trail / Mission badges */}
            {categoryOrder.map((cat) => {
              const catBadges = grouped[cat];
              if (!catBadges || catBadges.length === 0) return null;
              const config = CATEGORY_CONFIG[cat];
              const IconComp = config.icon;

              return (
                <div key={cat}>
                  <div className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest mb-2 opacity-70">
                    {categoryLabels[cat]}
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {catBadges.map((badge) => (
                      <div
                        key={badge.id}
                        className={cn(
                          'w-11 h-11 rounded-xl flex flex-col items-center justify-center border',
                          config.bgColor,
                          config.borderColor,
                        )}
                        title={badge.label}
                      >
                        <IconComp className={cn('h-[18px] w-[18px]', config.color)} />
                        <span className={cn('text-[7px] font-black uppercase tracking-tight mt-0.5', config.color)}>
                          {badge.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Constancy — Level Journey */}
            <div>
              <div className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-widest mb-2 opacity-70">
                {t.seqCategory}
              </div>
              <div className="flex items-center gap-0 flex-wrap row-gap-2">
                {LEVEL_JOURNEY.map((step, i) => {
                  const seqId = `seq_${step.weeks}`;
                  const earned = completedConquests.includes(seqId);

                  return (
                    <React.Fragment key={step.level}>
                      {/* Gem node */}
                      <div className="flex flex-col items-center gap-0.5">
                        <div className={cn(
                          'w-[38px] h-[38px] rounded-xl flex flex-col items-center justify-center',
                          earned
                            ? 'shadow-sm'
                            : 'opacity-35 grayscale-[0.4]',
                        )}>
                          <GemBadge level={step.level} size="sm" />
                          <span className="text-[7px] font-black text-purple-500 mt-[-2px]">
                            Nv{step.level}
                          </span>
                        </div>
                        <span className="text-[7px] font-bold text-muted-foreground whitespace-nowrap">
                          {step.weeks} sem
                        </span>
                      </div>
                      {/* Arrow between nodes */}
                      {i < LEVEL_JOURNEY.length - 1 && (
                        <div className="px-0.5 mb-3">
                          <ArrowRight className={cn(
                            'h-3.5 w-3.5',
                            earned ? 'text-primary' : 'text-border',
                          )} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
