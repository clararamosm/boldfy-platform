// src/components/gamification/redemption-modal.tsx
// Modal celebrating a reward redemption — gift box shakes, lid opens, confetti bursts.
'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CoinIcon } from '@/components/coin-icon';
import { useT } from '@/lib/i18n/context';
import { GiftBoxIllustration } from '@/components/gamification/illustrations';

// ─── Props ────────────────────────────────────────────────────────

type RedemptionModalProps = {
  open: boolean;
  onClose: () => void;
  description: string;
  points: number;
};

// ─── Component ────────────────────────────────────────────────────

export function RedemptionModal({
  open,
  onClose,
  description,
  points,
}: RedemptionModalProps) {
  const t = useT();

  const redemptionSection = t.gamification?.redemption as Record<string, string> | undefined;
  const title = redemptionSection?.title || 'Recompensa resgatada!';
  const subtitle = redemptionSection?.subtitle || 'Parabéns pelo resgate';
  const closeLabel = redemptionSection?.close || 'Fechar';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px] text-center p-0 overflow-hidden">
        {/* Gift box illustration area */}
        <div className="flex flex-col items-center justify-center pt-8 pb-4 px-6 bg-gradient-to-b from-purple-600/10 via-purple-500/5 to-transparent">
          <GiftBoxIllustration />
        </div>

        <div className="px-6 pb-2">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-xl font-bold">
              {title}
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>

          {/* Points deducted badge */}
          <div className="flex items-center justify-center gap-1.5 mt-4 mb-2">
            <CoinIcon size="sm" variant="default" />
            <span className="text-sm font-semibold text-muted-foreground">
              {points} pts
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
