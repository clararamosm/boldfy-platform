// src/lib/gamification-constants.ts
// Shared gamification constants and pure functions.
// Extracted from actions/gamification.ts to avoid 'use server' restriction
// (Next.js 15 requires all exports from 'use server' files to be async).

// ─── Level Thresholds ─────────────────────────────────────────────
// Levels are derived from cyclesCompleted (accumulated, never resets).
// 8 levels, purely visual — no point bonuses.

export const LEVEL_THRESHOLDS = [
  { cycles: 20, level: 8 },
  { cycles: 14, level: 7 },
  { cycles: 10, level: 6 },
  { cycles: 7,  level: 5 },
  { cycles: 4,  level: 4 },
  { cycles: 2,  level: 3 },
  { cycles: 1,  level: 2 },
] as const;

export function getLevelFromCycles(cycles: number): number {
  for (const t of LEVEL_THRESHOLDS) {
    if (cycles >= t.cycles) return t.level;
  }
  return 1;
}

// ─── Conquest Ladders ─────────────────────────────────────────────
// Progressive thresholds per category. Each conquered target becomes a badge.

export const CONQUEST_LADDERS: Record<string, number[]> = {
  pub:     [1, 10, 30, 50, 100],
  trail:   [1, 5, 10, 20, 30, 40],
  mission: [1, 5, 10, 20],
  seq:     [7, 14, 28, 49, 70, 98, 140],
};
