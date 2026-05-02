// src/components/gamification/dashboard/points-card.tsx
// Points summary: available, total earned, total spent + link to history.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoinIcon } from '@/components/coin-icon';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Props ────────────────────────────────────────────────────────

type PointsCardProps = {
  available: number;
  totalEarned: number;
  totalSpent: number;
  t: {
    myPoints: string;
    available: string;
    totalEarned: string;
    totalSpent: string;
    history: string;
  };
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────

export function PointsCard({
  available,
  totalEarned,
  totalSpent,
  t,
  className,
}: PointsCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CoinIcon size="md" />
            {t.myPoints}
          </CardTitle>
          <Link
            href="/colaborador/recompensas"
            className="text-xs text-primary hover:underline"
          >
            {t.history}
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {/* Available */}
          <div className="flex flex-col items-center p-2 rounded-lg bg-primary/5">
            <span className="text-lg font-bold text-primary">{available.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">{t.available}</span>
          </div>
          {/* Total earned */}
          <div className="flex flex-col items-center p-2 rounded-lg">
            <div className="flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3 text-green-500" />
              <span className="text-lg font-bold text-foreground">{totalEarned.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{t.totalEarned}</span>
          </div>
          {/* Total spent */}
          <div className="flex flex-col items-center p-2 rounded-lg">
            <div className="flex items-center gap-0.5">
              <ArrowDownRight className="h-3 w-3 text-red-400" />
              <span className="text-lg font-bold text-foreground">{totalSpent.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{t.totalSpent}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
