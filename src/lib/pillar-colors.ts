// Centralized pillar color palette for content strategy pillars.
//
// Paleta refeita em maio/2026 (feedback Clara): antes a paleta misturava
// cores fortes (laranja/amarelo/verde/azul) que entravam em ruído visual
// com as tags de status do calendário (verde=published, azul=scheduled,
// amarelo=in_progress, vermelho=failed). Agora a paleta inteira é variação
// de roxo — assim status e pilar nunca competem pela mesma cor.
//
// As KEYS antigas (orange/amber/green/blue/purple) foram mantidas pra que
// dados já salvos no Firestore continuem válidos sem migration. Só o que
// elas MAPEIAM visualmente mudou. Os labels foram atualizados pra refletir
// o tom real.
//
// Adicionada 6ª key `wine` pra dar mais variedade na ponta escura do gradient.

export type PillarColorKey = 'orange' | 'amber' | 'green' | 'blue' | 'purple' | 'wine';

export type PillarColor = {
  key: PillarColorKey;
  label: string;
  swatch: string; // Tailwind bg class for the color picker swatch
  bg: string;     // Tag background classes (light + dark)
  text: string;   // Tag text classes (light + dark)
};

export const PILLAR_COLORS: PillarColor[] = [
  // Gradient de roxo do mais claro (lavanda) ao mais escuro (uva).
  // Variando entre violet e purple do Tailwind pra dar mais distinção visual
  // entre os tons médios — pures `purple-200/300/400` ficam muito próximos.
  { key: 'orange', label: 'Lavanda',      swatch: 'bg-violet-200', bg: 'bg-violet-50 dark:bg-violet-950/40',  text: 'text-violet-700 dark:text-violet-300' },
  { key: 'amber',  label: 'Lilás',        swatch: 'bg-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  { key: 'green',  label: 'Violeta',      swatch: 'bg-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-800 dark:text-violet-200' },
  { key: 'blue',   label: 'Roxo',         swatch: 'bg-purple-500', bg: 'bg-purple-200 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-200' },
  { key: 'purple', label: 'Roxo escuro',  swatch: 'bg-purple-700', bg: 'bg-purple-200 dark:bg-purple-900/50', text: 'text-purple-900 dark:text-purple-100' },
  { key: 'wine',   label: 'Uva',          swatch: 'bg-purple-900', bg: 'bg-purple-300 dark:bg-purple-900/60', text: 'text-purple-950 dark:text-purple-100' },
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

/**
 * Get the swatch (solid color circle) class for a pillar color by key.
 * Usado em bullets/dots de pilar onde a gente quer a cor sólida em vez do
 * fundo claro da tag. Antes esse mapeamento era feito por if/else olhando
 * o classname (frágil quando a paleta mudou pra tons de roxo, todos com
 * 'purple' ou 'violet' no nome).
 */
export function getPillarSwatch(colorKey?: string): string {
  if (!colorKey) return DEFAULT_COLOR.swatch;
  const found = PILLAR_COLORS.find(c => c.key === colorKey);
  return found ? found.swatch : DEFAULT_COLOR.swatch;
}
