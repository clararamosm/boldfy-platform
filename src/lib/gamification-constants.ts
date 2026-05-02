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
//
// pub / trail / mission → INFINITE hybrid progression:
//   Base: 1, 10, 20, 40, 70, 100, 150, 200, 300, 400, 500, 750, 1000
//   After 1000: +250 each (1250, 1500, 1750, ...)
//
// seq → stays FINITE (streak-based, tied to cycle weeks):
//   7, 14, 28, 49, 70, 98, 140

const INFINITE_BASE_LADDER = [1, 10, 20, 40, 70, 100, 150, 200, 300, 400, 500, 750, 1000];
const INFINITE_STEP_AFTER_BASE = 250;

// seq stays fixed — streak-based, tied to level journey
const SEQ_LADDER = [7, 14, 28, 49, 70, 98, 140];

// Legacy static export — now only used for seq.
// For pub/trail/mission use getConquestLadder() which generates infinite targets.
export const CONQUEST_LADDERS: Record<string, number[]> = {
  pub:     INFINITE_BASE_LADDER,
  trail:   INFINITE_BASE_LADDER,
  mission: INFINITE_BASE_LADDER,
  seq:     SEQ_LADDER,
};

/**
 * Get the next conquest target for a category, given the list of completed conquest IDs.
 * For pub/trail/mission: infinite progression (base ladder + incremental steps).
 * For seq: finite fixed ladder.
 * Returns null if all conquests are completed (only possible for seq).
 */
export function getNextConquestTarget(
  category: string,
  completed: string[],
): number | null {
  if (category === 'seq') {
    // Finite ladder
    for (const target of SEQ_LADDER) {
      if (!completed.includes(`seq_${target}`)) return target;
    }
    return null; // all seq conquered
  }

  // Infinite ladder for pub/trail/mission
  // 1. Check base ladder first
  for (const target of INFINITE_BASE_LADDER) {
    if (!completed.includes(`${category}_${target}`)) return target;
  }

  // 2. All base conquered — generate beyond 1000
  let nextTarget = INFINITE_BASE_LADDER[INFINITE_BASE_LADDER.length - 1] + INFINITE_STEP_AFTER_BASE;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!completed.includes(`${category}_${nextTarget}`)) return nextTarget;
    nextTarget += INFINITE_STEP_AFTER_BASE;
  }
}

/**
 * Get a human-readable goal name for a conquest target.
 * E.g. getConquestGoalName('pub', 10) → '10 publicações'
 */
export function getConquestGoalName(category: string, target: number): string {
  const CATEGORY_NOUNS: Record<string, { singular: string; plural: string }> = {
    pub:     { singular: 'publicação', plural: 'publicações' },
    trail:   { singular: 'trilha', plural: 'trilhas' },
    mission: { singular: 'missão', plural: 'missões' },
    seq:     { singular: 'semana', plural: 'semanas' },
  };

  const noun = CATEGORY_NOUNS[category];
  if (!noun) return `${target} ${category}`;

  if (target === 1) return `1ª ${noun.singular}`;
  return `${target} ${noun.plural}`;
}
