// Centralized pillar color palette for content strategy pillars

export type PillarColorKey = 'orange' | 'amber' | 'green' | 'blue';

export type PillarColor = {
  key: PillarColorKey;
  label: string;
  swatch: string; // Tailwind bg class for the color picker swatch
  bg: string;     // Tag background classes (light + dark)
  text: string;   // Tag text classes (light + dark)
};

export const PILLAR_COLORS: PillarColor[] = [
  { key: 'orange', label: 'Laranja', swatch: 'bg-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  { key: 'amber', label: 'Amarelo', swatch: 'bg-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  { key: 'green', label: 'Verde', swatch: 'bg-green-500', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  { key: 'blue', label: 'Azul', swatch: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
];

const DEFAULT_COLOR = PILLAR_COLORS[0]; // orange

/**
 * Get the Tailwind classes for a pillar color by key.
 * Returns gray as fallback if key is undefined or not found.
 */
export function getPillarClasses(colorKey?: string): { bg: string; text: string } {
  if (!colorKey) return { bg: DEFAULT_COLOR.bg, text: DEFAULT_COLOR.text };
  const found = PILLAR_COLORS.find(c => c.key === colorKey);
  return found
    ? { bg: found.bg, text: found.text }
    : { bg: DEFAULT_COLOR.bg, text: DEFAULT_COLOR.text };
}
