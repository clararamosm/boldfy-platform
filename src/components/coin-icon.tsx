// src/components/coin-icon.tsx
// Boldfy points coin — flat 3D gold coin with star.
// Hover: bounce "toin" + shimmer sweep.
// Sizes: xs (12px) sm (16px) md (20px) lg (28px) xl (40px)

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

const sizes = {
  xs: 'w-3 h-3',      // 12px — inline badge
  sm: 'w-4 h-4',      // 16px — stat label
  md: 'w-5 h-5',      // 20px — default
  lg: 'w-7 h-7',      // 28px — stat card
  xl: 'w-10 h-10',    // 40px — hero / empty state
} as const;

type CoinSize = keyof typeof sizes;

type CoinIconProps = {
  className?: string;
  size?: CoinSize;
  /** gray = pending, green = completed, red = spent, default = gold (points) */
  variant?: 'default' | 'gray' | 'green' | 'red';
};

export function CoinIcon({ className, size = 'md', variant = 'default' }: CoinIconProps) {
  const bgGradient = {
    default: 'from-yellow-300 via-yellow-400 to-yellow-500',
    gray: 'from-gray-200 via-gray-300 to-gray-400',
    green: 'from-green-300 via-green-500 to-green-600',
    red: 'from-red-300 via-red-500 to-red-600',
  }[variant];

  const shadow = {
    default: 'shadow-[0_2px_0_#B8960B,0_3px_6px_rgba(0,0,0,0.12)]',
    gray: 'shadow-[0_2px_0_#9ca3af,0_2px_4px_rgba(0,0,0,0.08)]',
    green: 'shadow-[0_2px_0_#16a34a,0_2px_4px_rgba(22,163,74,0.2)]',
    red: 'shadow-[0_2px_0_#b91c1c,0_2px_4px_rgba(185,28,28,0.2)]',
  }[variant];

  const starFill = {
    default: '#7B5800',
    gray: '#6b7280',
    green: '#ffffff',
    red: '#ffffff',
  }[variant];

  const ringBorder = {
    default: 'border-yellow-700/15',
    gray: 'border-gray-500/15',
    green: 'border-white/20',
    red: 'border-white/20',
  }[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full relative overflow-hidden bg-gradient-to-br',
        'group/coin cursor-pointer select-none shrink-0',
        bgGradient,
        shadow,
        sizes[size],
        className,
      )}
    >
      {/* Inner ring */}
      <span
        className={cn(
          'absolute inset-[11%] rounded-full border pointer-events-none',
          ringBorder,
        )}
      />

      {/* Top highlight gleam */}
      <span className="absolute top-[6%] left-[12%] w-[34%] h-[24%] rounded-full bg-white/40 blur-[0.5px] pointer-events-none" />

      {/* Star */}
      <svg
        viewBox="0 0 24 24"
        className="relative z-[1] w-[55%] h-[55%]"
      >
        <path
          d="M12 2l2.9 6.26L22 9.27l-5 5.14L18.18 22 12 18.56 5.82 22 7 14.41 2 9.27l7.1-1.01L12 2z"
          fill={starFill}
        />
      </svg>

      {/* Shimmer sweep on hover */}
      <span
        className={cn(
          'absolute inset-0 rounded-full pointer-events-none z-[2]',
          'bg-[linear-gradient(105deg,transparent_30%,rgba(255,255,255,0.6)_48%,rgba(255,255,255,0.8)_50%,rgba(255,255,255,0.6)_52%,transparent_70%)]',
          'opacity-0 -translate-x-[110%]',
          'group-hover/coin:animate-coin-shimmer',
        )}
      />
    </span>
  );
}
