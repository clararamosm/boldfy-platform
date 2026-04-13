// src/components/onboarding/onboarding-checklist.tsx
// Checklist card for /configuracoes page.
// Shows onboarding progress with clickable items that navigate to the relevant page.

'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight } from 'lucide-react';
import type { OnboardingChecklistItem } from '@/hooks/use-onboarding';

type OnboardingChecklistProps = {
  checklist: OnboardingChecklistItem[];
  progress: number;
  completedCount: number;
  totalCount: number;
};

export function OnboardingChecklist({
  checklist,
  progress,
  completedCount,
  totalCount,
}: OnboardingChecklistProps) {
  const router = useRouter();

  return (
    <div className="bg-white border border-border rounded-[20px] overflow-hidden shadow-[0_8px_32px_rgba(93,42,103,.06)]">
      {/* Header */}
      <div className="flex items-center gap-3.5 px-6 py-5 bg-gradient-to-r from-secondary to-background border-b">
        <Image
          src="/images/email/fai-avatar.png"
          alt="Fai"
          width={40}
          height={40}
          className="rounded-full border-2 border-white shadow-sm"
        />
        <div>
          <div className="font-headline text-base font-black text-foreground">Onboarding</div>
          <div className="text-[11px] text-muted-foreground">Complete os passos para configurar tudo</div>
        </div>
        <div className="ml-auto flex flex-col items-end">
          <div className="font-headline text-lg font-black text-primary">{progress}%</div>
          <div className="w-20 h-1.5 bg-background rounded-full overflow-hidden mt-1">
            <div
              className="h-full bg-gradient-to-r from-primary to-[#E875FF] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-4 py-2 pb-5">
        {checklist.map((item, idx) => (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl transition-colors hover:bg-secondary/50 text-left ${
              idx < checklist.length - 1 ? 'border-b border-border/50' : ''
            }`}
          >
            {/* Check circle */}
            <div className={`w-[22px] h-[22px] rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
              item.completed
                ? 'bg-primary border-primary'
                : 'border-border'
            }`}>
              {item.completed && <Check className="h-3 w-3 text-white" />}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-semibold ${
                item.completed ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}>{item.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>
            </div>

            {/* Arrow */}
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
