// src/components/onboarding/menu-tooltip.tsx
// Balloon tooltip that floats next to a sidebar nav item during the page tour.
// Points to the menu item with an arrow and shows "Clique aqui" microcopy.
// Disappears when the route changes (user clicked the link).

'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { TourStep } from '@/hooks/use-onboarding';

type MenuTooltipProps = {
  step: TourStep;           // The current tour step (points to this menu item)
  stepNumber: number;       // e.g. 1
  totalSteps: number;       // e.g. 10
  onSkip: () => void;       // User clicked "Pular tour"
};

export function MenuTooltip({ step, stepNumber, totalSteps, onSkip }: MenuTooltipProps) {
  const pathname = usePathname();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Find the sidebar link element and compute position
  useEffect(() => {
    function compute() {
      // Match by href — the <a> inside SidebarMenuButton
      const link = document.querySelector<HTMLElement>(`a[href="${step.href}"], a[href^="${step.href}?"]`);
      if (!link) return;

      const rect = link.getBoundingClientRect();
      setPos({
        top: rect.top + rect.height / 2,
        left: rect.right + 12, // 12px gap to the right of the menu item
      });
    }

    compute();
    // Recompute on resize (sidebar collapse/expand)
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [step.href]);

  // Animate in after a short delay
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [step.href]);

  // Hide when the user navigates to the target page
  useEffect(() => {
    if (pathname.startsWith(step.href)) {
      setVisible(false);
    }
  }, [pathname, step.href]);

  if (!pos || !visible) return null;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[100] pointer-events-none"
      style={{ top: pos.top, left: pos.left, transform: 'translateY(-50%)' }}
    >
      {/* Arrow pointing left toward the menu item */}
      <div className="flex items-center gap-0">
        <div
          className="w-0 h-0 flex-shrink-0"
          style={{
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderRight: '8px solid white',
            filter: 'drop-shadow(-2px 0 2px rgba(93,42,103,0.12))',
          }}
        />

        {/* Balloon */}
        <div className="pointer-events-auto bg-white border border-border rounded-[4px_14px_14px_14px] shadow-[0_6px_24px_rgba(93,42,103,.14)] px-3 py-2.5 flex items-center gap-2.5 min-w-[160px]">
          {/* Fai avatar small */}
          <Image
            src="/images/email/fai-avatar.png"
            alt="Fai"
            width={24}
            height={24}
            className="rounded-full border border-border flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-foreground leading-tight">Clique aqui</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{step.menuLabel}</p>
          </div>

          {/* Step counter */}
          <span className="text-[9px] font-bold text-primary bg-primary/[0.08] px-1.5 py-0.5 rounded-full flex-shrink-0">
            {stepNumber}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Skip button — below the balloon */}
      <button
        onClick={onSkip}
        className="pointer-events-auto mt-1.5 ml-8 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-2 block"
      >
        Pular tour
      </button>
    </div>
  );
}
