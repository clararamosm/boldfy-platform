// src/components/gamification/dashboard/rewards-card.tsx
// Rewards summary: redeemed count + available in shop, vertical row layout.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, Check, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Props ────────────────────────────────────────────────────────

type RewardsCardProps = {
  redeemed: number;
  availableInShop: number;
  t: {
    rewardsCard: string;
    redeemed: string;
    redeemedLabel: string;
    availableLabel: string;
    availableInShop: string;
    viewShop: string;
    history: string;
  };
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────

export function RewardsCard({
  redeemed,
  availableInShop,
  t,
  className,
}: RewardsCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Gift className="h-4 w-4 text-green-500" />
            {t.rewardsCard}
          </CardTitle>
          <Link
            href="/colaborador/recompensas"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            {t.viewShop}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Redeemed row */}
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-green-500" />
            </div>
            <span className="text-sm font-bold text-foreground">
              {redeemed} {t.redeemedLabel}
            </span>
          </div>
          <Link
            href="/colaborador/recompensas"
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            {t.history}
          </Link>
        </div>
        {/* Available in shop row */}
        <div className="flex items-center py-1.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">
              {availableInShop} {t.availableLabel}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
