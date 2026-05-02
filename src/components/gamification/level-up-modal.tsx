// src/components/gamification/level-up-modal.tsx
// Celebration modal shown when a collaborator reaches a new level.
// Sprint 5: Enhanced with confetti, glow reveal, and floating particles.
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
import { GemBadge } from '@/components/gamification/gem-badge';
import { useT } from '@/lib/i18n/context';

// ─── Confetti colors ─────────────────────────────────────────────
const CONFETTI_COLORS = ['#a855f7', '#f59e0b', '#10b981', '#8b5cf6'];

// ─── Props ────────────────────────────────────────────────────────

type LevelUpModalProps = {
  open: boolean;
  onClose: () => void;
  level: number;
  cyclesCompleted: number;
};

// ─── Component ────────────────────────────────────────────────────

export function LevelUpModal({
  open,
  onClose,
  level,
  cyclesCompleted,
}: LevelUpModalProps) {
  const t = useT();

  const levelUpSection = t.gamification?.levelUp as Record<string, unknown> | undefined;
  const messages = levelUpSection?.messages as Record<string, string> | undefined;

  const title = (levelUpSection?.title as string) || 'Novo nivel desbloqueado!';
  const levelMessage = messages?.[String(level)] || `Voce chegou ao nivel ${level}!`;
  const viewProfileLabel = (levelUpSection?.viewProfile as string) || 'Ver meu perfil';
  const closeLabel = (levelUpSection?.close as string) || 'Fechar';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px] text-center p-0 overflow-hidden">
        {/* Gem badge area with confetti + glow */}
        <div className="relative overflow-hidden flex flex-col items-center justify-center pt-10 pb-6 px-6 bg-gradient-to-b from-purple-600/20 via-purple-500/10 to-transparent">
          {/* Confetti particles — 12 staggered falling dots */}
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${4 + (i % 3) * 3}px`,
                height: `${4 + (i % 3) * 3}px`,
                left: `${10 + (i * 7) % 80}%`,
                top: `${(i * 11) % 100}%`,
                backgroundColor: CONFETTI_COLORS[i % 4],
                animation: `confetti-fall ${1 + (i % 3) * 0.5}s ease-out ${i * 0.1}s forwards`,
              }}
            />
          ))}

          {/* Gem with scale + glow reveal animation */}
          <div
            className="rounded-full"
            style={{
              animation: 'levelup-scale-reveal 0.6s ease-out forwards, levelup-glow 2s ease-in-out 0.6s infinite',
            }}
          >
            <GemBadge level={level} size="xl" />
          </div>

          {/* Floating particles rising from bottom */}
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={`p-${i}`}
              className="absolute w-2 h-2 rounded-full bg-purple-400/60"
              style={{
                left: `${20 + i * 15}%`,
                bottom: '10%',
                animation: `particle-float ${1.5 + i * 0.3}s ease-out ${0.8 + i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        <div className="px-6 pb-2">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-xl font-bold">
              {title}
            </DialogTitle>
            <DialogDescription className="text-base font-medium text-foreground">
              {levelMessage}
            </DialogDescription>
          </DialogHeader>

          {/* Level pill */}
          <div className="flex items-center justify-center gap-2 mt-4 mb-2">
            <GemBadge level={level} size="sm" />
            <span className="text-sm font-semibold text-foreground">
              {(levelUpSection?.levelPill as string || 'Nivel {level}').replace('{level}', String(level))}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {cyclesCompleted} {cyclesCompleted === 1 ? 'ciclo completo' : 'ciclos completos'}
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
