// Centralized pillar color palette for content strategy pillars

export type PillarColorKey =
  | 'gray' | 'red' | 'orange' | 'amber' | 'green'
  | 'teal' | 'blue' | 'indigo' | 'purple' | 'pink' | 'rose';

export type PillarColor = {
  key: PillarColorKey;
  label: string;
  swatch: string; // Tailwind bg class for the color picker swatch
  bg: string;     // Tag background classes (light + dark)
  text: string;   // Tag text classes (light + dark)
};

export const PILLAR_COLORS: PillarColor[] = [
  { key: 'gray', label: 'Cinza', swatch: 'bg-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
  { key: 'red', label: 'Vermelho', swatch: 'bg-red-500', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  { key: 'orange', label: 'Laranja', swatch: 'bg-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  { key: 'amber', label: 'Âmbar', swatch: 'bg-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  { key: 'green', label: 'Verde', swatch: 'bg-green-500', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  { key: 'teal', label: 'Teal', swatch: 'bg-teal-500', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300' },
  { key: 'blue', label: 'Azul', swatch: 'bg-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  { key: 'indigo', label: 'Índigo', swatch: 'bg-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
  { key: 'purple', label: 'Roxo', swatch: 'bg-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  { key: 'pink', label: 'Rosa', swatch: 'bg-pink-500', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300' },
  { key: 'rose', label: 'Rose', swatch: 'bg-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300' },
];

const DEFAULT_COLOR = PILLAR_COLORS[0]; // gray

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
