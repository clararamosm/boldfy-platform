// src/components/gamification/gem-badge.tsx
// Faceted gem badge for the 8-level system.
// Pure SVG component — no server/client directive needed (client by default via import).

import React from 'react';
import { cn } from '@/lib/utils';

// ─── Level color palettes ────────────────────────────────────────
// From lightest lilac (level 1) to deep purple (level 8).
// Extracted from docs/badges-nivel-referencia.html.

const LEVEL_PALETTES: Record<number, {
  top: string;
  left: string;
  right: string;
  bl: string;
  br: string;
  center: string;
  highlight: string;
  shadow: string;
  numColor: string;
  strokeOpacity: string;
  highlightSmall: string;
}> = {
  1: { top: '#F5E6FF', left: '#EAD0F9', right: '#E0BCF3', bl: '#D9ACF0', br: '#D1A0EB', center: '#E4C4F6', highlight: 'rgba(255,255,255,.7)', shadow: 'rgba(228,196,246,.5)', numColor: '#9840AD', strokeOpacity: '.2', highlightSmall: '.25' },
  2: { top: '#EACFFA', left: '#DDB5F4', right: '#D19DEE', bl: '#C78BE8', br: '#BD79E2', center: '#D4A6F0', highlight: 'rgba(255,255,255,.55)', shadow: 'rgba(212,166,240,.45)', numColor: '#7E3FA6', strokeOpacity: '.2', highlightSmall: '.25' },
  3: { top: '#DDB5F4', left: '#CD80F1', right: '#C068E8', bl: '#B556DF', br: '#AA44D6', center: '#C870EC', highlight: 'rgba(255,255,255,.45)', shadow: 'rgba(200,112,236,.4)', numColor: '#ffffff', strokeOpacity: '.15', highlightSmall: '.25' },
  4: { top: '#D494F0', left: '#CD50F1', right: '#B840D9', bl: '#A838C8', br: '#9840AD', center: '#C050E5', highlight: 'rgba(255,255,255,.35)', shadow: 'rgba(205,80,241,.4)', numColor: '#ffffff', strokeOpacity: '.12', highlightSmall: '.25' },
  5: { top: '#C068E8', left: '#AD42D0', right: '#9840AD', bl: '#8838A0', br: '#7E3FA6', center: '#A845C0', highlight: 'rgba(255,255,255,.28)', shadow: 'rgba(168,69,192,.4)', numColor: '#ffffff', strokeOpacity: '.1', highlightSmall: '.25' },
  6: { top: '#A848C5', left: '#9240A8', right: '#7E3FA6', bl: '#6B3590', br: '#5E2A67', center: '#8A3CA0', highlight: 'rgba(255,255,255,.2)', shadow: 'rgba(138,60,160,.4)', numColor: '#ffffff', strokeOpacity: '.08', highlightSmall: '.2' },
  7: { top: '#8A3CA0', left: '#6E3088', right: '#5E2A67', bl: '#4A2055', br: '#3D1A45', center: '#6E3088', highlight: 'rgba(255,255,255,.15)', shadow: 'rgba(110,48,136,.45)', numColor: '#ffffff', strokeOpacity: '.06', highlightSmall: '.15' },
  8: { top: '#6E3088', left: '#4A2058', right: '#3D1A45', bl: '#2D1235', br: '#1A0B22', center: '#4E2260', highlight: 'rgba(255,255,255,.1)', shadow: 'rgba(78,34,96,.5)', numColor: '#ffffff', strokeOpacity: '.15', highlightSmall: '.1' },
};

// ─── Size configs ────────────────────────────────────────────────

type GemSize = 'xl' | 'lg' | 'md' | 'sm';

const SIZE_CONFIG: Record<GemSize, { w: number; h: number; fontSize: number; marginTop: number }> = {
  xl: { w: 100, h: 116, fontSize: 28, marginTop: 6 },
  lg: { w: 76, h: 88, fontSize: 22, marginTop: 4 },
  md: { w: 52, h: 60, fontSize: 16, marginTop: 3 },
  sm: { w: 36, h: 42, fontSize: 12, marginTop: 2 },
};

// ─── Props ───────────────────────────────────────────────────────

type GemBadgeProps = {
  level: number;
  size?: GemSize;
  className?: string;
  /** When true & level >= 6, applies a glow animation. */
  animated?: boolean;
};

// ─── Component ───────────────────────────────────────────────────

export function GemBadge({ level, size = 'md', className, animated }: GemBadgeProps) {
  const clampedLevel = Math.max(1, Math.min(8, level));
  const p = LEVEL_PALETTES[clampedLevel];
  const s = SIZE_CONFIG[size];

  // The SVG viewBox is always 100×116 — we scale via width/height
  const textShadow = clampedLevel >= 3
    ? '0 2px 4px rgba(0,0,0,.25)'
    : 'none';

  const showGlow = animated && clampedLevel >= 6;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center rounded-full', className)}
      style={{
        width: s.w,
        height: s.h,
        ...(showGlow ? { animation: 'levelup-glow 2s ease-in-out infinite' } : {}),
      }}
    >
      <svg
        width={s.w}
        height={s.h}
        viewBox="0 0 100 116"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: `drop-shadow(0 6px 16px ${p.shadow})` }}
      >
        {/* Main facets */}
        <polygon points="50,0 85,36 50,48 15,36" fill={p.top} />
        <polygon points="15,36 50,48 8,36" fill={p.highlight} />
        <polygon points="15,36 50,48 50,116" fill={p.left} />
        <polygon points="85,36 50,48 50,116" fill={p.right} />
        <polygon points="15,36 50,116 8,56" fill={p.bl} />
        <polygon points="85,36 50,116 92,56" fill={p.br} />

        {/* Center and highlights */}
        <polygon points="50,48 35,40 50,36 65,40" fill={p.center} opacity={clampedLevel >= 8 ? '.5' : '.6'} />
        <polygon points="50,0 65,20 50,28 35,20" fill={p.highlight} opacity={clampedLevel >= 8 ? '.4' : '.5'} />
        <polygon points="50,0 15,36 25,34" fill={p.highlight} opacity={clampedLevel >= 7 ? '.2' : '.3'} />
        <polygon points="22,40 30,46 26,52" fill={p.highlight} opacity={p.highlightSmall} />

        {/* Outline */}
        <polygon
          points="50,0 85,36 92,56 50,116 8,56 15,36"
          fill="none"
          stroke={clampedLevel === 8 ? 'rgba(205,80,241,.15)' : `rgba(255,255,255,${p.strokeOpacity})`}
          strokeWidth={clampedLevel === 8 ? '1' : '.8'}
        />
      </svg>

      {/* Level number */}
      <span
        className="absolute z-10 font-black leading-none select-none"
        style={{
          fontFamily: "'Nunito Sans', 'Inter', sans-serif",
          fontSize: s.fontSize,
          marginTop: s.marginTop,
          color: p.numColor,
          textShadow,
        }}
      >
        {clampedLevel}
      </span>
    </div>
  );
}
