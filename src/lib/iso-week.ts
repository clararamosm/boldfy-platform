// src/lib/iso-week.ts
// ISO 8601 week utilities for the streak system.
// Monday = start of week, Sunday = end. Thursday-based week numbering.

/**
 * Returns the ISO week id for a given date (default: now).
 * Format: "2026-W18"
 */
export function getISOWeekId(date?: Date): string {
  const d = date ? new Date(date.getTime()) : new Date();
  // Set to nearest Thursday: current date + 4 - day number (Mon=1, Sun=7)
  const dayOfWeek = d.getDay() || 7; // Convert Sunday(0) to 7
  d.setDate(d.getDate() + 4 - dayOfWeek);
  // Get first day of year
  const yearStart = new Date(d.getFullYear(), 0, 1);
  // Calculate full weeks to nearest Thursday
  const weekNumber = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Returns the Monday (00:00:00) of the ISO week containing the given date.
 */
export function getWeekMonday(date?: Date): Date {
  const d = date ? new Date(date.getTime()) : new Date();
  const day = d.getDay() || 7; // Convert Sunday(0) to 7
  d.setDate(d.getDate() - day + 1); // Go to Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the number of ISO weeks in a given year (52 or 53).
 */
function getISOWeeksInYear(year: number): number {
  // A year has 53 weeks if Jan 1 is Thursday or it's a leap year with Jan 1 on Wednesday
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  if (jan1Day === 4) return 53; // Thursday
  if (jan1Day === 3) {
    // Wednesday — check leap year
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (isLeap) return 53;
  }
  return 52;
}

/**
 * Returns the previous ISO week id.
 * Handles year boundaries: "2026-W01" → "2025-W53" or "2025-W52".
 */
export function getPreviousWeekId(weekId: string): string {
  const [yearStr, weekStr] = weekId.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);

  if (week > 1) {
    return `${year}-W${String(week - 1).padStart(2, '0')}`;
  }

  // Week 1 → previous year's last week
  const prevYear = year - 1;
  const prevYearWeeks = getISOWeeksInYear(prevYear);
  return `${prevYear}-W${String(prevYearWeeks).padStart(2, '0')}`;
}
