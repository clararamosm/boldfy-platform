// src/components/gamification/conquest-modal.tsx
// Modal celebrating a conquest achievement — appears when a milestone is unlocked.
// Uses CSS-only animated illustrations: PostStack for pub, ConfettiExplosion for high targets.
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
import { FileText, BookOpen, Zap, Diamond } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import { PostStackIllustration, ConfettiExplosionIllustration } from '@/components/gamification/illustrations';

// ─── Category visual config ──────────────────────────────────────

const CATEGORY_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  glowColor: string;
}> = {
  pub: {
    icon: FileText,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    glowColor: 'shadow-blue-500/30',
  },
  trail: {
    icon: BookOpen,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    glowColor: 'shadow-emerald-500/30',
  },
  mission: {
    icon: Zap,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    glowColor: 'shadow-orange-500/30',
  },
  seq: {
    icon: Diamond,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    glowColor: 'shadow-purple-500/30',
  },
};

// ─── Props ────────────────────────────────────────────────────────

type ConquestModalProps = {
  open: boolean;
  onClose: () => void;
  conquestId: string;
  category: string;
  target: number;
  points: number;
};

// ─── Illustration picker ──────────────────────────────────────────
// pub category → PostStack (cards spreading out)
// High targets (≥10) → ConfettiExplosion (big celebration badge)
// Otherwise → fallback to category icon with sparkles

function ConquestIllustration({ category, target }: { category: string; target: number }) {
  if (category === 'pub') {
    return <PostStackIllustration />;
  }
  if (target >= 10) {
    return <ConfettiExplosionIllustration number={target} />;
  }
  return null; // fallback handled below
}

// ─── Component ────────────────────────────────────────────────────

export function ConquestModal({
  open,
  onClose,
  conquestId,
  category,
  target,
  points,
}: ConquestModalProps) {
  const t = useT();
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.pub;
  const IconComponent = config.icon;

  // Resolve conquest label from i18n (fallback to conquestId)
  const conquestLabel =
    (t.gamification?.conquests as Record<string, string> | undefined)?.[conquestId] || conquestId;

  // Decide if we use a CSS illustration or the icon fallback
  const useIllustration = category === 'pub' || target >= 10;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px] text-center p-0 overflow-hidden">
        {/* Animated illustration / icon area */}
        <div className={cn(
          'flex flex-col items-center justify-center pt-8 pb-6 px-6',
          useIllustration ? 'bg-gradient-to-b from-purple-600/10 via-purple-500/5 to-transparent' : config.bgColor,
        )}>
          {useIllustration ? (
            <ConquestIllustration category={category} target={target} />
          ) : (
            <div
              className={cn(
                'relative flex items-center justify-center w-24 h-24 rounded-full',
                config.bgColor,
                'shadow-xl',
                config.glowColor,
                'animate-in zoom-in-50 duration-500',
              )}
            >
              <IconComponent className={cn('h-12 w-12', config.color)} />
              {/* Sparkle dots */}
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-yellow-400 animate-pulse" />
              <span className="absolute -bottom-1 -left-2 h-2 w-2 rounded-full bg-yellow-300 animate-pulse delay-150" />
              <span className="absolute top-2 -left-3 h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse delay-300" />
            </div>
          )}
        </div>

        <div className="px-6 pb-2">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-xl font-bold">
              {t.gamification?.conquests?.unlocked || 'Conquista desbloqueada!'}
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-foreground">
              {conquestLabel}
            </DialogDescription>
          </DialogHeader>

          {/* Points badge */}
          <div className="flex items-center justify-center gap-1.5 mt-4 mb-2">
            <CoinIcon size="sm" />
            <span className="text-sm font-semibold text-primary">
              +{points} pts
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {(t.gamification?.conquests?.points || '+{points} pts adicionados ao seu saldo').replace('{points}', String(points))}
          </p>
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button variant="outline" className="w-full" onClick={onClose}>
            {t.gamification?.conquests?.close || 'Fechar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
