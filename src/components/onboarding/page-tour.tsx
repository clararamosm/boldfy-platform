// src/components/onboarding/page-tour.tsx
// Orchestrates the guided page tour shown between the welcome popup and the action checklist.
// Tour is session-only: skipping or closing the browser resets it to step 0.
//
// Flow per step:
//   Phase A — MenuTooltip: balloon next to the sidebar item ("Clique aqui")
//             → user clicks the link → route changes → Phase B
//   Phase B — PageTourTooltip: Fai speech bubble on the page ("Próximo →")
//             → user clicks Next → Phase A for next step
//
// When all steps are done → TourCompleteAnimation → onComplete()

'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { TourStep } from '@/hooks/use-onboarding';
import { MenuTooltip } from './menu-tooltip';
import { PageTourTooltip } from './page-tour-tooltip';
import { TourCompleteAnimation } from './tour-complete-animation';

type Phase = 'menu' | 'page' | 'complete';

type PageTourProps = {
  steps: TourStep[];
  onComplete: () => void; // Called after the completion animation finishes
  onSkip: () => void;     // User clicked "Pular tour"
};

export function PageTour({ steps, onComplete, onSkip }: PageTourProps) {
  const pathname = usePathname();
  const router = useRouter();

  // stepIndex: which step we're on (0-based)
  // phase: 'menu' = showing balloon on sidebar; 'page' = showing Fai tooltip on page
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('menu');

  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;

  // Detect when the user navigates to the current step's page (Phase A → B)
  useEffect(() => {
    if (phase !== 'menu' || !currentStep) return;
    if (pathname.startsWith(currentStep.href)) {
      setPhase('page');
    }
  }, [pathname, phase, currentStep]);

  // "Próximo →" clicked — advance to next step or complete
  const handleNext = useCallback(() => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= totalSteps) {
      // All steps visited
      setPhase('complete');
    } else {
      setStepIndex(nextIndex);
      setPhase('menu');
      // Navigate back to the next step's target page so the menu highlight works
      // (user might be on any page at this point — we keep them where they are
      // and just show the next MenuTooltip; they navigate by clicking the menu)
    }
  }, [stepIndex, totalSteps]);

  // Called when the completion animation finishes
  const handleAnimationDone = useCallback(() => {
    onComplete();
  }, [onComplete]);

  if (!currentStep && phase !== 'complete') return null;

  return (
    <>
      {phase === 'menu' && currentStep && (
        <MenuTooltip
          step={currentStep}
          stepNumber={stepIndex + 1}
          totalSteps={totalSteps}
          onSkip={onSkip}
        />
      )}

      {phase === 'page' && currentStep && (
        <PageTourTooltip
          step={currentStep}
          stepNumber={stepIndex + 1}
          totalSteps={totalSteps}
          onNext={handleNext}
          onSkip={onSkip}
        />
      )}

      {phase === 'complete' && (
        <TourCompleteAnimation
          variant="tour"
          onDone={handleAnimationDone}
        />
      )}
    </>
  );
}
