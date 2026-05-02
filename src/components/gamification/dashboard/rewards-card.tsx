// src/components/gamification/dashboard/rewards-card.tsx
// Rewards summary: redeemed count + available in shop + link to shop.
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, ShoppingBag, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// ─── Props ────────────────────────────────────────────────────────

type RewardsCardProps = {
  redeemed: number;
  availableInShop: number;
  t: {
    rewardsCard: string;
    redeemed: string;
    availableInShop: string;
    viewShop: string;
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
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            {t.rewardsCard}
          </CardTitle>
          <Link
            href="/colaborador/recompensas"
            className="text-xs text-primary hover:underline"
          >
            {t.viewShop}
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {/* Redeemed */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-green-50 dark:bg-green-900/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Check className="h-4 w-4 text-green-500" />
              <span className="text-xl font-bold text-foreground">{redeemed}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{t.redeemed}</span>
          </div>
          {/* Available in shop */}
          <div className="flex flex-col items-center p-3 rounded-lg bg-primary/5">
            <div className="flex items-center gap-1.5 mb-1">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="text-xl font-bold text-foreground">{availableInShop}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{t.availableInShop}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
