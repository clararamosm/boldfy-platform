// src/components/onboarding/page-tour-tooltip.tsx
// Fai speech-bubble tooltip shown inside a page during the guided tour.
// Appears in the bottom-left corner (FaiWidget lives bottom-right).
// Shows a short description of the current page + "Próximo →" button.

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { TourStep } from '@/hooks/use-onboarding';

type PageTourTooltipProps = {
  step: TourStep;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;   // Advance to next menu item
  onSkip: () => void;   // Skip the whole tour
};

export function PageTourTooltip({
  step,
  stepNumber,
  totalSteps,
  onNext,
  onSkip,
}: PageTourTooltipProps) {
  const [show, setShow] = useState(false);

  // Slide in with a short delay after arriving on the page
  useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), 400);
    return () => clearTimeout(t);
  }, [step.id]);

  if (!show) return null;

  const isLast = stepNumber === totalSteps;

  return (
    <div className="fixed bottom-6 left-6 z-[90] flex items-end gap-3 max-w-[340px] animate-in slide-in-from-bottom-3 fade-in duration-400">
      {/* Fai avatar with speech-bubble tail */}
      <div className="flex-shrink-0 relative">
        <Image
          src="/images/email/fai-avatar.png"
          alt="Fai"
          width={40}
          height={40}
          className="rounded-full border-2 border-white shadow-[0_2px_8px_rgba(93,42,103,.18)]"
        />
        {/* Small tail pointing up-right toward the balloon */}
        <div
          className="absolute -top-0.5 -right-1.5 w-0 h-0"
          style={{
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '7px solid white',
            transform: 'rotate(40deg)',
          }}
        />
      </div>

      {/* Speech balloon */}
      <div className="bg-white border border-border rounded-[4px_20px_20px_20px] shadow-[0_8px_32px_rgba(93,42,103,.12),0_2px_6px_rgba(93,42,103,.06)] p-4 flex-1">
        {/* Page name chip */}
        <span className="inline-block text-[10px] font-bold text-primary bg-primary/[0.08] px-2 py-0.5 rounded-full mb-2">
          {step.menuLabel}
        </span>

        {/* Description */}
        <p className="text-[13px] leading-relaxed text-foreground mb-3">
          {step.pageDescription}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-primary bg-primary/[0.08] px-2.5 py-0.5 rounded-full">
              {stepNumber} / {totalSteps}
            </span>
            <button
              onClick={onSkip}
              className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-2"
            >
              Pular
            </button>
          </div>

          <button
            onClick={onNext}
            className="text-xs font-bold text-primary hover:underline bg-transparent border-none cursor-pointer"
          >
            {isLast ? 'Concluir tour ✓' : 'Próximo →'}
          </button>
        </div>
      </div>
    </div>
  );
}
