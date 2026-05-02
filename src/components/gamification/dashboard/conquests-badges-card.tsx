// src/components/gamification/dashboard/conquests-badges-card.tsx
// Grid of collected conquest badges organized by category.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, BookOpen, Zap, Diamond, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Category config ──────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  pub: { icon: FileText, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-200 dark:border-blue-800' },
  trail: { icon: BookOpen, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-200 dark:border-emerald-800' },
  mission: { icon: Zap, color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-200 dark:border-orange-800' },
  seq: { icon: Diamond, color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-200 dark:border-purple-800' },
};

// ─── Types ────────────────────────────────────────────────────────

type ConquestBadge = {
  id: string;        // e.g. "pub_10"
  category: string;  // e.g. "pub"
  label: string;     // i18n label
};

type ConquestsBadgesCardProps = {
  badges: ConquestBadge[];
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
  t,
  className,
}: ConquestsBadgesCardProps) {
  // Group badges by category
  const grouped: Record<string, ConquestBadge[]> = {};
  for (const badge of badges) {
    if (!grouped[badge.category]) grouped[badge.category] = [];
    grouped[badge.category].push(badge);
  }

  const categoryLabels: Record<string, string> = {
    pub: t.pubCategory,
    trail: t.trailCategory,
    mission: t.missionCategory,
    seq: t.seqCategory,
  };

  const categoryOrder = ['pub', 'trail', 'mission', 'seq'];

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            {t.conquestsBadges}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
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
          categoryOrder.map((cat) => {
            const catBadges = grouped[cat];
            if (!catBadges || catBadges.length === 0) return null;
            const config = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.pub;
            const IconComp = config.icon;

            return (
              <div key={cat}>
                <div className="flex items-center gap-1.5 mb-2">
                  <IconComp className={cn('h-3 w-3', config.color)} />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {categoryLabels[cat]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {catBadges.map((badge) => (
                    <div
                      key={badge.id}
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium',
                        config.bgColor,
                        config.borderColor,
                      )}
                    >
                      <IconComp className={cn('h-3 w-3', config.color)} />
                      <span>{badge.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
