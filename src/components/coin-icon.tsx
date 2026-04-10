// src/components/coin-icon.tsx
// Custom animated coin icon for Boldfy points.
// Replaces Zap (lightning) which is reserved for the missions sidebar icon.
// On hover: 3D coin-flip animation via Tailwind.

'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

type CoinIconProps = {
  className?: string;
};

export function CoinIcon({ className }: CoinIconProps) {
  const [flipping, setFlipping] = useState(false);

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(
        'inline-block',
        flipping && 'animate-coin-flip',
        className,
      )}
      style={{ transformStyle: 'preserve-3d' }}
      onMouseEnter={() => setFlipping(true)}
      onAnimationEnd={() => setFlipping(false)}
    >
      {/* Outer coin body */}
      <circle cx="12" cy="12" r="10" />
      {/* Inner ring for 3D depth feel */}
      <circle cx="12" cy="12" r="7" strokeWidth="1.5" opacity="0.4" />
      {/* B letter — Boldfy currency */}
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        B
      </text>
    </svg>
  );
}
