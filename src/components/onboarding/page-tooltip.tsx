// src/components/onboarding/page-tooltip.tsx
// Message-style tooltip that appears on pages during onboarding.
// Looks like a chat message from Fai (not a popup).
// Shows page explanation + mini checklist + step counter.

'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Check } from 'lucide-react';
import type { OnboardingChecklistItem } from '@/hooks/use-onboarding';

type PageTooltipProps = {
  message: React.ReactNode;            // The tooltip message (can include <strong>)
  checklist: OnboardingChecklistItem[]; // Current checklist for mini-display
  currentStep: number;                 // Current step number
  totalSteps: number;                  // Total steps
  onDismiss: () => void;               // When user clicks "Entendi!"
  visible: boolean;
};

export function PageTooltip({
  message,
  checklist,
  currentStep,
  totalSteps,
  onDismiss,
  visible,
}: PageTooltipProps) {
  const [show, setShow] = useState(false);

  // Animate in with delay
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    }
    setShow(false);
  }, [visible]);

  if (!visible || !show) return null;

  // Show max 3 most relevant checklist items
  const displayItems = checklist.slice(0, 4);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-48px)] flex gap-3 items-start bg-white border border-border rounded-[4px_20px_20px_20px] p-4 shadow-[0_8px_32px_rgba(93,42,103,.12),0_2px_6px_rgba(93,42,103,.06)] animate-in slide-in-from-bottom-3 fade-in duration-400"
    >
      {/* Fai avatar */}
      <Image
        src="/images/email/fai-avatar.png"
        alt="Fai"
        width={36}
        height={36}
        className="rounded-full border-[1.5px] border-border flex-shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Message text */}
        <div className="text-[13px] leading-relaxed text-foreground mb-2.5 [&>strong]:font-bold [&>strong]:text-foreground">
          {message}
        </div>

        {/* Mini checklist */}
        <div className="flex flex-col gap-1.5 mb-2.5">
          {displayItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-[11px] font-medium text-foreground">
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                item.completed ? 'bg-primary border-primary' : 'border-border'
              }`}>
                {item.completed && <Check className="h-2 w-2 text-white" />}
              </div>
              <span className={item.completed ? 'text-muted-foreground' : ''}>
                {!item.completed && checklist.findIndex(c => !c.completed) === checklist.indexOf(item)
                  ? <strong>{item.label}</strong>
                  : item.label
                }
              </span>
            </div>
          ))}
        </div>

        {/* Footer: step counter + dismiss */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
          <span className="text-[10px] font-bold text-primary bg-primary/[0.08] px-2.5 py-0.5 rounded-full">
            {currentStep} / {totalSteps}
          </span>
          <button
            onClick={onDismiss}
            className="text-xs font-bold text-primary hover:underline bg-transparent border-none cursor-pointer"
          >
            Entendi! →
          </button>
        </div>
      </div>
    </div>
  );
}
