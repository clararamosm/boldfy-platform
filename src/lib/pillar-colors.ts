// Centralized pillar color palette for content strategy pillars.
//
// Paleta refeita em maio/2026 (feedback Clara): antes a paleta misturava
// cores fortes (laranja/amarelo/verde/azul) que entravam em ruído visual
// com as tags de status do calendário (verde=published, azul=scheduled,
// amarelo=in_progress, vermelho=failed). Agora a paleta inteira é variação
// de roxo — assim status e pilar nunca competem pela mesma cor.
//
// As KEYS antigas (orange/amber/green/blue/purple/wine) foram mantidas no
// type pra que dados já salvos no Firestore continuem válidos sem migration.
// Só o que elas MAPEIAM visualmente mudou. Os labels foram atualizados pra
// refletir o tom real.
//
// Rev 2 (maio/2026 — feedback Clara): a paleta visível tinha 6 opções, mas
// os 3 primeiros tons (violet-200/purple-300/violet-500 claros) sumiam no
// fundo branco do picker — pareciam swatches vazios. Agora são exatamente
// 5 opções, todas claramente visíveis em fundo claro, com gradiente do
// roxo pastel até um roxo bem escuro (purple-950, mais escuro que o
// anterior). A 6ª key `wine` segue válida no type/schema pra retro-
// compatibilidade, mas não aparece mais no picker — se algum pilar tinha
// 'wine' salvo, ele cai no fallback de getPillarClasses (lavanda).

export type PillarColorKey = 'orange' | 'amber' | 'green' | 'blue' | 'purple' | 'wine';

export type PillarColor = {
  key: PillarColorKey;
  label: string;
  swatch: string; // Tailwind bg class for the color picker swatch
  bg: string;     // Tag background classes (light + dark)
  text: string;   // Tag text classes (light + dark)
};

export const PILLAR_COLORS: PillarColor[] = [
  // Gradient de roxo do mais claro (visível) ao mais escuro (uva profunda).
  // Cinco opções escolhidas pra que cada uma seja imediatamente distinguível
  // das outras em swatches de 28px no picker, sem nenhuma sumir no fundo.
  { key: 'orange', label: 'Lavanda',      swatch: 'bg-purple-300', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  { key: 'amber',  label: 'Lilás',        swatch: 'bg-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-200' },
  { key: 'green',  label: 'Violeta',      swatch: 'bg-purple-500', bg: 'bg-purple-200 dark:bg-purple-900/40', text: 'text-purple-800 dark:text-purple-200' },
  { key: 'blue',   label: 'Roxo',         swatch: 'bg-purple-700', bg: 'bg-purple-200 dark:bg-purple-900/50', text: 'text-purple-900 dark:text-purple-100' },
  { key: 'purple', label: 'Roxo profundo', swatch: 'bg-purple-950', bg: 'bg-purple-300 dark:bg-purple-900/60', text: 'text-purple-950 dark:text-purple-100' },
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
