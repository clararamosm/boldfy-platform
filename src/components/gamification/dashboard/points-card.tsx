// src/components/gamification/dashboard/points-card.tsx
// Points summary: available (primary highlight), total earned, total spent.
// Vertical 3-row layout matching approved preview.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoinIcon } from '@/components/coin-icon';
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
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <CoinIcon size="md" />
            {t.myPoints}
          </CardTitle>
          <Link
            href="/colaborador/recompensas"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            {t.history}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Disponíveis — highlighted */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-muted-foreground font-medium">{t.available}</span>
          <span className="text-lg font-extrabold text-primary">{available.toLocaleString()}</span>
        </div>
        {/* Total ganhos */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-muted-foreground font-medium">{t.totalEarned}</span>
          <span className="text-sm font-extrabold text-foreground">{totalEarned.toLocaleString()}</span>
        </div>
        {/* Total gastos */}
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-muted-foreground font-medium">{t.totalSpent}</span>
          <span className="text-sm font-extrabold text-foreground">{totalSpent.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
