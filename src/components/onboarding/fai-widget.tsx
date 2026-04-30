// src/components/onboarding/fai-widget.tsx
// Floating Fai button with mini popup showing checklist progress.
// Always visible during onboarding. Click to toggle popup.
// When all items are completed, shows TourCompleteAnimation before the parent unmounts.

'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import type { OnboardingChecklistItem } from '@/hooks/use-onboarding';
import { TourCompleteAnimation } from './tour-complete-animation';

type FaiWidgetProps = {
  checklist: OnboardingChecklistItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
  visible: boolean;
  settingsHref: string; // Role-specific settings link
};

export function FaiWidget({
  checklist,
  progress,
  completedCount,
  totalCount,
  visible,
  settingsHref,
}: FaiWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const prevCompletedRef = useRef(completedCount);

  const pendingCount = totalCount - completedCount;

  // Trigger completion animation when all items are just completed
  useEffect(() => {
    if (
      visible &&
      totalCount > 0 &&
      completedCount === totalCount &&
      prevCompletedRef.current < totalCount
    ) {
      setShowCompletion(true);
    }
    prevCompletedRef.current = completedCount;
  }, [completedCount, totalCount, visible]);

  // Close popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [isOpen]);

  if (!visible) return null;

  return (
    <>
      {/* Checklist completion confetti celebration */}
      {showCompletion && (
        <TourCompleteAnimation
          variant="checklist"
          onDone={() => setShowCompletion(false)}
        />
      )}

    <div ref={popupRef} className="fixed bottom-6 right-6 z-[60]">
      {/* Popup */}
      {isOpen && (
        <div className="absolute bottom-[72px] right-0 w-[320px] bg-white border border-border rounded-[20px] shadow-[0_16px_48px_rgba(93,42,103,.15)] overflow-hidden animate-in slide-in-from-bottom-3 fade-in duration-300">
          {/* Popup Header */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-secondary to-background border-b">
            <Image
              src="/images/email/fai-avatar.png"
              alt="Fai"
              width={32}
              height={32}
              className="rounded-full border-[1.5px] border-white"
            />
            <div className="font-headline text-[13px] font-black text-foreground">Seu progresso</div>
          </div>

          {/* Message */}
          <div className="px-4 py-3.5 text-xs leading-relaxed text-foreground border-b">
            {completedCount === totalCount
              ? 'Parabéns! Você completou todas as etapas! 🎉'
              : `Falta pouco! Complete os ${pendingCount} ${pendingCount === 1 ? 'item restante' : 'itens restantes'}.`
            }
          </div>

          {/* Items */}
          <div className="px-3 py-2">
            {checklist.map((item) => (
              <button
                key={item.id}
                onClick={() => { router.push(item.href); setIsOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-[10px] text-xs font-medium text-foreground hover:bg-secondary transition-colors text-left"
              >
                <div className={`w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  item.completed ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {item.completed && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <span className={item.completed ? 'text-muted-foreground' : ''}>
                  {!item.completed ? <strong>{item.label}</strong> : item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Footer with progress bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-secondary border-t">
            <div className="flex-1 h-1.5 bg-background rounded-full overflow-hidden mr-3">
              <div
                className="h-full bg-gradient-to-r from-primary to-[#E875FF] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-headline text-xs font-black text-primary">{completedCount}/{totalCount}</span>
          </div>
        </div>
      )}

      {/* FAB Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[#E875FF] shadow-[0_4px_16px_rgba(205,80,241,.4)] border-[3px] border-white flex items-center justify-center cursor-pointer hover:scale-105 transition-transform overflow-hidden"
        >
          <Image
            src="/images/email/fai-avatar.png"
            alt="Fai"
            width={56}
            height={56}
            className="rounded-full object-cover"
          />
        </button>
        {/* Badge — outside the button so it's not clipped */}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white pointer-events-none">
            {pendingCount}
          </span>
        )}
      </div>
    </div>
    </>
  );
}
